import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import PressableScale from './PressableScale';
import SunscanLoader from './SunscanLoader';
import { modalBackdrop, modalCard } from './theme';

// Stacking publishes nothing while it runs: /sunscan/process/stack/ is
// synchronous and the websocket stays silent, so the POST coming back IS the
// end of the job. There is therefore no percentage to show, and the bar this
// pop-in used to draw was a plain 13s-per-frame timer -- it reached 100% and
// waited, or was still half way when the job was already done.
//
// So: an indeterminate loader, and the one number we actually know, the elapsed
// time. Nothing here claims to know how far along the box is.

const formatElapsed = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`;
};

export default function StackingModal({ visible, frameCount, error, onClose }) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!visible || error) {
      return undefined;
    }
    setElapsed(0);
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [visible, error]);

  return (
    <SafeAreaView>
      <Modal
        transparent
        visible={visible}
        animationType="fade"
        statusBarTranslucent
        supportedOrientations={['landscape']}
        // Only dismissible once it has failed: the request cannot be cancelled,
        // and a pop-in the user can close mid-run would just hide a busy box.
        onRequestClose={() => { if (error) onClose(); }}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            {error ? (
              <>
                <Ionicons name="warning-outline" size={30} color="#fbbf24" />
                <Text style={styles.title}>{t('common:stackingFailed')}</Text>
                <Text style={styles.hint}>{t('common:stackingFailedHint')}</Text>
                <PressableScale
                  className="bg-zinc-700 rounded-xl mt-4 px-5 h-10 flex flex-row items-center justify-center"
                  onPress={onClose}
                >
                  <Text className="text-white font-bold" style={{ fontSize: 13 }}>
                    {t('common:cancel')}
                  </Text>
                </PressableScale>
              </>
            ) : (
              <>
                <SunscanLoader size={76} />
                <Text style={styles.title}>{t('common:stackingTitle')}</Text>
                {/* `number`, not `count`: `count` would put i18next into plural lookup */}
                <Text style={styles.subtitle}>{t('common:stackingFrames', { number: frameCount })}</Text>
                <Text style={styles.elapsed}>
                  {t('common:stackingElapsed', { time: formatElapsed(elapsed) })}
                </Text>
                <Text style={styles.hint}>{t('common:stackingHint')}</Text>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backdrop: modalBackdrop,
  card: {
    ...modalCard,
    width: 340,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 14,
    textAlign: 'center',
  },
  subtitle: {
    color: '#d4d4d8',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  elapsed: {
    color: '#a1a1aa',
    fontSize: 12,
    marginTop: 10,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    color: '#71717a',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 12,
    textAlign: 'center',
  },
});
