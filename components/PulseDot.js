import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

/**
 * Connection indicator: a solid dot, with a halo that expands and fades out
 * on a loop while `pulsing` is true. Reads as "live" rather than as a static
 * colour swatch.
 */
export default function PulseDot({ color, pulsing = false, size = 12 }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (pulsing) {
      pulse.value = 0;
      pulse.value = withRepeat(
        withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
    return () => cancelAnimation(pulse);
  }, [pulsing]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 1.9 }],
  }));

  const dot = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
  };

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute' }, dot, haloStyle]} pointerEvents="none" />
      <View style={dot} />
    </View>
  );
}
