import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import PressableScale from './PressableScale';
import SunscanLoader from './SunscanLoader';
import { modalBackdrop, modalCard } from './theme';

// Pop-in of a running stacking or animation, see useJobProgress.
//
// The backend reports its percentage in steps, one per scan aligned (about 14 s
// each) or per GIF created (1 to 4 s): during an alignment it does not move. So
// the bar creeps from one step towards the next at the expected pace, and every
// message sets it right again. It never goes back.
//
// A backend that predates job_id reports nothing: `percent` stays null and the
// pop-in shows an indeterminate loader and the elapsed time, as it always did.

const ACCENT = '#10b981';

// Neither list is exhaustive — the backend may add steps and errors without the
// app being updated, hence the generic labels.
const STEP_LABELS = {
  starting: 'jobStepStarting',
  aligning: 'jobStepAligning',
  writing_images: 'jobStepWritingImages',
  creating_gif: 'jobStepCreatingGif',
  done: 'jobStepDone',
};

const ERROR_LABELS = {
  busy: 'jobErrorBusy',
  missing_images: 'jobErrorMissingImages',
  stacking_failed: 'jobErrorStackingFailed',
  animation_failed: 'jobErrorAnimationFailed',
  request_failed: 'jobErrorRequestFailed',
};

const jobStepTranslationKey = (step) =>
  'common:' + (STEP_LABELS[step] || 'jobStepGeneric');

const jobErrorTranslationKey = (error) =>
  'common:' + (ERROR_LABELS[error] || 'jobErrorGeneric');

const formatElapsed = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`;
};

// Where the bar may creep to before the next message, and how long that takes.
// Taken from the backend: aligning shares 0-90 between the scans, then about 4 s
// of image writing; an animation shares 0-100 between its GIFs.
const nextStep = ({ kind, step, percent, current, total }) => {
  if (kind === 'stack' && step === 'aligning' && total > 0 && current > 0) {
    return { target: Math.min(90, (current * 90) / total), duration: 14000 };
  }
  if (kind === 'stack' && step === 'writing_images') {
    return { target: 99, duration: 4000 };
  }
  if (kind === 'animation' && step === 'creating_gif' && total > 0 && current > 0) {
    return { target: (current * 100) / total, duration: 2500 };
  }
  return { target: percent, duration: 0 };
};

export default function JobProgressModal({ job, onClose }) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);

  const visible = !!job;
  const failed = job?.status === 'failed';
  const isStack = job?.kind !== 'animation';
  const percent = job?.percent ?? null;

  useEffect(() => {
    if (!visible || failed) {
      return undefined;
    }
    const started = job.startedAt || Date.now();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [visible, failed, job?.id]);

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
  }, [job?.id]);
  useEffect(() => {
    if (percent === null) {
      return;
    }
    const value = Math.max(0, Math.min(100, percent));
    const from = Math.max(value, progress.value);
    const { target, duration } = nextStep(job);
    // Short of the next step: reaching it is the backend's call
    const to = Math.max(from, Math.min(99, target - 1));
    progress.value = withSequence(
      withTiming(from, { duration: 300, easing: Easing.out(Easing.quad) }),
      withTiming(to, { duration: to > from ? duration : 0, easing: Easing.out(Easing.quad) }),
    );
  }, [percent, job?.step, job?.current, job?.total]);
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));

  const stepLabel = job ? t(jobStepTranslationKey(job.step), { current: job.current, total: job.total }) : '';

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
        onRequestClose={() => { if (failed) onClose(); }}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            {failed ? (
              <>
                <Ionicons name="warning-outline" size={30} color="#fbbf24" />
                <Text style={styles.title}>{t(isStack ? 'common:stackingFailed' : 'common:animationFailed')}</Text>
                <Text style={styles.hint}>{t(jobErrorTranslationKey(job.error))}</Text>
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
                <Text style={styles.title}>{t(isStack ? 'common:stackingTitle' : 'common:animationTitle')}</Text>
                {/* `number`, not `count`: `count` would put i18next into plural lookup */}
                <Text style={styles.subtitle}>{t('common:stackingFrames', { number: job?.count ?? 0 })}</Text>
                {percent !== null && (
                  <View style={styles.progress}>
                    <Text style={styles.step} numberOfLines={2}>{stepLabel}</Text>
                    <View style={styles.track}>
                      <Animated.View style={[styles.bar, barStyle]} />
                    </View>
                    <Text style={styles.percent}>{Math.max(0, Math.min(100, percent))} %</Text>
                  </View>
                )}
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
  progress: {
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
  },
  step: {
    color: '#d4d4d8',
    fontSize: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  track: {
    width: '100%',
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  percent: {
    color: '#a1a1aa',
    fontSize: 12,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
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
