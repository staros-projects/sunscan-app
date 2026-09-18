import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';

import PressableScale from './PressableScale';
import { colors, modalBackdrop, modalCard, roundButton } from './theme';
import {
  DEFAULT_SUNSCAN_PORT,
  HOTSPOT_API_URL,
  HOTSPOT_RETURN_S,
  connectWifi,
  getNetworkStatus,
  isSecuritySupported,
  scanWifiNetworks,
  validateWifiCredentials,
  watchSunscanMdns,
  wifiErrorKey,
} from '../utils/SunscanNetwork';

// Joining the home wifi drops the hotspot the phone is on, so the answer can
// never come back on the request that asked for it. After the 202 we wait for
// one of two signs, whichever comes first:
//  - the SUNSCAN shows up on the home network (mDNS with its id, or its last
//    known address) -> success;
//  - its hotspot answers again with a failed attempt -> failure, with the reason.
// Nothing after switch_in + timeout + the hotspot return time: we lost track of
// it, and the user is told where to look.
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 2000;
// Before this, the phone is most likely still on the hotspot that is about to go
const PHONE_HINT_DELAY_MS = 5000;

// Signal 0-100 -> MaterialCommunityIcons wifi-strength-N
function signalIcon(signal, locked) {
  const level = signal < 30 ? 1 : signal < 55 ? 2 : signal < 75 ? 3 : 4;
  return `wifi-strength-${level}${locked ? '-lock' : ''}`;
}

const hostOf = (url) => (url || '').split(':')[0];

/**
 * Guides the user through moving the SUNSCAN from its hotspot to the home wifi.
 *
 * `status` is the /network/status read by the caller (device id, hotspot ssid).
 * `onConnected(url)` is called once the SUNSCAN has been found on the home
 * network, `onManualIp()` when the user gives up and wants to type the address.
 */
export default function WifiSetupModal({ visible, apiURL, status, lastIp, onClose, onConnected, onManualIp }) {
  const { t } = useTranslation();

  const [step, setStep] = useState('list'); // list | password | waiting | success | failed | lost
  const [scan, setScan] = useState({ loading: false, networks: [], cached: false, unreachable: false });
  const [selected, setSelected] = useState(null); // {ssid, security, hidden}
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [showPhoneHint, setShowPhoneHint] = useState(false);
  const [result, setResult] = useState(null); // {url} on success, {error} on failure
  // Bumped to (re)start the wait for the SUNSCAN
  const [waitRun, setWaitRun] = useState(0);
  // What the wait needs to know about the attempt it follows
  const attemptRef = useRef(null);

  const deviceId = status?.device_id;
  const hotspotSsid = status?.hotspot?.ssid || (deviceId ? `sunscan-${deviceId}` : 'sunscan');

  const runScan = useCallback(async (refresh = true) => {
    setScan((s) => ({ ...s, loading: true }));
    try {
      const json = await scanWifiNetworks(apiURL, { refresh });
      setScan({
        loading: false,
        networks: json.networks || [],
        cached: !!json.cached,
        unreachable: false,
      });
    } catch (e) {
      console.log('wifi scan failed', e?.message);
      setScan((s) => ({ ...s, loading: false, unreachable: true }));
    }
  }, [apiURL]);

  // Fresh start each time the pop-in opens. Keyed on `visible` only: a success
  // moves the app to the new address, which must not send the user back to
  // the list.
  const runScanRef = useRef(runScan);
  runScanRef.current = runScan;
  useEffect(() => {
    if (!visible) {
      return;
    }
    setStep('list');
    setSelected(null);
    setPassword('');
    setFormError(null);
    setResult(null);
    setScan({ loading: true, networks: [], cached: false, unreachable: false });
    runScanRef.current(true);
  }, [visible]);

  const choose = (network) => {
    setSelected(network);
    setPassword('');
    setShowPassword(false);
    setFormError(null);
    setStep('password');
  };

  const submit = async () => {
    const ssid = (selected?.ssid || '').trim();
    const code = validateWifiCredentials({ ssid, password, security: selected?.security, hotspotSsid });
    if (code) {
      setFormError(code);
      return;
    }
    setFormError(null);
    setIsSending(true);
    try {
      // Remember which attempt was last reported before this one, so that an
      // older failure still stored on the SUNSCAN is not mistaken for ours.
      let previousStartedAt = null;
      try {
        previousStartedAt = (await getNetworkStatus(apiURL))?.attempt?.started_at ?? null;
      } catch {}

      const answer = await connectWifi(apiURL, { ssid, password, hidden: !!selected?.hidden });
      if (!answer.accepted) {
        console.log('wifi connect refused', answer.error, answer.detail);
        setFormError(answer.error);
        return;
      }
      attemptRef.current = {
        ssid,
        previousStartedAt,
        durationMs: (answer.switchIn + answer.timeout + HOTSPOT_RETURN_S) * 1000,
      };
      setSelected((s) => ({ ...s, ssid }));
      setStep('waiting');
      setWaitRun((n) => n + 1);
    } catch (e) {
      console.log('wifi connect failed', e?.message);
      setFormError('unreachable');
    } finally {
      setIsSending(false);
    }
  };

  // The wait itself: mDNS watch + polling, until success, failure or deadline.
  useEffect(() => {
    if (step !== 'waiting' || !attemptRef.current) {
      return undefined;
    }
    const { ssid, previousStartedAt, durationMs } = attemptRef.current;
    let finished = false;
    let timer = null;

    const finish = (nextStep, value) => {
      if (finished) {
        return;
      }
      finished = true;
      setResult(value);
      setStep(nextStep);
      if (nextStep === 'success') {
        onConnected(value.url);
      }
    };

    // A SUNSCAN found somewhere only counts once it says it is on the network
    // asked for: when it was already on another home network, its old address
    // keeps answering until the switch actually happens.
    const confirmOnTarget = (url) =>
      getNetworkStatus(url, POLL_TIMEOUT_MS)
        .then((s) => {
          if ((!deviceId || s?.device_id === deviceId) && s?.mode === 'client' && s?.ssid === ssid) {
            finish('success', { url });
          }
        })
        .catch(() => {});

    setShowPhoneHint(false);
    const hintTimer = setTimeout(() => setShowPhoneHint(true), PHONE_HINT_DELAY_MS);
    const stopMdns = watchSunscanMdns({ deviceId, onFound: ({ url }) => confirmOnTarget(url) });

    const deadline = Date.now() + durationMs;
    const poll = async () => {
      if (finished) {
        return;
      }
      if (Date.now() > deadline) {
        finish('lost', null);
        return;
      }
      const checks = [
        // Back on the hotspot: the attempt tells how it ended
        getNetworkStatus(HOTSPOT_API_URL, POLL_TIMEOUT_MS)
          .then((s) => {
            const attempt = s?.attempt;
            if (
              attempt?.state === 'failed' &&
              attempt.ssid === ssid &&
              attempt.started_at !== previousStartedAt
            ) {
              console.log('wifi attempt failed', attempt.error, attempt.detail);
              finish('failed', { error: attempt.error });
            }
          })
          .catch(() => {}),
      ];
      // Most boxes give the same address back: no need to wait for mDNS then
      if (lastIp) {
        checks.push(confirmOnTarget(`${lastIp}:${DEFAULT_SUNSCAN_PORT}`));
      }
      await Promise.all(checks);
      if (!finished) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };
    // The SUNSCAN only leaves its hotspot after switch_in: polling right away
    // would just read back the "connecting" state.
    timer = setTimeout(poll, POLL_INTERVAL_MS);

    return () => {
      finished = true;
      clearTimeout(timer);
      clearTimeout(hintTimer);
      stopMdns();
    };
    // onConnected is deliberately left out: a new callback identity from the
    // parent must not restart the wait.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, waitRun, deviceId, lastIp]);

  const searchAgain = () => {
    if (attemptRef.current) {
      // Deadline counted from now; the attempt itself is over by now, only the
      // phone may still be on its way to the right network.
      attemptRef.current = { ...attemptRef.current, durationMs: HOTSPOT_RETURN_S * 2 * 1000 };
    }
    setStep('waiting');
    setWaitRun((n) => n + 1);
  };

  const canClose = step !== 'waiting' && !isSending;
  const ssid = selected?.ssid || '';

  const renderList = () => (
    <>
      <Header
        title={t('common:wifiChooseNetwork')}
        onClose={onClose}
        right={
          <PressableScale style={roundButton} disabled={scan.loading} onPress={() => runScan(true)}>
            <Ionicons name="refresh" size={16} color="white" />
          </PressableScale>
        }
      />
      {scan.cached && !scan.loading && (
        <Notice text={t('common:wifiScanCached')} action={t('common:wifiRetry')} onPress={() => runScan(true)} />
      )}
      {scan.unreachable && !scan.loading && (
        <Notice text={t('common:wifiUnreachable')} action={t('common:wifiRetry')} onPress={() => runScan(true)} />
      )}
      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={scan.loading} onRefresh={() => runScan(true)} tintColor="#fff" colors={[colors.accent]} />}
      >
        {scan.loading && !scan.networks.length && (
          <View className="flex flex-row items-center justify-center py-6">
            <ActivityIndicator size="small" color="#fff" />
            <Text className="text-zinc-400 ml-3" style={{ fontSize: 12 }}>{t('common:wifiScanning')}</Text>
          </View>
        )}
        {!scan.loading && !scan.unreachable && !scan.networks.length && (
          <Text className="text-zinc-500 text-center py-6" style={{ fontSize: 12 }}>{t('common:wifiNoNetwork')}</Text>
        )}
        {scan.networks.map((network) => {
          const supported = isSecuritySupported(network.security);
          return (
            <PressableScale
              key={network.ssid}
              scaleTo={0.98}
              disabled={!supported}
              onPress={() => choose({ ssid: network.ssid, security: network.security, hidden: false })}
              style={[styles.networkRow, !supported && { opacity: 0.4 }]}
            >
              <MaterialCommunityIcons
                name={signalIcon(network.signal, network.security !== 'open')}
                size={20}
                color="white"
              />
              <Text className="text-white ml-3 flex-1" numberOfLines={1}>{network.ssid}</Text>
              {network.in_use && <Tag text={t('common:wifiInUse')} accent />}
              {network.saved && !network.in_use && <Tag text={t('common:wifiSaved')} />}
              {!supported && <Tag text={t('common:wifiUnsupported')} />}
              <Text className="text-zinc-500 ml-2" style={{ fontSize: 10 }}>{network.band}</Text>
            </PressableScale>
          );
        })}
        <PressableScale
          scaleTo={0.98}
          style={styles.networkRow}
          onPress={() => choose({ ssid: '', security: undefined, hidden: true })}
        >
          <Ionicons name="add" size={20} color="#a1a1aa" />
          <Text className="text-zinc-300 ml-3">{t('common:wifiOtherNetwork')}</Text>
        </PressableScale>
      </ScrollView>
    </>
  );

  const renderPassword = () => {
    const needsPassword = selected?.security !== 'open';
    return (
      <>
        <Header title={selected?.hidden ? t('common:wifiOtherNetwork') : ssid} onBack={() => setStep('list')} onClose={onClose} />
        <View style={{ gap: 10 }}>
          {selected?.hidden && (
            <TextInput
              style={styles.input}
              value={ssid}
              placeholder={t('common:wifiSsid')}
              placeholderTextColor="#71717a"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              onChangeText={(value) => setSelected((s) => ({ ...s, ssid: value }))}
            />
          )}
          {needsPassword && (
            <View className="flex flex-row items-center">
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={password}
                placeholder={selected?.hidden ? t('common:wifiPasswordOptional') : t('common:wifiPassword')}
                placeholderTextColor="#71717a"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={!selected?.hidden}
                returnKeyType="go"
                onSubmitEditing={submit}
                onChangeText={setPassword}
              />
              <PressableScale style={[roundButton, { marginLeft: 8, width: 38, height: 38, borderRadius: 19 }]} onPress={() => setShowPassword((v) => !v)}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color="white" />
              </PressableScale>
            </View>
          )}
          {!!formError && (
            <Text style={styles.error}>
              {formError === 'unreachable' ? t('common:wifiUnreachable') : t(wifiErrorKey(formError))}
            </Text>
          )}
          <PressableScale
            className="bg-emerald-600 rounded-xl h-10 flex flex-row items-center justify-center"
            disabled={isSending}
            onPress={submit}
          >
            {isSending
              ? <ActivityIndicator size="small" color="white" />
              : <Text className="text-white font-bold">{t('common:wifiConnect')}</Text>}
          </PressableScale>
        </View>
      </>
    );
  };

  const renderWaiting = () => (
    <View className="items-center py-2">
      <ActivityIndicator size="large" color="#fff" />
      <Text style={styles.title}>{t('common:wifiJoining', { ssid })}</Text>
      <Text style={styles.hint}>{t('common:wifiJoiningHint')}</Text>
      {showPhoneHint && (
        <>
          <Text style={[styles.subtitle, { marginTop: 14 }]}>{t('common:wifiPutPhoneOn', { ssid })}</Text>
          {Platform.OS === 'android' && <OpenWifiSettings label={t('common:wifiOpenWifiSettings')} />}
        </>
      )}
    </View>
  );

  const renderSuccess = () => (
    <View className="items-center py-2">
      <Ionicons name="checkmark-circle" size={40} color={colors.accent} />
      <Text style={styles.title}>{t('common:wifiConnected', { ssid })}</Text>
      <Text style={styles.subtitle}>{t('common:wifiConnectedHint', { url: hostOf(result?.url) })}</Text>
      <Button label={t('common:wifiClose')} onPress={onClose} primary />
    </View>
  );

  const renderFailed = () => (
    <View className="items-center py-2">
      <Ionicons name="warning-outline" size={36} color={colors.warning} />
      <Text style={styles.title}>{t(wifiErrorKey(result?.error))}</Text>
      <Text style={styles.subtitle}>{t('common:wifiFailedHint', { hotspot: hotspotSsid })}</Text>
      <View className="flex flex-row" style={{ gap: 10 }}>
        <Button label={t('common:wifiClose')} onPress={onClose} />
        <Button label={t('common:wifiRetry')} primary onPress={() => { setFormError(null); setStep('password'); }} />
      </View>
    </View>
  );

  const renderLost = () => (
    <View className="items-center py-2">
      <Ionicons name="help-circle-outline" size={36} color={colors.warning} />
      <Text style={styles.title}>{t('common:wifiLost')}</Text>
      <Text style={styles.subtitle}>{t('common:wifiLostPhone', { ssid })}</Text>
      <Text style={styles.subtitle}>{t('common:wifiLostHotspot', { hotspot: hotspotSsid })}</Text>
      {Platform.OS === 'android' && <OpenWifiSettings label={t('common:wifiOpenWifiSettings')} />}
      <View className="flex flex-row" style={{ gap: 10 }}>
        <Button label={t('common:wifiEnterIp')} onPress={onManualIp} />
        <Button label={t('common:wifiSearchAgain')} primary onPress={searchAgain} />
      </View>
    </View>
  );

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      supportedOrientations={['landscape']}
      // No way out while waiting: the result is what tells the app where the
      // SUNSCAN went.
      onRequestClose={() => { if (canClose) onClose(); }}
    >
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          {step === 'list' && renderList()}
          {step === 'password' && renderPassword()}
          {step === 'waiting' && renderWaiting()}
          {step === 'success' && renderSuccess()}
          {step === 'failed' && renderFailed()}
          {step === 'lost' && renderLost()}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Header({ title, onBack, onClose, right }) {
  return (
    <View className="flex flex-row items-center mb-3">
      {onBack && (
        <PressableScale style={[roundButton, { marginRight: 10 }]} onPress={onBack}>
          <Ionicons name="chevron-back" size={16} color="white" />
        </PressableScale>
      )}
      <Text className="text-white font-bold flex-1" style={{ fontSize: 15 }} numberOfLines={1}>{title}</Text>
      {right}
      <PressableScale style={[roundButton, { marginLeft: 8 }]} onPress={onClose}>
        <Ionicons name="close" size={16} color="white" />
      </PressableScale>
    </View>
  );
}

function Notice({ text, action, onPress }) {
  return (
    <View className="flex flex-row items-center px-3 py-2 mb-2 rounded-xl" style={{ backgroundColor: 'rgba(251,191,36,0.12)' }}>
      <Text className="flex-1" style={{ color: colors.warning, fontSize: 12 }}>{text}</Text>
      <PressableScale className="bg-zinc-700 rounded-lg px-3 py-1 ml-2" onPress={onPress}>
        <Text className="text-white" style={{ fontSize: 12 }}>{action}</Text>
      </PressableScale>
    </View>
  );
}

function Tag({ text, accent }) {
  return (
    <View className={`${accent ? 'bg-emerald-700' : 'bg-zinc-700'} rounded-md px-2 ml-2`} style={{ paddingVertical: 1 }}>
      <Text className="text-white" style={{ fontSize: 10 }}>{text}</Text>
    </View>
  );
}

function Button({ label, onPress, primary }) {
  return (
    <PressableScale
      className={`${primary ? 'bg-emerald-600' : 'bg-zinc-700'} rounded-xl mt-4 px-5 h-10 flex flex-row items-center justify-center`}
      onPress={onPress}
    >
      <Text className="text-white font-bold" style={{ fontSize: 13 }}>{label}</Text>
    </PressableScale>
  );
}

function OpenWifiSettings({ label }) {
  return (
    <PressableScale
      className="bg-zinc-700 border border-zinc-600 rounded-xl mt-3 px-4 h-9 flex flex-row items-center"
      onPress={() => Linking.sendIntent('android.settings.WIFI_SETTINGS').catch(() => Linking.openSettings())}
    >
      <Ionicons name="wifi" size={16} color="white" />
      <Text className="text-white ml-2" style={{ fontSize: 12 }}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  backdrop: modalBackdrop,
  card: {
    ...modalCard,
    width: 520,
    maxWidth: '92%',
    maxHeight: '92%',
    padding: 18,
  },
  list: {
    flexGrow: 0,
  },
  networkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  input: {
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#52525b',
    borderRadius: 12,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 12,
    textAlign: 'center',
  },
  subtitle: {
    color: '#d4d4d8',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  hint: {
    color: '#71717a',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  error: {
    color: '#f87171',
    fontSize: 12,
  },
});
