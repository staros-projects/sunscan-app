import { useContext, useEffect } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';

import AppContext from './AppContext';
import PressableScale from './PressableScale';
import { colors, modalBackdrop, modalCard, roundButton, warningChip } from './theme';
import firmareIsUpToDate, { backend_current_version } from '../utils/Helpers';
import useFirmwareUpdate from '../utils/useFirmwareUpdate';

/**
 * Offers the firmware embedded in the app and runs the update in place, from
 * the home screen when an outdated SUNSCAN is detected as from the settings.
 * The update stays optional: "Later" closes it, but the user is told plainly
 * what running an old firmware costs.
 */
export default function FirmwareUpdateModal({ isVisible, onClose }) {
  const { t } = useTranslation();
  const myContext = useContext(AppContext);
  const update = useFirmwareUpdate();
  const outdated = !firmareIsUpToDate(myContext);
  const isUpdating = update.status === 'updating';

  // Each opening starts from the offer, not from the last result
  useEffect(() => {
    if (isVisible && !isUpdating) {
      update.reset();
    }
  }, [isVisible]);

  // The SUNSCAN is being rewritten : nothing may close the panel meanwhile
  const close = () => {
    if (!isUpdating) {
      onClose();
    }
  };

  const renderOffer = () => (
    <View style={{ gap: 12 }}>
      <View className="flex flex-row items-center justify-center" style={{ gap: 10 }}>
        <VersionPill label={t('common:firmwareCurrent')} version={myContext.backendApiVersion || '?'} muted />
        <Ionicons name="arrow-forward" size={18} color="#71717a" />
        <VersionPill label={t('common:firmwareNew')} version={backend_current_version} />
      </View>

      {outdated && (
        <View className="flex flex-row px-3 py-2" style={[warningChip, { gap: 8 }]}>
          <Ionicons name="warning-outline" size={16} color={colors.warning} style={{ marginTop: 1 }} />
          <Text className="text-amber-300 flex-1" style={{ fontSize: 12 }}>{t('common:firmwareOutdatedRisk')}</Text>
        </View>
      )}

      <View className="flex flex-row" style={{ gap: 8 }}>
        <Ionicons name="battery-charging-outline" size={16} color="#a1a1aa" style={{ marginTop: 1 }} />
        <Text className="text-zinc-400 flex-1" style={{ fontSize: 12 }}>{t('common:firmwareUpdateTips')}</Text>
      </View>

      <View className="flex flex-row mt-1" style={{ gap: 10 }}>
        <PressableScale className="bg-zinc-700 rounded-xl h-11 flex-1 flex flex-row justify-center items-center" onPress={close}>
          <Text className="text-white" style={{ fontSize: 13 }}>{t(outdated ? 'common:firmwareLater' : 'common:cancel')}</Text>
        </PressableScale>
        <PressableScale className="bg-emerald-600 rounded-xl h-11 flex-1 flex flex-row justify-center items-center" style={{ gap: 8 }} onPress={update.start}>
          <Ionicons name="download-outline" size={18} color="#fff" />
          <Text className="text-white font-bold" style={{ fontSize: 13 }}>{t('common:firmwareUpdateNow')}</Text>
        </PressableScale>
      </View>
    </View>
  );

  const renderProgress = () => (
    <View className="py-4 items-center" style={{ gap: 10 }}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text className="text-white font-bold" style={{ fontSize: 14 }}>{t('common:firmwareUpdating')}</Text>
      <Text className="text-zinc-400 text-center" style={{ fontSize: 12 }}>{t('common:firmwareUpdatingHint')}</Text>
    </View>
  );

  const renderResult = () => {
    const ok = update.status === 'success';
    return (
      <View className="py-2 items-center" style={{ gap: 10 }}>
        <Ionicons name={ok ? 'checkmark-circle' : 'alert-circle'} size={44} color={ok ? colors.accent : '#f59e0b'} />
        <Text className="text-white font-bold text-center" style={{ fontSize: 14 }}>
          {t(ok ? 'common:firmwareUpdatedTitle' : 'common:firmwareFailedTitle')}
        </Text>
        <Text className="text-zinc-400 text-center" style={{ fontSize: 12 }}>
          {ok ? t('common:firmwarePostUpdateMessage') : (update.detail || t('common:firmwareUpdateUnconfirmed'))}
        </Text>
        <View className="flex flex-row mt-2 self-stretch" style={{ gap: 10 }}>
          {!ok && (
            <PressableScale className="bg-zinc-700 rounded-xl h-11 flex-1 flex flex-row justify-center items-center" style={{ gap: 6 }} onPress={update.start}>
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text className="text-white" style={{ fontSize: 13 }}>{t('common:firmwareRetry')}</Text>
            </PressableScale>
          )}
          <PressableScale className={`${ok ? 'bg-emerald-600' : 'bg-zinc-700'} rounded-xl h-11 flex-1 flex flex-row justify-center items-center`} onPress={close}>
            <Text className="text-white font-bold" style={{ fontSize: 13 }}>{ok ? 'OK' : t('common:wifiClose')}</Text>
          </PressableScale>
        </View>
      </View>
    );
  };

  let body;
  if (isUpdating) body = renderProgress();
  else if (update.status === 'idle') body = renderOffer();
  else body = renderResult();

  return (
    <Modal animationType="fade" transparent={true} visible={isVisible} supportedOrientations={['landscape']} onRequestClose={close}>
      <View style={modalBackdrop}>
        <View style={styles.card}>
          <View className="flex flex-row items-center w-full pb-3 mb-3" style={[styles.header, { gap: 10 }]}>
            <View style={[styles.badge, outdated && styles.badgeWarning]}>
              <Ionicons name="hardware-chip-outline" size={18} color={outdated ? colors.warning : '#fff'} />
            </View>
            <View className="flex-1">
              <Text className="text-white font-bold" style={{ fontSize: 15 }}>{t('common:updateFirmware')}</Text>
              <Text className="text-zinc-500" style={{ fontSize: 11 }}>
                {t(outdated ? 'common:firmwareAvailableSubtitle' : 'common:upToDate')}
              </Text>
            </View>
            {!isUpdating && (
              <PressableScale scaleTo={0.88} onPress={close} style={roundButton} hitSlop={8}>
                <MaterialIcons name="close" color="#fff" size={18} />
              </PressableScale>
            )}
          </View>
          <ScrollView bounces={false}>{body}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function VersionPill({ label, version, muted }) {
  return (
    <View className="items-center px-4 py-2 rounded-xl" style={[styles.pill, !muted && styles.pillNew]}>
      <Text className="text-zinc-500" style={{ fontSize: 10, letterSpacing: 0.5 }}>{label}</Text>
      <Text className={muted ? 'text-zinc-300 font-bold' : 'text-emerald-400 font-bold'} style={{ fontSize: 16 }}>v{version}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...modalCard,
    margin: 20,
    width: '60%',
    maxWidth: 480,
    maxHeight: '90%',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  badgeWarning: {
    backgroundColor: 'rgba(251,191,36,0.15)',
  },
  pill: {
    minWidth: 120,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pillNew: {
    backgroundColor: 'rgba(16,185,129,0.10)',
    borderColor: 'rgba(16,185,129,0.40)',
  },
});
