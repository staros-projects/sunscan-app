import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Line, Polyline } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { colors, toolbarSurface } from './theme';

// Samples kept for the sparkline : the score arrives about twice a second,
// so this covers the last twenty seconds of turning the focuser
const HISTORY_LENGTH = 40;
// Weight of the newest sample in the smoothed score. The raw score jitters with
// seeing, and a single lucky frame would otherwise set a best nobody can reach.
const SMOOTHING = 0.5;
// Relative change under which the score is considered steady
const TREND_THRESHOLD = 0.005;
// Share of the best score from which the focus is called good / close
const GOOD_RATIO = 0.97;
const CLOSE_RATIO = 0.85;

const SPARK_WIDTH = 120;
const SPARK_HEIGHT = 30;

function ratioColor(ratio) {
  if (ratio >= GOOD_RATIO) {
    return colors.accent;
  }
  if (ratio >= CLOSE_RATIO) {
    return colors.warning;
  }
  return '#f87171'; // red-400
}

function Sparkline({ history, best }) {
  if (history.length < 2) {
    return <View style={{ width: SPARK_WIDTH, height: SPARK_HEIGHT }} />;
  }
  const min = Math.min(...history);
  const max = Math.max(best, ...history);
  const span = max - min || 1;
  const y = (v) => SPARK_HEIGHT - 2 - ((v - min) / span) * (SPARK_HEIGHT - 4);
  const step = SPARK_WIDTH / (HISTORY_LENGTH - 1);
  // Right aligned, so the newest sample always sits at the same place
  const offset = SPARK_WIDTH - (history.length - 1) * step;
  const points = history.map((v, i) => `${offset + i * step},${y(v)}`).join(' ');

  return (
    <Svg width={SPARK_WIDTH} height={SPARK_HEIGHT}>
      <Line x1={0} x2={SPARK_WIDTH} y1={y(best)} y2={y(best)} stroke="rgba(255,255,255,0.35)" strokeWidth={1} strokeDasharray="3,3" />
      <Polyline points={points} fill="none" stroke="white" strokeWidth={1.5} strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * Focus assistant : the sharpness score streamed by the camera, shown as how
 * far it is from the best one seen so far. The absolute score means nothing to
 * the observer, who only needs to know whether turning the focuser makes it
 * better or worse, and when the peak has been passed.
 */
export default function FocusAssistant({ value }) {
  const { t } = useTranslation();

  const [smoothed, setSmoothed] = useState(null);
  const [best, setBest] = useState(0);
  const [history, setHistory] = useState([]);
  const [newBest, setNewBest] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const newBestTimer = useRef(null);

  useEffect(() => {
    if (!(value > 0)) {
      return;
    }
    const next = smoothed == null ? value : smoothed + SMOOTHING * (value - smoothed);
    setSmoothed(next);
    setHistory((previous) => [...previous, next].slice(-HISTORY_LENGTH));
    if (next > best) {
      // Only worth flagging once a first best exists
      if (best > 0) {
        setNewBest(true);
        clearTimeout(newBestTimer.current);
        newBestTimer.current = setTimeout(() => setNewBest(false), 1200);
      }
      setBest(next);
    }
  }, [value]);

  useEffect(() => () => clearTimeout(newBestTimer.current), []);

  const reset = () => {
    setBest(smoothed || 0);
    setHistory(smoothed != null ? [smoothed] : []);
    setNewBest(false);
  };

  const waiting = smoothed == null;
  const ratio = best > 0 && !waiting ? Math.min(1, smoothed / best) : 0;
  const tint = ratioColor(ratio);

  // Direction of the last few samples : tells which way to keep turning
  const reference = history.length > 3 ? history[history.length - 4] : null;
  const change = reference ? (smoothed - reference) / reference : 0;
  const trend = change > TREND_THRESHOLD ? 'up' : change < -TREND_THRESHOLD ? 'down' : 'steady';
  const trendIcon = { up: 'trending-up', down: 'trending-down', steady: 'remove' }[trend];
  const trendColor = { up: colors.accent, down: '#f87171', steady: '#a1a1aa' }[trend];

  return (
    <View style={[toolbarSurface, { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 8, width: 360, gap: 6 }]}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="prism" size={13} color={colors.accent} />
        <Text style={{ color: '#d4d4d8', fontSize: 11, marginLeft: 6, flex: 1 }}>{t('common:focusMsg')}</Text>
        <Pressable hitSlop={10} onPress={() => setShowHelp(!showHelp)} style={{ marginRight: 14 }}>
          <Ionicons name={showHelp ? 'help-circle' : 'help-circle-outline'} size={18} color={showHelp ? colors.accent : '#fff'} />
        </Pressable>
        <Pressable hitSlop={10} onPress={reset} disabled={waiting} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, opacity: waiting ? 0.4 : 1 }}>
          <Ionicons name="refresh-sharp" size={14} color="white" />
          <Text style={{ color: '#fff', fontSize: 11 }}>{t('common:focusReset')}</Text>
        </Pressable>
      </View>

      {waiting ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: SPARK_HEIGHT }}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={{ color: '#fff', fontSize: 12 }}>{t('common:focusWaiting')}</Text>
        </View>
      ) : (
        <>
          {/* Score, trend and history */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: tint, fontSize: 26, fontWeight: 'bold', fontVariant: ['tabular-nums'], minWidth: 72 }}>
              {Math.round(ratio * 100)}%
            </Text>
            <Ionicons name={trendIcon} size={22} color={trendColor} style={{ marginHorizontal: 6 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 12, fontVariant: ['tabular-nums'] }}>{smoothed.toFixed(2)}</Text>
              <Text style={{ color: newBest ? colors.accent : '#a1a1aa', fontSize: 10, fontWeight: newBest ? 'bold' : 'normal' }}>
                {newBest ? t('common:focusNewBest') : t('common:focusBest', { value: best.toFixed(2) })}
              </Text>
            </View>
            <Sparkline history={history} best={best} />
          </View>

          {/* Gauge : the current score against the best one */}
          <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
            <View style={{ width: `${ratio * 100}%`, height: '100%', borderRadius: 3, backgroundColor: tint }} />
          </View>
        </>
      )}

      {showHelp && (
        <View style={{ gap: 2, paddingTop: 2 }}>
          <Text style={{ color: '#a1a1aa', fontSize: 11 }}>1. {t('common:focusStep1')}</Text>
          <Text style={{ color: '#a1a1aa', fontSize: 11 }}>2. {t('common:focusStep2')}</Text>
          <Text style={{ color: '#a1a1aa', fontSize: 11 }}>3. {t('common:focusStep3')}</Text>
        </View>
      )}
    </View>
  );
}
