import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { throttle } from 'lodash';

/**
 * Vertical gauge for the live view white point (max_visu_threshold).
 *
 * The threshold used to be a plain linear slider over 0..256 : the values that
 * matter when stretching a faint spectrum are all crowded in the bottom tenth
 * of the track, so picking 12 rather than 24 meant hitting a two pixel band.
 * Two things fix that here :
 *
 *  - the track is mapped through an exponential curve, so the low thresholds
 *    get most of the travel and the (rarely tuned) top of the range gets the
 *    rest. Like an audio fader, a given finger movement changes the value by a
 *    roughly constant *ratio* rather than a constant amount.
 *  - dragging is relative, not absolute : the fill follows the finger from
 *    wherever the value already is, and sliding the finger away from the track
 *    sideways divides the travel by FINE_GAIN for a last bit of precision.
 */

// Curvature of the track. The value at position p (0 bottom, 1 top) is
// max * (e^(K*p) - 1) / (e^K - 1) : 0 stays reachable at the bottom, and with
// K = 4 the lower half of the track covers roughly the first 12% of the range.
const CURVE = 4;
const CURVE_SPAN = Math.exp(CURVE) - 1;

// Sideways distance (px) past which the drag switches to fine mode, and the
// divider applied to the travel once it does.
const FINE_DISTANCE = 56;
const FINE_GAIN = 4;

// The camera only has to follow the finger closely enough to look live, and
// every change fires an HTTP control update : they are throttled while dragging
// and flushed on release.
const EMIT_INTERVAL = 150;

// Reference marks, in slider units : they make the compression of the curve
// readable instead of the track passing for a linear one.
const TICKS = [8, 16, 32, 64, 128];

// Invisible margin around the track, so a 26px bar still offers a comfortable
// target on a screen held one handed.
const TOUCH_PADDING = 14;

// Track position (0..1) -> value, and back. Kept as worklets so the gesture can
// use them on the UI thread as well as the buttons on the JS one.
function posToValue(pos, max) {
  'worklet';
  return (max * (Math.exp(CURVE * pos) - 1)) / CURVE_SPAN;
}

function valueToPos(value, max) {
  'worklet';
  return Math.log((Math.min(Math.max(value, 0), max) * CURVE_SPAN) / max + 1) / CURVE;
}

export default function ThresholdSlider({
  value,
  onChange,
  max = 256,
  // ADU shown per slider unit : the server scales the threshold by 16, and a
  // binned mono pixel sums four of them.
  scale = 16,
  // The buttons that used to frame the track are gone, so the track takes the
  // height back : more travel is more precision.
  height = 250,
  width = 26,
}) {
  const pos = useSharedValue(valueToPos(value, max));
  const fine = useSharedValue(false);
  // Measured width of the touch area, so fine mode is judged from the middle of
  // what the finger can actually land on rather than from the track alone.
  const touchWidth = useSharedValue(width + TOUCH_PADDING * 2);

  // Mirror of the value for the readout. The gauge owns the value while the
  // finger is down, so the prop is only pulled back in between gestures.
  const [display, setDisplay] = useState(Math.round(value));
  const [isFine, setIsFine] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const draggingRef = useRef(false);
  const lastSent = useRef(Math.round(value));

  const emit = useMemo(
    () =>
      throttle(
        (v) => {
          lastSent.current = v;
          onChange(v);
        },
        EMIT_INTERVAL,
        { leading: true, trailing: true }
      ),
    [onChange]
  );

  useEffect(() => () => emit.cancel(), [emit]);

  // An external change (mode switch, reset...) only moves the fill when it is
  // not the echo of what this gauge just sent.
  useEffect(() => {
    const rounded = Math.round(value);
    if (draggingRef.current || rounded === lastSent.current) return;
    lastSent.current = rounded;
    pos.value = valueToPos(rounded, max);
    setDisplay(rounded);
  }, [value, max]);

  const apply = useCallback(
    (nextPos, immediate) => {
      const v = Math.round(posToValue(nextPos, max));
      setDisplay(v);
      if (immediate) {
        emit.cancel();
        lastSent.current = v;
        onChange(v);
      } else {
        emit(v);
      }
    },
    [emit, onChange, max]
  );

  const onDragStart = useCallback(() => {
    draggingRef.current = true;
    setIsDragging(true);
  }, []);

  const onDragEnd = useCallback(
    (finalPos) => {
      draggingRef.current = false;
      setIsDragging(false);
      setIsFine(false);
      apply(finalPos, true);
    },
    [apply]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin(() => {
          runOnJS(onDragStart)();
        })
        .onChange((e) => {
          const far = Math.abs(e.x - touchWidth.value / 2) > FINE_DISTANCE;
          if (far !== fine.value) {
            fine.value = far;
            runOnJS(setIsFine)(far);
          }
          // changeY (delta since the previous event) rather than translationY,
          // so switching to fine mode mid drag scales what comes next instead
          // of jumping the fill.
          const travel = (-e.changeY / height) * (far ? 1 / FINE_GAIN : 1);
          pos.value = Math.min(Math.max(pos.value + travel, 0), 1);
          runOnJS(apply)(pos.value, false);
        })
        .onFinalize(() => {
          fine.value = false;
          runOnJS(onDragEnd)(pos.value);
        }),
    [apply, onDragEnd, onDragStart, height, width]
  );

  const fillStyle = useAnimatedStyle(() => ({
    height: `${pos.value * 100}%`,
  }));

  return (
    <View style={styles.column}>
      <View style={[styles.readout, isDragging && styles.readoutActive]}>
        <Text style={styles.readoutValue}>{display * scale}</Text>
        <Text style={styles.readoutUnit}>ADU</Text>
      </View>

      <GestureDetector gesture={pan}>
        {/* The padding widens the touch target without widening the track. Once
            the pan is active it keeps receiving events outside these bounds,
            which is what lets the finger wander sideways into fine mode. */}
        <View
          style={styles.trackTouchArea}
          onLayout={(e) => {
            touchWidth.value = e.nativeEvent.layout.width;
          }}
        >
          <View style={[styles.track, { height, width }]}>
            <Animated.View style={[styles.fill, fillStyle]} />
            {TICKS.map((t) => (
              <View
                key={t}
                pointerEvents="none"
                style={[styles.tick, { bottom: valueToPos(t, max) * height }]}
              />
            ))}
          </View>
        </View>
      </GestureDetector>

      <View style={styles.fineHint}>
        {isFine && <Text style={styles.fineText}>x{FINE_GAIN}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    alignItems: 'center',
  },
  readout: {
    marginVertical: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 9,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  readoutActive: {
    borderColor: 'rgba(255,255,255,0.6)',
  },
  readoutValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    ...Platform.select({ ios: { fontVariant: ['tabular-nums'] }, default: {} }),
  },
  readoutUnit: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 8,
    letterSpacing: 0.5,
  },
  trackTouchArea: {
    paddingHorizontal: TOUCH_PADDING,
    paddingVertical: 6,
  },
  track: {
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  fill: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#e0e1e7',
  },
  tick: {
    position: 'absolute',
    right: 0,
    width: 7,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(140,140,150,0.85)',
  },
  fineHint: {
    height: 14,
    justifyContent: 'center',
  },
  fineText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
