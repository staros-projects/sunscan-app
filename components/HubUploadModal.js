import { useContext, useEffect, useRef, useState } from 'react';
// React Native's ScrollView, not gesture-handler's: a Modal is a window of its
// own on Android, outside the app's GestureHandlerRootView, where the
// gesture-handler one can keep the touches from the buttons it holds.
import { ActivityIndicator, Linking, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';

import AppContext from './AppContext';
import PressableScale from './PressableScale';
import HubLoginForm from './HubLoginForm';
import { linesDict } from './LineSelector';
import { modalBackdrop, modalCard, roundButton, warningChip } from './theme';
import { getHubScan, hubErrorKey, hubFilename, hubStepKey } from '../utils/SpectroSolHub';
import { getNetworkStatus } from '../utils/SunscanNetwork';

const ACCENT = '#10b981';
const THUMB = 74;

const formatSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// Default title as the backend builds it, "<line> - <date>", rebuilt here so
// it follows a line corrected by the user.
const defaultTitle = (line, observationDate) =>
  [line?.hub_label || line?.label, (observationDate || '').slice(0, 10)].filter(Boolean).join(' - ');

const lineLabel = (line) => line?.hub_label || line?.label || '';

// Title proposed for `line`. A stack or an animation whose date is known gets
// a longer one from the backend ("H-alpha - 2026-09-18 - stack of 2 scans"):
// only its line prefix follows the user's choice. Otherwise "<line> - <date>",
// `day` being the date the user typed when the backend does not know it.
const titleFor = (data, line, day) => {
  const dateKnown = data.defaults?.date_known !== false;
  if (data.type && data.type !== 'scan' && dateKnown) {
    const title = data.defaults?.title || '';
    const prefix = lineLabel(data.lines.find(l => l.key === data.defaults?.line));
    return prefix && title.startsWith(prefix) ? lineLabel(line) + title.slice(prefix.length) : title;
  }
  return defaultTitle(line, dateKnown ? data.defaults?.observation_date : day);
};

// Observation date typed by the user, in UTC, as the backend wants it
// (YYYY-MM-DDTHH:MM:SSZ), or null while incomplete or impossible.
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const typedObservationDate = (day, time) => {
  const d = DAY_RE.exec(day.trim());
  const h = TIME_RE.exec(time.trim());
  if (!d || !h) return null;
  const [year, month, date] = [+d[1], +d[2], +d[3]];
  const [hours, minutes, seconds] = [+h[1], +h[2], +(h[3] || 0)];
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  const utc = new Date(Date.UTC(year, month - 1, date, hours, minutes, seconds));
  // Date.UTC rolls 2025-02-30 over to March: a date that does not exist comes back different
  if (utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== date) return null;
  if (utc.getTime() > Date.now()) return null;
  return utc.toISOString().replace(/\.\d{3}Z$/, 'Z');
};

// Day and time (UTC) the item was created, from `creation_date` (seconds), as
// a starting point for the user: a stack is usually made shortly after its
// scans, but may be made months later, hence the watermark shown next to it.
const creationDayTime = (item) => {
  const seconds = Number(item?.creation_date);
  if (!seconds) return ['', ''];
  const iso = new Date(seconds * 1000).toISOString();
  return [iso.slice(0, 10), iso.slice(11, 16)];
};

/**
 * Sends the images of one scan, stack or animation to SpectroSolHub (`scan`
 * is any of them, see hubFilename). The SUNSCAN does the upload;
 * `upload` is the useHubUpload state of the caller, which outlives this panel
 * so that closing it does not stop following the upload.
 */
export default function HubUploadModal({ scan, upload, isVisible, onClose, onOpenWifiSettings }) {
  const { t } = useTranslation();
  const myContext = useContext(AppContext);
  const { apiURL, hubAccount, refreshHubAccount } = myContext;

  const [loading, setLoading] = useState(false);
  const [prepareError, setPrepareError] = useState(null);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [line, setLine] = useState(null);
  const [title, setTitle] = useState('');
  const [titleEdited, setTitleEdited] = useState(false);
  const [notes, setNotes] = useState('');
  const [publish, setPublish] = useState(true);
  const [lineConfirmed, setLineConfirmed] = useState(false);
  const [inHotspot, setInHotspot] = useState(false);
  // Observation date of a stack or an animation older than the backend that
  // records it: its folder bears the date it was made, which may be months
  // later, so the user is asked rather than a date guessed.
  const [obsDay, setObsDay] = useState('');
  const [obsTime, setObsTime] = useState('');
  const [bigPreview, setBigPreview] = useState(false);
  // What was asked for, to tell a refused publication from a chosen draft.
  const requestedPublish = useRef(null);

  const connected = !!hubAccount?.connected;
  const isRunning = upload.status === 'processing';
  const isDone = upload.status === 'completed' || upload.status === 'failed';

  const prepare = async () => {
    setLoading(true);
    setPrepareError(null);
    const result = await getHubScan(apiURL, hubFilename(scan));
    setLoading(false);
    if (!result.ok) {
      console.warn('hub scan unavailable', result.error, result.detail);
      setPrepareError(result.error);
      return;
    }
    const d = result.data;
    setData(d);
    setSelected(d.images.filter(i => i.default).map(i => i.kind));
    const initialLine = d.lines.find(l => l.key === d.defaults?.line) || d.lines[0] || null;
    setLine(initialLine);
    // Date unknown to the backend: prefilled with the creation date, to be
    // checked against the watermark
    const [day, time] = d.defaults?.date_known === false ? creationDayTime(scan) : ['', ''];
    setObsDay(day);
    setObsTime(time);
    setBigPreview(false);
    setTitle(titleFor(d, initialLine, day) || d.defaults?.title || '');
    setTitleEdited(false);
    // A proposal only: an emptied field sends no notes.
    setNotes(d.defaults?.notes || '');
    // Animations go out as GIF, which the hub was never seen to accept: a
    // first try stays a draft, and a refusal leaves no public trace.
    setPublish(d.type === 'animation' ? false : d.defaults?.publish !== false);
    setLineConfirmed(d.defaults?.line_from_tag !== false);
  };

  // Everything is read again at each opening: the scan may have been
  // reprocessed or sent since, and the SUNSCAN may have changed network.
  useEffect(() => {
    if (!isVisible || !scan) {
      return;
    }
    refreshHubAccount();
    prepare();
    setInHotspot(false);
    getNetworkStatus(apiURL)
      .then(status => setInHotspot(status?.mode === 'hotspot'))
      .catch(() => {});
  }, [isVisible, hubFilename(scan)]);

  // An expired or missing account is only learnt from an upload: ask for it
  // again, which brings up the sign-in form.
  useEffect(() => {
    if (upload.status === 'failed' && (upload.errorKey === 'token_expired' || upload.errorKey === 'not_connected')) {
      refreshHubAccount();
    }
  }, [upload.status, upload.errorKey]);

  const pickLine = (l) => {
    setLine(l);
    setLineConfirmed(true);
    if (!titleEdited && data) {
      setTitle(titleFor(data, l, obsDay.trim()));
    }
  };

  const changeObsDay = (v) => {
    setObsDay(v);
    if (!titleEdited && data) {
      setTitle(titleFor(data, line, DAY_RE.test(v.trim()) ? v.trim() : ''));
    }
  };

  const toggleImage = (kind) =>
    setSelected(prev => prev.includes(kind) ? prev.filter(k => k !== kind) : [...prev, kind]);

  const dateKnown = data?.defaults?.date_known !== false;
  const observationDate = dateKnown ? null : typedObservationDate(obsDay, obsTime);

  const send = () => {
    requestedPublish.current = publish;
    upload.startUpload({
      images: selected,
      title: title.trim(),
      notes: notes.trim(),
      line: line?.key,
      publish,
      // Ignored by the backend when it knows the date: it never replaces a sure one.
      ...(observationDate ? { observation_date: observationDate } : {}),
    });
  };

  const backToForm = () => {
    upload.reset();
    prepare();
  };

  const openUrl = (url) => url && Linking.openURL(url).catch(() => {});

  const selectedSize = data ? data.images.filter(i => selected.includes(i.kind)).reduce((n, i) => n + (i.size || 0), 0) : 0;
  const canSend = connected && !inHotspot && selected.length > 0 && !!line && lineConfirmed && (dateKnown || !!observationDate);

  // --- Views -----------------------------------------------------------------

  const renderProgress = () => (
    <View className="py-6 flex flex-col items-center w-full" style={{ gap: 10 }}>
      <Ionicons name="cloud-upload-outline" size={40} color="#fff" />
      <Text className="text-white" style={{ fontSize: 13 }}>{t(hubStepKey(upload.step))}</Text>
      <View style={styles.track}>
        <View style={[styles.bar, { width: `${Math.max(2, upload.percent)}%` }]} />
      </View>
      <Text className="text-zinc-400" style={{ fontSize: 11 }}>
        {upload.percent} %{upload.image > 0 ? `  ·  ${t('common:hubImageCount', { image: upload.image, images: upload.images })}` : ''}
      </Text>
      <Text className="text-zinc-500 text-center" style={{ fontSize: 11 }}>{t('common:hubRunsInBackground')}</Text>
    </View>
  );

  const renderResult = () => {
    const failed = upload.status === 'failed';
    let icon = 'checkmark-circle';
    let color = ACCENT;
    let headline = t('common:hubPublished');
    let hint = null;
    if (failed) {
      icon = 'alert-circle';
      color = '#f59e0b';
      headline = t(hubErrorKey(upload.errorKey));
      if (upload.url) hint = t('common:hubIncompleteDraft');
    } else if (!upload.published) {
      headline = t('common:hubSentAsDraft');
      hint = requestedPublish.current === false ? t('common:hubDraftChosen') : t('common:hubPublishRefused');
    }
    return (
      <View className="py-5 flex flex-col items-center w-full" style={{ gap: 10 }}>
        <Ionicons name={icon} size={44} color={color} />
        <Text className="text-white text-center font-bold" style={{ fontSize: 14 }}>{headline}</Text>
        {hint && <Text className="text-zinc-400 text-center" style={{ fontSize: 12 }}>{hint}</Text>}
        <View className="flex flex-row mt-2" style={{ gap: 10 }}>
          {!!upload.url && (
            <PressableScale className="bg-emerald-600 rounded-xl px-4 h-10 flex flex-row items-center" style={{ gap: 6 }} onPress={() => openUrl(upload.url)}>
              <Ionicons name="open-outline" size={16} color="#fff" />
              <Text className="text-white font-bold" style={{ fontSize: 12 }}>{t('common:hubOpenObservation')}</Text>
            </PressableScale>
          )}
          {failed && (
            <PressableScale className="bg-zinc-700 rounded-xl px-4 h-10 flex flex-row items-center" style={{ gap: 6 }} onPress={backToForm}>
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text className="text-white" style={{ fontSize: 12 }}>{t('common:hubRetry')}</Text>
            </PressableScale>
          )}
          {!failed && (
            <PressableScale className="bg-zinc-700 rounded-xl px-4 h-10 flex flex-row items-center" style={{ gap: 6 }} hitSlop={8} onPress={() => onClose()}>
              <Text className="text-white" style={{ fontSize: 12 }}>{t('common:wifiClose')}</Text>
            </PressableScale>
          )}
        </View>
      </View>
    );
  };

  const renderLogin = () => (
    <View className="pt-3 w-full self-center" style={{ maxWidth: 360, gap: 8 }}>
      {upload.status === 'failed' && upload.errorKey === 'token_expired' && (
        <Notice icon="time-outline" text={t(hubErrorKey('token_expired'))} />
      )}
      <Text className="text-zinc-300" style={{ fontSize: 12 }}>{t('common:hubLoginPrompt')}</Text>
      <HubLoginForm onLoggedIn={() => { upload.reset(); prepare(); }} />
    </View>
  );

  const renderForm = () => {
    if (loading || !data) {
      return prepareError
        ? <View className="py-6 w-full"><Notice icon="warning-outline" text={t(hubErrorKey(prepareError))} /></View>
        : <View className="py-10 items-center"><ActivityIndicator color="#fff" /></View>;
    }
    if (!data.images.length) {
      return <View className="py-6 w-full"><Notice icon="warning-outline" text={t('common:hubError_not_processed')} /></View>;
    }
    const lastUpload = data.last_upload;
    const isScan = !data.type || data.type === 'scan';
    // The watermark of a stack bears its mean date: shown next to the field,
    // large enough to be read once tapped.
    const previewImage = data.images.find(i => selected.includes(i.kind)) || data.images[0];
    const dateTyped = obsDay.trim() !== '' && obsTime.trim() !== '';
    return (
      <View className="pt-3" style={{ gap: 10 }}>
        {inHotspot && (
          <Notice icon="wifi-outline" text={t('common:hubNeedsInternet')}
            action={onOpenWifiSettings && { label: t('common:wifiConnectHome'), onPress: onOpenWifiSettings }} />
        )}
        {data.type === 'animation' && (
          <Notice icon="flask-outline" text={t('common:hubAnimationExperimental')} />
        )}
        {lastUpload && (
          <Notice icon="information-circle-outline"
            text={t('common:hubAlreadySent', { date: new Date(lastUpload.uploaded_at * 1000).toLocaleDateString(t('common:locale')) })}
            action={lastUpload.url && { label: t('common:hubOpenObservation'), onPress: () => openUrl(lastUpload.url) }} />
        )}

        <View className="flex flex-row" style={{ gap: 14 }}>
          {/* Images: the order of sending is the backend's, not the tapping order */}
          <View style={{ flex: 1 }}>
            <SectionLabel text={t('common:hubImages')} extra={selected.length ? `${selected.length} · ${formatSize(selectedSize)}` : ''} />
            <View className="flex flex-row flex-wrap" style={{ gap: 8 }}>
              {data.images.map(img => {
                const isOn = selected.includes(img.kind);
                return (
                  <PressableScale key={img.kind} scaleTo={0.92} onPress={() => toggleImage(img.kind)} style={{ width: THUMB }}>
                    <View style={[styles.thumb, { borderColor: isOn ? ACCENT : 'rgba(255,255,255,0.12)', borderWidth: isOn ? 2 : 1 }]}>
                      <Image source={`http://${apiURL}/${img.path}?v=${img.size}`} style={{ width: '100%', height: '100%', opacity: isOn ? 1 : 0.45 }} contentFit="cover" transition={150} />
                      <View className="absolute top-0 right-0 p-1">
                        <Ionicons name={isOn ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={isOn ? ACCENT : 'rgba(255,255,255,0.7)'} />
                      </View>
                    </View>
                    <Text numberOfLines={2} className={isOn ? 'text-white' : 'text-zinc-500'} style={{ fontSize: 9, marginTop: 3 }}>{img.label}</Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          <View style={{ flex: 1, gap: 10 }}>
            {/* Tags are not reliable (Ca II H tagged K and the other way round):
                the line is always shown, and must be confirmed when untagged. */}
            <View>
              <SectionLabel text={t('common:hubLine')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {data.lines.map(l => {
                  const isOn = line?.key === l.key;
                  const color = linesDict.find(d => d.key === l.key)?.color;
                  return (
                    <PressableScale key={l.key} onPress={() => pickLine(l)}
                      className={isOn ? 'bg-zinc-700 px-3 py-1 rounded-full flex flex-row items-center mr-2' : 'px-3 py-1 rounded-full flex flex-row items-center mr-2'}
                      style={{ borderWidth: 1, borderColor: isOn ? (color || ACCENT) : 'rgba(255,255,255,0.12)' }}>
                      {color && <View style={[styles.dot, { backgroundColor: color }]} />}
                      <Text className={isOn ? 'text-white' : 'text-zinc-400'} style={{ fontSize: 12 }}>{l.hub_label || l.label}</Text>
                    </PressableScale>
                  );
                })}
              </ScrollView>
              {!lineConfirmed && (
                <Text className="text-amber-500 mt-1" style={{ fontSize: 11 }}>{t(isScan ? 'common:hubLineUntagged' : 'common:hubLineUnknown', { line: line?.hub_label || line?.label })}</Text>
              )}
              {!lineConfirmed && (
                <PressableScale onPress={() => setLineConfirmed(true)} className="self-start mt-1 bg-zinc-700 rounded-full px-3 py-1">
                  <Text className="text-white" style={{ fontSize: 11 }}>{t('common:hubLineConfirm')}</Text>
                </PressableScale>
              )}
            </View>

            {!dateKnown && (
              <View>
                <SectionLabel text={t('common:hubObservationDate')} />
                <View className="flex flex-row" style={{ gap: 8 }}>
                  <TextInput
                    className="bg-zinc-800 border border-zinc-600 text-white rounded-xl px-3"
                    style={{ paddingVertical: 7, flex: 3 }}
                    value={obsDay}
                    onChangeText={changeObsDay}
                    placeholder={t('common:hubDatePlaceholder')}
                    placeholderTextColor="#71717a"
                    keyboardType="numbers-and-punctuation"
                    autoCorrect={false}
                    maxLength={10}
                  />
                  <TextInput
                    className="bg-zinc-800 border border-zinc-600 text-white rounded-xl px-3"
                    style={{ paddingVertical: 7, flex: 2 }}
                    value={obsTime}
                    onChangeText={setObsTime}
                    placeholder={t('common:hubTimePlaceholder')}
                    placeholderTextColor="#71717a"
                    keyboardType="numbers-and-punctuation"
                    autoCorrect={false}
                    maxLength={8}
                  />
                  <View className="justify-center"><Text className="text-zinc-400" style={{ fontSize: 12 }}>UTC</Text></View>
                </View>
                <Text className={dateTyped && !observationDate ? 'text-red-400 mt-1' : 'text-amber-500 mt-1'} style={{ fontSize: 11 }}>
                  {dateTyped && !observationDate ? t('common:hubError_invalid_observation_date') : t('common:hubObservationDateHint')}
                </Text>
                {previewImage && (
                  <PressableScale scaleTo={0.97} onPress={() => setBigPreview(v => !v)} style={[styles.preview, { height: bigPreview ? 260 : 120 }]}>
                    <Image source={`http://${apiURL}/${previewImage.path}?v=${previewImage.size}`} style={{ width: '100%', height: '100%' }} contentFit="contain" transition={150} />
                    <View className="absolute bottom-0 right-0 p-1">
                      <Ionicons name={bigPreview ? 'contract-outline' : 'expand-outline'} size={14} color="rgba(255,255,255,0.8)" />
                    </View>
                  </PressableScale>
                )}
              </View>
            )}

            <View>
              <SectionLabel text={t('common:hubTitle')} />
              <TextInput
                className="bg-zinc-800 border border-zinc-600 text-white rounded-xl px-3"
                style={{ paddingVertical: 7 }}
                value={title}
                onChangeText={(v) => { setTitle(v); setTitleEdited(true); }}
                placeholder={data.defaults?.title}
                placeholderTextColor="#71717a"
                returnKeyType="done"
              />
            </View>

            <View>
              <SectionLabel text={t('common:hubNotes')} />
              <TextInput
                className="bg-zinc-800 border border-zinc-600 text-white rounded-xl px-3"
                style={{ paddingVertical: 7, minHeight: 56, textAlignVertical: 'top' }}
                value={notes}
                onChangeText={setNotes}
                placeholder={t('common:hubNotesPlaceholder')}
                placeholderTextColor="#71717a"
                multiline
              />
            </View>

            <View className="flex flex-row items-center justify-between">
              <View className="flex-1 pr-2">
                <Text className="text-white text-xs">{t('common:hubPublish')}</Text>
                <Text className="text-zinc-500" style={{ fontSize: 10 }}>{publish ? t('common:hubPublishHint') : t('common:hubDraftHint')}</Text>
              </View>
              <Switch
                trackColor={{ false: '#767577', true: 'rgb(5 150 105)' }}
                thumbColor="#fff"
                value={publish}
                onValueChange={setPublish}
                style={{ marginVertical: Platform.OS === 'android' ? -6 : 0 }}
              />
            </View>
          </View>
        </View>

        {lastUpload && <Text className="text-zinc-500" style={{ fontSize: 10 }}>{t('common:hubNewObservation')}</Text>}

        <PressableScale
          className={`${canSend ? 'bg-emerald-600' : 'bg-zinc-700'} w-full rounded-xl h-12 flex flex-row justify-center items-center mb-1`}
          style={{ gap: 8 }}
          disabled={!canSend}
          onPress={send}
        >
          <Ionicons name="cloud-upload-outline" size={18} color={canSend ? '#fff' : '#a1a1aa'} />
          <Text className={canSend ? 'text-white font-bold' : 'text-zinc-400 font-bold'} style={{ fontSize: 13 }}>
            {lastUpload ? t('common:hubSendAgain') : t('common:hubSend')}
          </Text>
        </PressableScale>
      </View>
    );
  };

  // Progress and result are short and never scroll: they sit outside the
  // ScrollView, where the close button of the header already worked while the
  // "Close" of the result, inside it, did not get its taps on Android.
  let body;
  let scrollable = false;
  if (isRunning) body = renderProgress();
  else if (!hubAccount) body = <View className="py-10 items-center"><ActivityIndicator color="#fff" /></View>;
  else if (!connected) { body = renderLogin(); scrollable = true; }
  else if (isDone) body = renderResult();
  else { body = renderForm(); scrollable = true; }

  // No SafeAreaView around the Modal : it takes room in the layout, see JobProgressModal
  return (
    <>
      <Modal animationType="fade" transparent={true} visible={isVisible} supportedOrientations={['landscape']} onRequestClose={onClose}>
        <View style={modalBackdrop}>
          <View style={styles.card}>
            <View className="flex flex-row items-center justify-between w-full pb-3" style={styles.header}>
              <View className="flex flex-row items-center" style={{ gap: 8 }}>
                <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                <Text className="text-white font-bold" style={{ fontSize: 15 }}>SpectroSolHub</Text>
                {connected && <Text className="text-zinc-500" style={{ fontSize: 11 }}>{t('common:hubConnectedAs', { username: hubAccount.username })}</Text>}
              </View>
              <PressableScale scaleTo={0.88} onPress={onClose} style={roundButton}>
                <MaterialIcons name="close" color="#fff" size={18} />
              </PressableScale>
            </View>
            {scrollable
              ? <ScrollView className="w-full" keyboardShouldPersistTaps="handled">{body}</ScrollView>
              : body}
          </View>
        </View>
      </Modal>
    </>
  );
}

function SectionLabel({ text, extra }) {
  return (
    <View className="flex flex-row items-baseline justify-between mb-1">
      <Text className="text-zinc-400 font-bold" style={{ fontSize: 10, letterSpacing: 1 }}>{text.toUpperCase()}</Text>
      {!!extra && <Text className="text-zinc-500" style={{ fontSize: 10 }}>{extra}</Text>}
    </View>
  );
}

function Notice({ icon, text, action }) {
  return (
    <View className="flex flex-row items-center px-3 py-2" style={[warningChip, { gap: 8 }]}>
      <Ionicons name={icon} size={16} color="#fbbf24" />
      <Text className="text-amber-400 flex-1" style={{ fontSize: 11 }}>{text}</Text>
      {/* Ternary: `action` may be an empty url string, which React Native
          would try to render as bare text. */}
      {action ? (
        <PressableScale onPress={action.onPress} className="bg-zinc-700 rounded-full px-3 py-1">
          <Text className="text-white" style={{ fontSize: 11 }}>{action.label}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...modalCard,
    margin: 20,
    width: '78%',
    maxHeight: '90%',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  preview: {
    marginTop: 6,
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  track: {
    width: '70%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: ACCENT,
  },
});
