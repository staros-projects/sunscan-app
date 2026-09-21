import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { stepTranslationKey } from '../utils/useScanProcess';

// Fallback narration, used only against a backend that publishes no progress.
// It lists the pipeline in the order process_scan runs it, and is a *narration*,
// not live progress: the pacing is timed to roughly match a 20-30s run, it tells
// the user what the box is busy with, it does not claim where it has got to.
const STEP_KEYS = [
  'stepReadingSer',
  'stepMeanImage',
  'stepDetectingLine',
  'stepPolynomialFit',
  'stepReconstructing',
  'stepTiltCorrection',
  'stepScaling',
  'stepCircleDetection',
  'stepSurface',
  'stepContinuum',
  'stepProtus',
  'stepDoppler',
  'stepClahe',
  'stepWatermark',
  'stepSaving',
];

const TYPE_MS = 26;   // per character
const HOLD_MS = 950;  // pause once a line is fully typed

const ACCENT = '#10b981';

/**
 * Shows what the backend is doing with a scan.
 *
 * With a backend that publishes on scan_progress_<key>, `percent` and `step`
 * are the real thing and a bar is drawn. With an older one `percent` is null,
 * and the component falls back to typing its way through the pipeline.
 */
export default function ProcessingSteps({ compact = false, width, percent = null, step = null }) {
  const { t } = useTranslation();

  const hasProgress = percent !== null && percent !== undefined;
  const fontSize = compact ? 9 : 13;

  if (hasProgress) {
    return (
      <LiveProgress
        compact={compact}
        width={width}
        percent={percent}
        step={step}
        fontSize={fontSize}
        label={t(stepTranslationKey(step))}
      />
    );
  }

  return <Narration compact={compact} width={width} fontSize={fontSize} />;
}

function LiveProgress({ compact, width, percent, fontSize, label }) {
  // Clamped: a backend is free to report anything, the bar is not.
  const value = Math.max(0, Math.min(100, percent));

  const progress = useSharedValue(value);
  useEffect(() => {
    // Short tween rather than a jump: the backend skips percentages, and the
    // bar sliding over the gap reads as one continuous run.
    progress.value = withTiming(value, { duration: 300, easing: Easing.out(Easing.quad) });
  }, [value]);
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));

  return (
    <View style={{ width: width ?? '100%', alignItems: 'center' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: (fontSize + 4) * 2,
        }}
      >
        <Text
          numberOfLines={2}
          style={{
            color: '#d4d4d8',
            fontSize,
            lineHeight: fontSize + 4,
            textAlign: 'center',
            flexShrink: 1,
          }}
        >
          {label}
        </Text>
      </View>

      <View
        style={{
          width: '100%',
          height: compact ? 3 : 5,
          borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.12)',
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[{ height: '100%', borderRadius: 999, backgroundColor: ACCENT }, barStyle]}
        />
      </View>

      <Text
        style={{
          color: '#a1a1aa',
          fontSize: compact ? 9 : 12,
          marginTop: compact ? 2 : 4,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value} %
      </Text>
    </View>
  );
}

function Narration({ compact, width, fontSize }) {
  const { t } = useTranslation();

  const steps = useMemo(() => STEP_KEYS.map((k) => t('common:' + k)), [t]);

  const [stepIndex, setStepIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);

  // Restart typing whenever the line changes
  useEffect(() => {
    setCharCount(0);
  }, [stepIndex]);

  // One pending timeout at a time, cleared on unmount: type the next character,
  // or hold then move on. The last line stays up if processing runs long.
  useEffect(() => {
    const full = steps[stepIndex] || '';
    if (charCount < full.length) {
      const id = setTimeout(() => setCharCount((c) => c + 1), TYPE_MS);
      return () => clearTimeout(id);
    }
    if (stepIndex < steps.length - 1) {
      const id = setTimeout(() => setStepIndex((i) => i + 1), HOLD_MS);
      return () => clearTimeout(id);
    }
  }, [charCount, stepIndex, steps]);

  // Blinking caret, on the UI thread so it costs no re-renders
  const caret = useSharedValue(1);
  useEffect(() => {
    caret.value = withRepeat(
      withTiming(0, { duration: 520, easing: Easing.linear }),
      -1,
      true
    );
    return () => cancelAnimation(caret);
  }, []);
  const caretStyle = useAnimatedStyle(() => ({ opacity: caret.value }));

  return (
    <View style={[{ width: width ?? '100%', alignItems: 'center' }]}>
      {/* Height reserved for two lines, so the block does not jump as the
          longer labels wrap mid-typing. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'center',
          minHeight: (fontSize + 4) * 2,
        }}
      >
        <Text
          numberOfLines={2}
          style={{
            color: '#d4d4d8',
            fontSize,
            lineHeight: fontSize + 4,
            textAlign: 'center',
          }}
        >
          {(steps[stepIndex] || '').slice(0, charCount)}
        </Text>
        <Animated.View
          style={[
            {
              width: compact ? 4 : 6,
              height: fontSize,
              marginLeft: 2,
              marginTop: 2,
              backgroundColor: ACCENT,
            },
            caretStyle,
          ]}
        />
      </View>
    </View>
  );
}
