import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import PressableScale from './PressableScale';
import { colors } from './theme';
import { normalizeApiURL } from '../utils/Discovery';

const hostOf = (url) => (url || '').split(':')[0];

const small = { fontSize: 12 };
const hint = { fontSize: 11 };

const iconBox = {
  width: 40,
  height: 40,
  borderRadius: 20,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255,255,255,0.08)',
};

const disclosureRow = { flexDirection: 'row', alignItems: 'center', marginTop: 12 };

function ActionButton({ icon, label, primary, disabled, onPress }) {
  return (
    <PressableScale
      className={primary
        ? 'bg-emerald-600 rounded-xl px-3 py-2 flex flex-row items-center'
        : 'bg-zinc-700 border border-zinc-600 rounded-xl px-3 py-2 flex flex-row items-center'}
      disabled={disabled}
      onPress={onPress}
    >
      <Ionicons name={icon} size={16} color="white" />
      <Text className="text-white ml-2" style={small}>{label}</Text>
    </PressableScale>
  );
}

/**
 * One card for the whole link between the phone and the SUNSCAN.
 *
 * It replaces the "hotspot mode" switch and the address field: the app finds
 * out by itself which network the box is on (useSunscanLink), so the card only
 * has to say where the SUNSCAN is and offer what makes sense there. The
 * address field stays, folded under "advanced", for a box without the network
 * API or plugged in Ethernet.
 *
 * `network` is the last /network/status read from the box (null until read),
 * `search` the {running, deep, progress, outcome} of useSunscanLink.
 */
export default function ConnectionCard({
  connected, network, apiURL, viaHotspot, hotspotName,
  search, onSearch, onCancelSearch,
  onConnectWifi, onBackToHotspot, busy,
  lanApiURL, onSaveAddress, advancedOpen, onToggleAdvanced,
}) {
  const { t } = useTranslation();
  const [address, setAddress] = useState(lanApiURL || '');
  useEffect(() => {
    setAddress(lanApiURL || '');
  }, [lanApiURL]);

  const saveAddress = () => {
    const url = normalizeApiURL(address);
    if (url) {
      setAddress(url);
      onSaveAddress(url);
    }
  };

  const supported = !!network?.supported;
  let state;
  let icon;
  let iconColor = 'white';
  let title;
  let subtitle = '';
  let note = '';
  if (!connected) {
    state = 'lost';
    icon = 'alert-circle-outline';
    iconColor = colors.warning;
    title = t('common:wifiLost');
  } else if (network?.mode === 'client') {
    state = 'wifi';
    icon = 'home-outline';
    title = t('common:linkWifiTitle');
    subtitle = `${network.ssid} · ${network.ip || hostOf(apiURL)}`;
  } else if (network?.mode === 'hotspot' || (viaHotspot && !supported)) {
    state = 'hotspot';
    icon = 'radio-outline';
    title = t('common:linkHotspotTitle');
    subtitle = `${network?.ssid || hotspotName} · ${hostOf(apiURL)}`;
    note = t('common:linkNoInternet');
  } else {
    // Older backend on the home network, or a switch in progress
    state = 'plain';
    icon = 'wifi';
    title = t('common:linkPlainTitle');
    subtitle = network?.mode === 'connecting' ? t('common:wifiModeConnecting') : hostOf(apiURL);
  }

  const progress = search?.progress;
  const searchingLabel = progress?.phase === 'scan' && progress?.total
    ? `${t('common:searching')} ${progress.scanned}/${progress.total}`
    : t('common:searching');

  return (
    <View className="px-4 py-3">
      <View className="flex flex-row items-start">
        <View style={iconBox}>
          <Ionicons name={icon} size={22} color={iconColor} />
        </View>
        <View className="flex-1 ml-3">
          <Text className="text-white font-bold">{title}</Text>
          {!!subtitle && <Text className="text-zinc-400 mt-0.5" style={small}>{subtitle}</Text>}
          {!!note && <Text className="text-amber-500 mt-1" style={hint}>{note}</Text>}

          {state === 'lost' && (
            <View className="mt-2">
              <Text className="text-zinc-400" style={small}>{t('common:linkLostHint', { hotspot: hotspotName })}</Text>
              <View className="flex flex-row flex-wrap items-center mt-3" style={{ gap: 8 }}>
                {search?.running ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text className="text-zinc-400" style={small}>{searchingLabel}</Text>
                    <ActionButton icon="close" label={t('common:cancel')} onPress={onCancelSearch} />
                  </>
                ) : (
                  <ActionButton icon="search" label={t('common:linkSearch')} primary onPress={onSearch} />
                )}
              </View>
              {/* Verdict of the search the user asked for. The quiet searches the
                  app runs by itself fail routinely (phone not yet on the hotspot) */}
              {!search?.running && search?.deep && search?.outcome === 'none' && (
                <Text className="text-amber-500 mt-2" style={hint}>{t('common:sunscanNotFound')}</Text>
              )}
            </View>
          )}

          {state !== 'lost' && supported && (
            <View className="flex flex-row flex-wrap mt-3" style={{ gap: 8 }}>
              {state === 'wifi' && (
                <ActionButton icon="radio-outline" label={t('common:wifiBackToHotspot')} disabled={busy} onPress={onBackToHotspot} />
              )}
              <ActionButton
                icon="wifi"
                label={t(state === 'wifi' ? 'common:wifiChange' : 'common:wifiConnectHome')}
                primary
                disabled={busy}
                onPress={onConnectWifi}
              />
            </View>
          )}

          <PressableScale style={disclosureRow} scaleTo={0.98} hitSlop={6} onPress={onToggleAdvanced}>
            <Ionicons name={advancedOpen ? 'chevron-down' : 'chevron-forward'} size={14} color="#71717a" />
            <Text className="text-zinc-500 ml-1" style={hint}>{t('common:linkAdvanced')}</Text>
          </PressableScale>
          {advancedOpen && (
            <View className="mt-2">
              <Text className="text-zinc-500 mb-2" style={hint}>{t('common:linkAddressHint')}</Text>
              <View className="flex flex-row items-center">
                <TextInput
                  className="bg-zinc-800 border border-zinc-600 grow text-white rounded-xl px-3"
                  style={{ paddingVertical: 7 }}
                  value={address}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  placeholder="192.168.1.50:8000"
                  placeholderTextColor="#71717a"
                  returnKeyLabel="OK"
                  returnKeyType="done"
                  onChangeText={setAddress}
                  onEndEditing={saveAddress}
                />
                <PressableScale className="bg-emerald-600 p-2 rounded-xl ml-2" onPress={saveAddress}>
                  <Ionicons name="checkmark" size={20} color="white" />
                </PressableScale>
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
