import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

/**
 * Fades its children in with a small upward rise.
 *
 * Driven by an `active` flag rather than a mount animation, because the tab
 * navigator keeps every screen mounted and merely toggles `display`: an
 * `entering` animation would play once at app startup, off screen. Pass the
 * screen's focus state and the reveal replays on every visit instead.
 */
export default function Reveal({
  active = true,
  delay = 0,
  distance = 24,
  duration = 700,
  style,
  children,
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (active) {
      progress.value = withDelay(
        delay,
        withTiming(1, { duration, easing: Easing.out(Easing.cubic) })
      );
    } else {
      // Snap back while the screen is hidden so the next focus starts from zero.
      progress.value = 0;
    }
  }, [active, delay, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
