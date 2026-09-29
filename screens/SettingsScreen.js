import React, { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {  ActivityIndicator, Alert, Button, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons'

import { NativeWindStyleSheet } from "nativewind";

import * as Application from 'expo-application';
import AppContext from '../components/AppContext';

import { useTranslation } from 'react-i18next';
import { t, use } from 'i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import firmareIsUpToDate from '../utils/Helpers';
import { backend_current_version } from '../utils/Helpers';
import PressableScale from '../components/PressableScale';
import ConnectionCard from '../components/ConnectionCard';
import WifiSetupModal from '../components/WifiSetupModal';
import { forgetWifi, getNetworkStatus, switchToHotspot } from '../utils/SunscanNetwork';
import HubLoginForm from '../components/HubLoginForm';
import FirmwareUpdateModal from '../components/FirmwareUpdateModal';
import { hubErrorKey, hubLogout } from '../utils/SpectroSolHub';
import { desktopErrorKey, getDesktopState, setDesktopState } from '../utils/SunscanDesktop';

NativeWindStyleSheet.setOutput({
  default: "native",
});

// Define available languages
const languages = [ // Language List
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
];

// --- Layout primitives for the settings list -------------------------------
// Settings used to be one flat column of rows; they are now grouped into
// titled cards, with Section drawing the separators so each Row stays unaware
// of its position (rows appear and disappear depending on connection state).

const cardStyle = {
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: 'rgba(255,255,255,0.10)',
};

const separatorStyle = {
  borderTopWidth: StyleSheet.hairlineWidth,
  borderTopColor: 'rgba(255,255,255,0.08)',
};

// A titled group of settings rendered as a single card.
function Section({title, children}) {
  // toArray drops the null/false children produced by conditional rows, so the
  // separators always land between two rows that are actually rendered.
  const items = React.Children.toArray(children);
  if (!items.length) {
    return null;
  }
  return (
    <View className="mb-6">
      <Text className="text-zinc-500 font-bold mb-2 ml-1" style={{fontSize:11, letterSpacing:1.2}}>{title.toUpperCase()}</Text>
      <View className="bg-zinc-900/70 rounded-2xl overflow-hidden" style={cardStyle}>
        {items.map((child, i) => (
          <View key={i} style={i === 0 ? null : separatorStyle}>{child}</View>
        ))}
      </View>
    </View>
  );
}

// One setting: label (plus an optional hint) on the left, its control on the right.
// `hint` takes either a string or a node, for the rows that show several lines.
function Row({label, hint, children}) {
  return (
    <View className="flex flex-row items-center px-4 py-3">
      <View className="w-2/5 pr-3">
        <Text className="text-white">{label}</Text>
        {typeof hint === 'string'
          ? <Text className="text-zinc-500 mt-1" style={{fontSize:11}}>{hint}</Text>
          : hint}
      </View>
      <View className="flex-1 flex flex-row items-center justify-end">{children}</View>
    </View>
  );
}

// Row without a label, for the blocks that span the whole card width.
function FullRow({children}) {
  return <View className="px-4 py-3">{children}</View>;
}

const formatBytes = (bytes) => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 / 1024)} MB`;
};

// "used / cap", a cap of 0 meaning none is known.
const quotaLine = (used, cap, format = String) =>
  cap ? `${format(used)} / ${format(cap)}` : format(used);

export default function SettingsScreen({navigation, isFocused}) {

  // Get the global variables & functions via context
  const myContext = useContext(AppContext);
  const [isLoading, setIsLoading] = useState(false);
  const [cacheIsCleared, setCacheIsCleared] = useState(false);
  const [sunscanIsShutdown, setSunscanIsShutdown] = useState(false);
  const [sunscanIsReboot, setSunscanIsReboot] = useState(false);
  const [wifiModalVisible, setWifiModalVisible] = useState(false);
  const [wifiBusy, setWifiBusy] = useState(false);
  // Manual address field of the connection card, folded unless asked for
  const [advancedOpen, setAdvancedOpen] = useState(false);


  const [firmwareModalVisible, setFirmwareModalVisible] = useState(false);

  // Initialize translation hook
  const { t, i18n } = useTranslation();
  const [lang, changeLang] = useState('en');
  const selectedLanguageCode = i18n.language;

  // --- Connection -----------------------------------------------------------
  // The link itself (hotspot or home network) is found by useSunscanLink in
  // App.js; here we only show it and offer the moves.

  const {
    apiURL, sunscanIsConnected, sunscanDevice, setSunscanDevice,
    viaHotspot, setViaHotspot, lanApiURL, setLanApiURL,
    sunscanNetwork: netStatus, setSunscanNetwork: setNetStatus,
    linkSearch, discoverLink, cancelLinkSearch,
  } = myContext;

  // Typed by hand under "advanced": a box without the network API, or on Ethernet
  const saveLanAddress = (url) => {
    setLanApiURL(url);
    setViaHotspot(false);
  };

  const refreshNetworkStatus = useCallback(async () => {
    if (!sunscanIsConnected) {
      return;
    }
    try {
      const status = await getNetworkStatus(apiURL);
      setNetStatus(status);
      if (status?.device_id) {
        // Keep the identity of the SUNSCAN, the name of its hotspot and its
        // home address: they find it again once it has changed network, and
        // the card can name the hotspot while the box is out of reach.
        const lastIp = status.mode === 'client' ? status.ip : status.last_client?.ip;
        const hotspot = status.hotspot?.ssid;
        setSunscanDevice((prev) => (
          prev?.id === status.device_id && (!lastIp || prev?.lastIp === lastIp) && (!hotspot || prev?.hotspot === hotspot)
            ? prev
            : { ...prev, id: status.device_id, lastIp: lastIp || prev?.lastIp, hotspot: hotspot || prev?.hotspot }
        ));
      }
    } catch (e) {
      console.log('network status unavailable', e?.message);
    }
  }, [apiURL, sunscanIsConnected, setSunscanDevice, setNetStatus]);

  useFocusEffect(
    useCallback(() => {
      refreshNetworkStatus();
    }, [refreshNetworkStatus]));

  // The SUNSCAN has been found on the home wifi: point the app at it
  const onWifiConnected = useCallback((url) => {
    setLanApiURL(url);
    setViaHotspot(false);
    setSunscanDevice((prev) => ({ ...prev, lastIp: url.split(':')[0] }));
  }, [setLanApiURL, setViaHotspot, setSunscanDevice]);

  // The user gave up waiting for the box and wants to type its address
  const onWifiManualIp = () => {
    setWifiModalVisible(false);
    setAdvancedOpen(true);
  };

  const closeWifiModal = () => {
    setWifiModalVisible(false);
    refreshNetworkStatus();
  };

  // Named even while the box is out of reach, from what was read last time
  const hotspotName = netStatus?.hotspot?.ssid || sunscanDevice?.hotspot
    || (sunscanDevice?.id ? `sunscan-${sunscanDevice.id}` : 'sunscan-…');

  // --- SpectroSolHub ---------------------------------------------------------

  const { hubSupported, hubAccount, refreshHubAccount } = myContext;
  const [hubChecking, setHubChecking] = useState(false);

  // The token is checked with the hub here (up to 10 s), which also brings the
  // quota; an expired one comes back disconnected and the form shows up.
  useFocusEffect(
    useCallback(() => {
      if (!sunscanIsConnected || !hubSupported || !hubAccount?.connected) {
        return;
      }
      let active = true;
      setHubChecking(true);
      refreshHubAccount({ verify: true }).finally(() => active && setHubChecking(false));
      return () => { active = false; };
    }, [sunscanIsConnected, hubSupported, hubAccount?.connected, refreshHubAccount]));

  const logoutHub = () => {
    Alert.alert(t('common:warning'), t('common:hubLogoutConfirm', { name: hubAccount?.username }), [
      { text: t('common:cancel'), style: 'cancel' },
      { text: t('common:hubLogout'), style: 'destructive', onPress: async () => {
        try {
          await hubLogout(apiURL);
        } catch (e) {
          Alert.alert(t('common:warning'), t('common:wifiUnreachable'));
        }
        refreshHubAccount();
      }}]);
  };

  const hubAccountHint = () => {
    const lines = [t('common:hubConnectedAs', { username: hubAccount.username })];
    if (hubChecking) {
      lines.push(t('common:hubChecking'));
    } else if (hubAccount.verified === false && hubAccount.error) {
      lines.push(t(hubErrorKey(hubAccount.error)));
    } else if (hubAccount.quota) {
      const q = hubAccount.quota;
      lines.push(t('common:hubQuota', {
        storage: quotaLine(q.used_storage_bytes, q.storage_bytes, formatBytes),
        images: quotaLine(q.used_image_count, q.image_count),
      }));
    }
    if (netStatus?.mode === 'hotspot') {
      lines.push(t('common:hubNeedsInternet'));
    }
    return (
      <View>
        {lines.map((line, i) => <Text key={i} className="text-zinc-500 mt-1" style={{fontSize:11}}>{line}</Text>)}
      </View>
    );
  };

  // Both actions below drop the SUNSCAN back to its hotspot: the app follows,
  // and the user has to put the phone back on it.
  const followToHotspot = () => {
    setViaHotspot(true);
    setNetStatus(null);
    Alert.alert(t('common:wifiNetwork'), t('common:wifiRejoinHotspot', { hotspot: hotspotName }));
  };

  const backToHotspot = () => {
    Alert.alert(t('common:warning'), t('common:wifiBackToHotspotConfirm', { hotspot: hotspotName }), [
      { text: t('common:cancel'), style: 'cancel' },
      { text: 'OK', onPress: async () => {
        setWifiBusy(true);
        try {
          await switchToHotspot(apiURL);
          followToHotspot();
        } catch (e) {
          Alert.alert(t('common:warning'), t('common:wifiUnreachable'));
        } finally {
          setWifiBusy(false);
        }
      }}]);
  };

  const forgetNetwork = (ssid) => {
    const isCurrent = netStatus?.mode === 'client' && netStatus?.ssid === ssid;
    const message = isCurrent
      ? t('common:wifiForgetCurrentConfirm', { ssid, hotspot: hotspotName })
      : t('common:wifiForgetConfirm', { ssid });
    Alert.alert(t('common:warning'), message, [
      { text: t('common:cancel'), style: 'cancel' },
      { text: t('common:wifiForget'), style: 'destructive', onPress: async () => {
        setWifiBusy(true);
        try {
          const answer = await forgetWifi(apiURL, ssid);
          if (isCurrent && answer.ok) {
            followToHotspot();
          } else {
            refreshNetworkStatus();
          }
        } catch (e) {
          // Forgetting the current network cuts the connection before the
          // answer may come back: same outcome as a success.
          if (isCurrent) {
            followToHotspot();
          } else {
            Alert.alert(t('common:warning'), t('common:wifiUnreachable'));
          }
        } finally {
          setWifiBusy(false);
        }
      }}]);
  };

  // --- Linux desktop of the Pi ----------------------------------------------

  // null: nothing to offer (route unknown to the backend, or image without a
  // desktop). Read on every focus, the desktop may have been turned on from
  // another phone or by hand.
  const [desktop, setDesktop] = useState(null);
  const [desktopBusy, setDesktopBusy] = useState(false);
  const [desktopError, setDesktopError] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!sunscanIsConnected || !myContext.debug) {
        return;
      }
      let active = true;
      setDesktopError('');
      getDesktopState(apiURL)
        .then((state) => active && setDesktop(state))
        .catch(() => active && setDesktop(null));
      return () => { active = false; };
    }, [sunscanIsConnected, myContext.debug, apiURL]));

  // The switch only moves once the backend has answered: no optimistic update,
  // a stop can take up to 45 s and can be refused during a scan.
  const switchDesktop = async (body) => {
    setDesktopBusy(true);
    setDesktopError('');
    try {
      const answer = await setDesktopState(apiURL, body);
      if (answer.ok) {
        setDesktop(answer.desktop);
      } else {
        console.log('desktop switch failed', answer.detail);
        setDesktopError(t(desktopErrorKey(answer.error)));
      }
    } catch (e) {
      setDesktopError(t('common:wifiUnreachable'));
    } finally {
      setDesktopBusy(false);
    }
  };

  const toggleDesktop = (value) => {
    if (value) {
      switchDesktop({ running: true });
      return;
    }
    Alert.alert(t('common:warning'), t('common:desktopStopConfirm'), [
      { text: t('common:cancel'), style: 'cancel' },
      { text: 'OK', style: 'destructive', onPress: () => switchDesktop({ running: false }) },
    ]);
  };

  // Effect to fetch stats when the component gains focus
  useFocusEffect(
    useCallback(() => {
    setCacheIsCleared(false);
  }, []));

  // Function to save language preference to AsyncStorage
  const saveData = async (code) => {
    try {
      await AsyncStorage.setItem('SUNSCAN_APP::LANGUAGE', code);
      console.log('saved', code);
    } catch {
      console.log('err in saving data');
    }
  };



  const clearImageCache = async () => {
  
      Alert.alert(t('common:warning'), t('common:clearCacheConfirm'), [
        {
          text: t('common:cancel'),
          style: 'cancel',
        },
        { text: 'OK', onPress: async () => {
  
          Image.clearMemoryCache();
          Image.clearDiskCache();
          setCacheIsCleared(true);
              }}]);

      

  };

  
  const shutdown = async () => {
    Alert.alert(t('common:warning'), t('common:shutdownConfirm'),[
      {
        text: t('common:cancel'),
        style: 'cancel',
      },
      { text: 'OK', onPress: async () => {
        const url = 'http://'+myContext.apiURL+"/sunscan/shutdown/"
        fetch(url, {
          method: "POST", 
          headers: {
            'Content-Type': 'application/json'
        },
          body: JSON.stringify({}),
        }).then(response => response.json())
        .then(json => {
          setSunscanIsShutdown(true);
        })
        .catch(error => {
          console.error(error);
        });
     }}]);
  };

  const reboot = async () => {
    Alert.alert(t('common:warning'), t('common:rebootConfirm'),[
      {
        text: t('common:cancel'),
        style: 'cancel',
      },
      { text: 'OK', onPress: async () => {
        const url = 'http://'+myContext.apiURL+"/sunscan/reboot/"
        fetch(url, {
          method: "POST", 
          headers: {
            'Content-Type': 'application/json'
        },
          body: JSON.stringify({}),
        }).then(response => response.json())  
        .then(json => {
          setSunscanIsReboot(true);
        })
        .catch(error => {
          console.error(error);
        });
     }}]);
  };


  useFocusEffect(
    useCallback(() => {
      if (myContext.sunscanIsConnected) {
        setSunscanIsShutdown(false);
        setSunscanIsReboot(false);
      }
  }, [isFocused, myContext.sunscanIsConnected]));

  const [stackingOptReset, setStackingOptReset] = useState(false);
  
  const insets = useSafeAreaInsets();

  const hintClass = "text-zinc-500";
  const hintSize = {fontSize:11};

  return (
    <View className="flex flex-col bg-zinc-800">
      <View className="h-full">
        <SafeAreaProvider className="flex flex-col pl-4 pr-2" style={{flex: 1, paddingRight: insets.right}}>
          <ScrollView showsVerticalScrollIndicator={false}>

            {/* Screen header */}
            <View className="pt-6 pb-6">
              <Text className="text-2xl text-white font-bold">{t('common:configuration')}</Text>
              <Text className="text-zinc-500 mt-1" style={hintSize}>Sunscan v{Application.nativeApplicationVersion} app by STAROS ©{new Date().getFullYear()}</Text>
            </View>

            {/* ---- Global configuration ---- */}
            <Section title={t('common:globalConfiguration')}>

              <Row label={t('common:language')}>
                <View className="flex flex-row space-x-2">
                  {languages.map((currentLang, i) => {
                    const selectedLanguage = currentLang.code === selectedLanguageCode;
                    return (
                      <PressableScale
                        key={i}
                        className={selectedLanguage ? 'bg-emerald-600 px-3 py-2 rounded-xl' : 'bg-zinc-700 px-3 py-2 rounded-xl'}
                        onPress={() => {
                          changeLang(currentLang.code);
                          i18n.changeLanguage(currentLang.code);
                          saveData(currentLang.code);
                        }}>
                        <Text style={{color: selectedLanguage ? '#fff' : '#a1a1aa', fontWeight: selectedLanguage ? 'bold' : 'normal'}}>
                          {currentLang.label}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </Row>

              <Row label={t('common:observer')}>
                <TextInput
                  className="bg-zinc-800 border border-zinc-600 grow text-white rounded-xl px-3"
                  key="observer"
                  style={{paddingVertical: 7}}
                  value={myContext.observer}
                  returnKeyLabel='OK'
                  returnKeyType='done'
                  onChangeText={(value) => myContext.setObserver(value)}
                />
              </Row>

              <Row label={t('common:screenOrientation')} hint={t('common:screenOrientationDescription')}>
                <View className="flex flex-row space-x-2">
                  <PressableScale
                    onPress={() => myContext.setScreenOrientation('AUTO')}
                    className={myContext.screenOrientation === 'AUTO' ? 'bg-emerald-600 p-2 rounded-xl' : 'bg-zinc-700 p-2 rounded-xl'}
                  >
                    <View className="flex flex-col items-center justify-center" style={{minWidth: 58}}>
                      <Ionicons name="sync" size={22} color="white" />
                      <Text className="text-white mt-1" style={hintSize}>{t('common:auto')}</Text>
                    </View>
                  </PressableScale>
                  <PressableScale
                    onPress={() => myContext.setScreenOrientation('LANDSCAPE_RIGHT')}
                    className={myContext.screenOrientation === 'LANDSCAPE_RIGHT' ? 'bg-emerald-600 p-2 rounded-xl' : 'bg-zinc-700 p-2 rounded-xl'}
                  >
                    <View className="flex flex-col items-center justify-center" style={{minWidth: 58}}>
                      <Ionicons name="phone-landscape" size={22} color="white" />
                      <Text className="text-white mt-1" style={hintSize}>{t('common:cameraLeft')}</Text>
                    </View>
                  </PressableScale>
                  <PressableScale
                    onPress={() => myContext.setScreenOrientation('LANDSCAPE_LEFT')}
                    className={myContext.screenOrientation === 'LANDSCAPE_LEFT' ? 'bg-emerald-600 p-2 rounded-xl' : 'bg-zinc-700 p-2 rounded-xl'}
                  >
                    <View className="flex flex-col items-center justify-center" style={{minWidth: 58}}>
                      <Ionicons name="phone-landscape" size={22} color="white" style={{transform: [{rotate: '180deg'}]}} />
                      <Text className="text-white mt-1" style={hintSize}>{t('common:cameraRight')}</Text>
                    </View>
                  </PressableScale>
                </View>
              </Row>

              <Row label={t('common:displayWatermark')} hint={t('common:displayWatermarkDescription')}>
                <Switch
                  trackColor={{false: '#767577', true: 'rgb(5 150 105)'}}
                  thumbColor='#fff'
                  value={myContext.showWatermark}
                  onValueChange={myContext.toggleShowWaterMark}
                />
              </Row>

              <Row label={t('common:autoStopScan')} hint={t('common:autoStopScanDescription')}>
                <Switch
                  trackColor={{false: '#767577', true: 'rgb(5 150 105)'}}
                  thumbColor='#fff'
                  value={myContext.autoStop}
                  onValueChange={myContext.toggleAutoStop}
                />
              </Row>

            </Section>

            {/* ---- Connection ---- */}
            <Section title={t('common:connectionSection')}>

              {/* Where the SUNSCAN is and how the phone reaches it, found out by
                  the app itself (useSunscanLink); the wifi moves live here too */}
              <ConnectionCard
                connected={sunscanIsConnected}
                network={netStatus}
                apiURL={apiURL}
                viaHotspot={viaHotspot}
                hotspotName={hotspotName}
                search={linkSearch}
                onSearch={() => discoverLink({ deep: true })}
                onCancelSearch={cancelLinkSearch}
                onConnectWifi={() => setWifiModalVisible(true)}
                onBackToHotspot={backToHotspot}
                busy={wifiBusy}
                lanApiURL={lanApiURL}
                onSaveAddress={saveLanAddress}
                advancedOpen={advancedOpen}
                onToggleAdvanced={() => setAdvancedOpen((v) => !v)}
              />

              {myContext.sunscanIsConnected && netStatus?.supported && netStatus.saved_networks?.length > 0 &&
                <Row label={t('common:wifiSavedNetworks')} hint={t('common:wifiSavedNetworksHint')}>
                  <View className="flex-1 flex flex-col items-end" style={{gap: 6}}>
                    {netStatus.saved_networks.map((ssid) => (
                      <View key={ssid} className="flex flex-row items-center">
                        <Text className="text-white mr-3" numberOfLines={1}>{ssid}</Text>
                        <PressableScale className="bg-zinc-700 border border-zinc-600 rounded-xl px-3 py-1" disabled={wifiBusy} onPress={() => forgetNetwork(ssid)}>
                          <Text className="text-white" style={{fontSize:12}}>{t('common:wifiForget')}</Text>
                        </PressableScale>
                      </View>
                    ))}
                  </View>
                </Row>
              }

            </Section>

            <WifiSetupModal
              visible={wifiModalVisible}
              apiURL={myContext.apiURL}
              status={netStatus}
              lastIp={myContext.sunscanDevice?.lastIp}
              onClose={closeWifiModal}
              onConnected={onWifiConnected}
              onManualIp={onWifiManualIp}
            />
            <FirmwareUpdateModal isVisible={firmwareModalVisible} onClose={() => setFirmwareModalVisible(false)} />

            {/* ---- SpectroSolHub: only backends with the hub routes ---- */}
            {myContext.sunscanIsConnected && hubSupported && hubAccount &&
              <Section title="SpectroSolHub">
                {hubAccount.connected ?
                  <Row label={t('common:hubAccount')} hint={hubAccountHint()}>
                    <PressableScale className="bg-zinc-700 border border-zinc-600 rounded-xl px-3 py-2 flex flex-row items-center" onPress={logoutHub}>
                      <Ionicons name="log-out-outline" size={16} color="white" />
                      <Text className="text-white ml-2" style={{fontSize:12}}>{t('common:hubLogout')}</Text>
                    </PressableScale>
                  </Row>
                  :
                  <Row label={t('common:hubAccount')} hint={
                    <View>
                      <Text className="text-zinc-500 mt-1" style={{fontSize:11}}>{t('common:hubDescription')}</Text>
                      {netStatus?.mode === 'hotspot' && <Text className="text-amber-500 mt-1" style={{fontSize:11}}>{t('common:hubNeedsInternet')}</Text>}
                    </View>
                  }>
                    <View className="flex-1">
                      <HubLoginForm />
                    </View>
                  </Row>
                }
              </Section>
            }

            {/* ---- Device ---- */}
            <Section title={t('common:deviceSection')}>

              {(myContext.sunscanIsConnected || myContext.debug) &&
                <FullRow>
                  <View className="flex flex-row space-x-3">
                    <PressableScale className="bg-red-600 px-3 py-2 rounded-xl flex flex-row items-center space-x-2" onPress={shutdown}>
                      <Ionicons name="power" size={18} color="white" />
                      <Text className="text-white">{t('common:shutdown')}</Text>
                    </PressableScale>
                    <PressableScale className="bg-red-600 px-3 py-2 rounded-xl flex flex-row items-center space-x-2" onPress={reboot}>
                      <Ionicons name="refresh" size={18} color="white" />
                      <Text className="text-white">{t('common:reboot')}</Text>
                    </PressableScale>
                  </View>
                  {sunscanIsReboot && <Text className="text-zinc-400 italic mt-2" style={hintSize}>{t('common:rebootOk')}</Text>}
                  {sunscanIsShutdown && <Text className="text-zinc-400 italic mt-2" style={hintSize}>{t('common:shutdownOk')}</Text>}
                </FullRow>
              }

              {(myContext.sunscanIsConnected || myContext.debug) &&
                <Row
                  label={t('common:updateFirmware')}
                  hint={
                    <View>
                      <Text className={hintClass} style={hintSize}>{t('common:currentVersion')} : {myContext.backendApiVersion}</Text>
                      {(!firmareIsUpToDate(myContext) || myContext.debug) && <View>
                        <Text className={hintClass} style={hintSize}>{t('common:newVersion')} : {backend_current_version}</Text>
                        <Text className={hintClass} style={hintSize}>{t('common:updateFirmwareDescription')}</Text>
                      </View>}
                    </View>
                  }
                >
                  {!firmareIsUpToDate(myContext) || myContext.debug ?
                    <PressableScale className="bg-emerald-600 px-3 py-2 rounded-xl flex flex-row items-center space-x-2" onPress={() => setFirmwareModalVisible(true)}>
                      <Ionicons name="download-outline" size={18} color="white" />
                      <Text className="text-white">{t('common:update')}</Text>
                    </PressableScale>
                    :
                    <View className="flex flex-row items-center space-x-2">
                      <Text className="text-white">{t('common:upToDate')}</Text>
                      <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                    </View>
                  }
                </Row>
              }

              <Row label={t('common:clearImageCache')} hint={t('common:clearCacheDescription')}>
                {cacheIsCleared ?
                  <View className="flex flex-row items-center space-x-2">
                    <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                    <Text className="text-white">Ok !</Text>
                  </View>
                  :
                  <PressableScale className="bg-zinc-700 border border-zinc-600 px-3 py-2 rounded-xl flex flex-row items-center space-x-2" onPress={clearImageCache}>
                    <Ionicons name="trash" size={18} color="white" />
                    <Text className="text-white">{t('common:clearImageCache')}</Text>
                  </PressableScale>
                }
              </Row>

            </Section>

            {/* ---- Advanced ---- */}
            <Section title={t('common:advancedSection')}>

              <Row label={t('common:debugMode')} hint={t('common:debugDescription')}>
                <Switch
                  trackColor={{false: '#767577', true: 'rgb(5 150 105)'}}
                  thumbColor='#fff'
                  value={myContext.debug}
                  onValueChange={myContext.toggleDebug}
                />
              </Row>

              {myContext.debug &&
                <Row label={t('common:screenInfo')} hint={t('common:screenInfoDescription')}>
                  <Switch
                    trackColor={{false: '#767577', true: 'rgb(5 150 105)'}}
                    thumbColor='#fff'
                    value={myContext.screenInfo}
                    onValueChange={myContext.toggleScreenInfo}
                  />
                </Row>
              }

              {/* Offline mode shows the camera controls with no SUNSCAN behind
                  them: a diagnosis tool, out of the way of everyday use */}
              {myContext.debug &&
                <Row label={t('common:offlineMode')} hint={t('common:offlineDescription')}>
                  <Switch
                    trackColor={{false: '#767577', true: 'rgb(5 150 105)'}}
                    thumbColor='#fff'
                    value={myContext.demo}
                    onValueChange={myContext.toggleDemo}
                  />
                </Row>
              }

              {/* Linux desktop: only backends that know the route, on an image that has one */}
              {myContext.debug && desktop &&
                <Row
                  label={t('common:desktop')}
                  hint={
                    <View>
                      <Text className={hintClass} style={hintSize}>{t('common:desktopDescription')}</Text>
                      {!!desktopError && <Text className="text-amber-500 mt-1" style={hintSize}>{desktopError}</Text>}
                    </View>
                  }
                >
                  {desktopBusy && <ActivityIndicator size="small" color="#fff" style={{marginRight: 8}} />}
                  <Switch
                    trackColor={{false: '#767577', true: 'rgb(5 150 105)'}}
                    thumbColor='#fff'
                    disabled={desktopBusy}
                    value={!!desktop.running}
                    onValueChange={toggleDesktop}
                  />
                </Row>
              }

              {myContext.debug && desktop &&
                <Row label={t('common:desktopAtBoot')} hint={t('common:desktopAtBootDescription')}>
                  <Switch
                    trackColor={{false: '#767577', true: 'rgb(5 150 105)'}}
                    thumbColor='#fff'
                    disabled={desktopBusy}
                    value={!!desktop.at_boot}
                    onValueChange={(value) => switchDesktop({ at_boot: value })}
                  />
                </Row>
              }

            </Section>

            {/* ---- Stacking (debug only) ---- */}
            {myContext.debug &&
              <Section title={t('common:stackingConfiguration')}>

                <Row label={t('common:patchSize')}>
                  <TextInput
                    className="bg-zinc-800 border border-zinc-600 grow px-3 text-white rounded-xl"
                    style={{paddingVertical: 7}}
                    returnKeyLabel='OK'
                    returnKeyType='done'
                    keyboardType="numeric"
                    key="patchSize"
                    value={String(myContext.stackingOptions.patchSize)}
                    onChangeText={(value) => {myContext.setStackingOptions({
                      ...myContext.stackingOptions,
                      patchSize: Number(value)
                    }); setStackingOptReset(false);}}
                  />
                </Row>

                <Row label={t('common:stepSize')}>
                  <TextInput
                    className="bg-zinc-800 border border-zinc-600 grow px-3 text-white rounded-xl"
                    style={{paddingVertical: 7}}
                    keyboardType="numeric"
                    returnKeyLabel='OK'
                    returnKeyType='done'
                    value={String(myContext.stackingOptions.stepSize)}
                    key="stepSize"
                    onChangeText={(value) => {myContext.setStackingOptions({
                      ...myContext.stackingOptions,
                      stepSize: Number(value)
                    }); setStackingOptReset(false);}}
                  />
                </Row>

                <Row label={t('common:intensityThreshold')}>
                  <TextInput
                    className="bg-zinc-800 border border-zinc-600 grow px-3 text-white rounded-xl"
                    style={{paddingVertical: 7}}
                    key="intensityThreshold"
                    keyboardType="numeric"
                    returnKeyLabel='OK'
                    returnKeyType='done'
                    value={String(myContext.stackingOptions.intensityThreshold)}
                    onChangeText={(value) => {myContext.setStackingOptions({
                      ...myContext.stackingOptions,
                      intensityThreshold: Number(value)
                    }); setStackingOptReset(false);}}
                  />
                </Row>

                {!stackingOptReset &&
                  <FullRow>
                    <View className="flex flex-row justify-end">
                      <PressableScale className="bg-zinc-700 border border-zinc-600 px-3 py-2 rounded-xl flex flex-row items-center space-x-2" onPress={()=>{myContext.setStackingOptions({patchSize:32, stepSize:10, intensityThreshold:0}); setStackingOptReset(true);}}>
                        <Ionicons name="refresh" size={18} color="white" />
                        <Text className="text-white">{t('common:reset')}</Text>
                      </PressableScale>
                    </View>
                  </FullRow>
                }

              </Section>
            }

            {/* Credits */}
            <View className="mt-4 mb-16 px-1">
              <Text className="text-zinc-600 italic" style={hintSize}>Behind the SUNSCAN is a passionate and dedicated team: STAROS Projects. Five members each bring their unique expertise to bear on making the SUNSCAN a success : Guillaume BERTRAND, Christian BUIL, Valérie DESNOUX, Olivier GARDE et Matthieu LE LAIN</Text>
            </View>

          </ScrollView>
        </SafeAreaProvider>
      </View>
    </View>
  );
}
