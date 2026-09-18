import React from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Springs kept short and fairly stiff: the touch should feel acknowledged,
// not animated. Anything slower reads as lag on a press.
const PRESS_SPRING = { damping: 20, stiffness: 400, mass: 0.5 };

/**
 * Pressable that dips slightly under the finger.
 *
 * Drop-in replacement for Pressable, className included: NativeWind resolves the
 * classes into the `style` prop, which is merged with the animated transform
 * here. Note that NativeWind v2 ignores a `style` *function*, so press feedback
 * has to come from an animated style rather than Pressable's ({pressed}) API.
 */
// forwardRef because NativeWind wraps any element carrying a className and
// forwards a ref to it; a plain function component would warn here.
const PressableScale = React.forwardRef(function PressableScale(
  { children, style, scaleTo = 0.95, disabled, onPressIn, onPressOut, ...props },
  ref
) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      ref={ref}
      disabled={disabled}
      // A caller's own handlers are composed with the animation rather than
      // spread over it : passing onPressIn used to silently kill the dip.
      onPressIn={(e) => {
        if (!disabled) {
          scale.value = withSpring(scaleTo, PRESS_SPRING);
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, PRESS_SPRING);
        onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
});

export default PressableScale;
