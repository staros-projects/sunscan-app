import React, { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {  ActivityIndicator, Alert, Button, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons'

import { NativeWindStyleSheet } from "nativewind";

import * as Application from 'expo-application';
import AppContext from '../components/AppContext';

import { Asset, useAssets } from 'expo-asset';
import { useTranslation } from 'react-i18next';
import { t, use } from 'i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import firmareIsUpToDate from '../utils/Helpers';
import { backend_current_version } from '../utils/Helpers';
import { discoverSunscan, normalizeApiURL } from '../utils/Discovery';
import PressableScale from '../components/PressableScale';
import WifiSetupModal from '../components/WifiSetupModal';
import { forgetWifi, getNetworkStatus, switchToHotspot } from '../utils/SunscanNetwork';

NativeWindStyleSheet.setOutput({
  default: "native",
});

// Firmware payload pushed to the SUNSCAN. Kept at module scope so the prefetch
// (useAssets) and the upload (Asset.fromModule) refer to the very same asset.
const FIRMWARE_ZIP = require('../assets/sunscan_backend_source.zip');

// The SUNSCAN restarts its backend as soon as it has unpacked the archive, so
// the HTTP response of /update is regularly lost. These bound the upload and
// the "did it actually land?" probe that follows a dropped connection.
const FIRMWARE_UPLOAD_TIMEOUT_MS = 120000;
const FIRMWARE_PROBE_TIMEOUT_MS = 60000;
const FIRMWARE_PROBE_INTERVAL_MS = 3000;

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

export default function SettingsScreen({navigation, isFocused}) {

  // Get the global variables & functions via context
  const myContext = useContext(AppContext);
  const [apiInput, setAPIInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cacheIsCleared, setCacheIsCleared] = useState(false);
  const [sunscanIsShutdown, setSunscanIsShutdown] = useState(false);
  const [sunscanIsReboot, setSunscanIsReboot] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState(null);
  // /network/status of the connected SUNSCAN (null until read / when unreachable)
  const [netStatus, setNetStatus] = useState(null);
  const [wifiModalVisible, setWifiModalVisible] = useState(false);
  const [wifiBusy, setWifiBusy] = useState(false);


  // Prefetch the firmware update ZIP file so the upload does not have to wait
  const [assetZipPath, error] = useAssets([FIRMWARE_ZIP]);
  const [isUpdatingFirmware, setIsUpdatingFirmware] = useState(false);

  // Initialize translation hook
  const { t, i18n } = useTranslation();
  const [lang, changeLang] = useState('en');
  const selectedLanguageCode = i18n.language;

  // Ask the SUNSCAN which backend version it currently runs. Returns null when
  // the device is unreachable, which during an update simply means "not back yet".
  const readBackendVersion = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FIRMWARE_PROBE_INTERVAL_MS);
    try {
      const response = await fetch('http://' + myContext.apiURL + '/sunscan/stats', {
        signal: controller.signal,
      });
      const json = await response.json();
      return json?.backend_api_version || null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  // The device drops the connection while it restarts, so a network error on
  // /update tells us nothing. Poll the stats endpoint until the backend answers
  // again and report what version actually ended up installed.
  const probeFirmwareAfterRestart = async () => {
    const deadline = Date.now() + FIRMWARE_PROBE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const version = await readBackendVersion();
      if (version) {
        myContext.setBackendApiVersion(version);
        return firmareIsUpToDate({ backendApiVersion: version });
      }
      await new Promise((resolve) => setTimeout(resolve, FIRMWARE_PROBE_INTERVAL_MS));
    }
    return false;
  };

  // Function to update firmware
  const runFirmwareUpdate = async () => {
    setIsUpdatingFirmware(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FIRMWARE_UPLOAD_TIMEOUT_MS);
    try {
      // useAssets may not have finished yet, and in a production build the
      // asset only has a bundle URI until it is downloaded. Without a readable
      // file:// URI the native layer fails the multipart part, which surfaces
      // as the same generic "Network request failed" as a real network issue.
      const asset = Asset.fromModule(FIRMWARE_ZIP);
      if (!asset.localUri) {
        await asset.downloadAsync();
      }
      const uri = asset.localUri || asset.uri;
      if (!uri) {
        Alert.alert(t('common:warning'), t('common:firmwareUpdateUnconfirmed'));
        return;
      }

      // Create FormData and append the ZIP file.
      // Content-Type is deliberately left unset: React Native builds the
      // multipart body itself and needs to attach its own boundary.
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: 'sunscan_backend_source.zip',
        type: 'application/zip',
      });

      // Send the ZIP file to the FastAPI server
      const response = await fetch('http://' + myContext.apiURL + '/update', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      // Handle the response
      if (response.ok) {
        Alert.alert(t('common:success'), t('common:firmwarePostUpdateMessage'));
      } else {
        const detail = await response.text();
        Alert.alert(t('common:warning'), detail || `HTTP ${response.status}`);
      }
    } catch (e) {
      // fetch rejects with a generic "Network request failed" for every
      // transport failure, including the backend closing the socket while it
      // restarts on a successful update. Check the device before crying wolf.
      console.log('firmware update request failed:', e?.message);
      const updated = await probeFirmwareAfterRestart();
      if (updated) {
        Alert.alert(t('common:success'), t('common:firmwarePostUpdateMessage'));
      } else {
        Alert.alert(t('common:warning'), t('common:firmwareUpdateUnconfirmed'));
      }
    } finally {
      clearTimeout(timer);
      setIsUpdatingFirmware(false);
    }
  };

  const updateFirmware = () => {
    if (isUpdatingFirmware) {
      return;
    }
    Alert.alert(t('common:warning'), t('common:updateFirmwareconfirm'), [
      {
        text: t('common:cancel'),
        style: 'cancel',
      },
      { text: 'OK', onPress: runFirmwareUpdate }]);
  }

  // Update apiInput when the stored custom IP changes
  useEffect(()=>{
    setAPIInput(myContext.customApiURL || myContext.apiURL);
  }, [myContext.customApiURL, myContext.apiURL]);

  const saveCustomApiURL = () => {
    const url = normalizeApiURL(apiInput);
    if (!url) {
      return;
    }
    setAPIInput(url);
    myContext.setCustomApiURL(url);
  };

  // Scan the local network for a SUNSCAN and store the address it is found at.
  // Each run owns its own cancel flag: a cancelled scan keeps running until the
  // end of its current batch, so it must never be able to report over a newer
  // one (or be resurrected by it).
  const searchRunRef = useRef(null);

  const searchSunscan = async () => {
    const run = { cancelled: false };
    searchRunRef.current = run;
    setIsSearching(true);
    setSearchProgress(null);
    try {
      const found = await discoverSunscan({
        deviceId: myContext.sunscanDevice?.id,
        lastIp: myContext.sunscanDevice?.lastIp,
        onProgress: (progress) => {
          if (searchRunRef.current === run) {
            setSearchProgress(progress);
          }
        },
        isCancelled: () => run.cancelled,
      });
      if (searchRunRef.current !== run) {
        return;
      }
      if (found) {
        setAPIInput(found.url);
        myContext.setCustomApiURL(found.url);
        Alert.alert(t('common:success'), t('common:sunscanFound', { url: found.url }));
      } else {
        Alert.alert(t('common:searchSunscan'), t('common:sunscanNotFound'));
      }
    } catch (e) {
      if (searchRunRef.current === run) {
        Alert.alert(t('common:searchSunscan'), `${e.message}`);
      }
    } finally {
      if (searchRunRef.current === run) {
        searchRunRef.current = null;
        setIsSearching(false);
        setSearchProgress(null);
      }
    }
  };

  const cancelSearch = () => {
    if (searchRunRef.current) {
      searchRunRef.current.cancelled = true;
      searchRunRef.current = null;
    }
    setIsSearching(false);
    setSearchProgress(null);
  };

  // Stop a scan still in flight when leaving the screen
  useEffect(() => () => {
    if (searchRunRef.current) {
      searchRunRef.current.cancelled = true;
      searchRunRef.current = null;
    }
  }, []);

  // --- Home wifi ------------------------------------------------------------

  const { apiURL, sunscanIsConnected, setSunscanDevice, setCustomApiURL, setHotSpotMode } = myContext;

  const refreshNetworkStatus = useCallback(async () => {
    if (!sunscanIsConnected) {
      return;
    }
    try {
      const status = await getNetworkStatus(apiURL);
      setNetStatus(status);
      if (status?.device_id) {
        // Keep the identity of the SUNSCAN and its home address: they are what
        // finds it again once it has left the hotspot.
        const lastIp = status.mode === 'client' ? status.ip : status.last_client?.ip;
        setSunscanDevice((prev) => (
          prev?.id === status.device_id && (!lastIp || prev?.lastIp === lastIp)
            ? prev
            : { ...prev, id: status.device_id, lastIp: lastIp || prev?.lastIp }
        ));
      }
    } catch (e) {
      console.log('network status unavailable', e?.message);
    }
  }, [apiURL, sunscanIsConnected, setSunscanDevice]);

  useFocusEffect(
    useCallback(() => {
      refreshNetworkStatus();
    }, [refreshNetworkStatus]));

  // The SUNSCAN has been found on the home wifi: point the app at it
  const onWifiConnected = useCallback((url) => {
    setCustomApiURL(url);
    setHotSpotMode(false);
    setSunscanDevice((prev) => ({ ...prev, lastIp: url.split(':')[0] }));
  }, [setCustomApiURL, setHotSpotMode, setSunscanDevice]);

  const onWifiManualIp = () => {
    setWifiModalVisible(false);
    setHotSpotMode(false);
  };

  const closeWifiModal = () => {
    setWifiModalVisible(false);
    refreshNetworkStatus();
  };

  const hotspotName = netStatus?.hotspot?.ssid || 'sunscan';

  // Both actions below drop the SUNSCAN back to its hotspot: the app follows,
  // and the user has to put the phone back on it.
  const followToHotspot = () => {
    setHotSpotMode(true);
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

  const wifiModeLabel = () => {
    switch (netStatus?.mode) {
      case 'hotspot':
        return t('common:wifiModeHotspot', { ssid: netStatus.ssid });
      case 'client':
        return t('common:wifiModeClient', { ssid: netStatus.ssid, ip: netStatus.ip });
      case 'connecting':
        return t('common:wifiModeConnecting');
      default:
        return t('common:wifiModeDisconnected');
    }
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

            </Section>

            {/* ---- Connection ---- */}
            <Section title={t('common:connectionSection')}>

              <Row label={t('common:hotspotMode')} hint={t('common:hotspotDescription')}>
                <Switch
                  trackColor={{false: '#767577', true: 'rgb(5 150 105)'}}
                  thumbColor='#fff'
                  value={myContext.hotSpotMode}
                  onValueChange={(value) => myContext.setHotSpotMode(value)}
                />
              </Row>

              {!myContext.hotSpotMode &&
                <Row label={t('common:sunscanIP')} hint={t('common:sunscanIPDescription')}>
                  <View className="flex-1 flex flex-col items-end space-y-2">
                    <View className="flex flex-row items-center w-full">
                      <TextInput
                        className="bg-zinc-800 border border-zinc-600 grow text-white rounded-xl px-3"
                        style={{paddingVertical: 7}}
                        key="customApiURL"
                        value={apiInput}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        placeholder="192.168.1.50:8000"
                        placeholderTextColor="#71717a"
                        editable={!isSearching}
                        returnKeyLabel='OK'
                        returnKeyType='done'
                        onChangeText={setAPIInput}
                        onEndEditing={saveCustomApiURL}
                      />
                      <PressableScale className="bg-emerald-600 p-2 rounded-xl ml-2" onPress={saveCustomApiURL}>
                        <Ionicons name="checkmark" size={20} color="white" />
                      </PressableScale>
                    </View>

                    {/* Automatic discovery on the local network */}
                    {!isSearching ?
                      <PressableScale className="bg-zinc-700 border border-zinc-600 rounded-xl px-3 py-2 flex flex-row items-center" onPress={searchSunscan}>
                        <Ionicons name="search" size={16} color="white" />
                        <Text className="text-white ml-2" style={{fontSize:12}}>{t('common:searchSunscan')}</Text>
                      </PressableScale>
                      :
                      <View className="flex flex-row items-center">
                        <ActivityIndicator size="small" color="#fff" />
                        <Text className="text-zinc-400 ml-2" style={{fontSize:12}}>
                          {searchProgress?.phase === 'scan' && searchProgress?.total
                            ? `${t('common:searching')} ${searchProgress.scanned}/${searchProgress.total}`
                            : t('common:searching')}
                        </Text>
                        <PressableScale className="ml-3 bg-zinc-700 border border-zinc-600 rounded-xl px-3 py-1" onPress={cancelSearch}>
                          <Text className="text-white" style={{fontSize:12}}>{t('common:cancel')}</Text>
                        </PressableScale>
                      </View>
                    }
                  </View>
                </Row>
              }

              {/* Home wifi: only backends with NetworkManager support it */}
              {myContext.sunscanIsConnected && netStatus?.supported &&
                <Row label={t('common:wifiNetwork')} hint={wifiModeLabel()}>
                  <View className="flex flex-row flex-wrap justify-end" style={{gap: 8}}>
                    {netStatus.mode === 'client' &&
                      <PressableScale className="bg-zinc-700 border border-zinc-600 rounded-xl px-3 py-2 flex flex-row items-center" disabled={wifiBusy} onPress={backToHotspot}>
                        <Ionicons name="radio-outline" size={16} color="white" />
                        <Text className="text-white ml-2" style={{fontSize:12}}>{t('common:wifiBackToHotspot')}</Text>
                      </PressableScale>
                    }
                    <PressableScale className="bg-emerald-600 rounded-xl px-3 py-2 flex flex-row items-center" disabled={wifiBusy} onPress={() => setWifiModalVisible(true)}>
                      <Ionicons name="wifi" size={16} color="white" />
                      <Text className="text-white ml-2" style={{fontSize:12}}>{t('common:wifiConnectHome')}</Text>
                    </PressableScale>
                  </View>
                </Row>
              }

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
                    <PressableScale className={`${isUpdatingFirmware ? 'bg-red-900' : 'bg-red-600'} px-3 py-2 rounded-xl flex flex-row items-center space-x-2`} disabled={isUpdatingFirmware} onPress={updateFirmware}>
                      {isUpdatingFirmware
                        ? <ActivityIndicator size="small" color="white" />
                        : <Ionicons name="refresh" size={18} color="white" />}
                      <Text className="text-white">{isUpdatingFirmware ? t('common:firmwareUpdating') : t('common:update')}</Text>
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

              <Row label={t('common:offlineMode')} hint={t('common:offlineDescription')}>
                <Switch
                  trackColor={{false: '#767577', true: 'rgb(5 150 105)'}}
                  thumbColor='#fff'
                  value={myContext.demo}
                  onValueChange={myContext.toggleDemo}
                />
              </Row>

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
