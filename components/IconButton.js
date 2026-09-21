import React from 'react';
import { StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import PressableScale from './PressableScale';

/**
 * Circular translucent control for icons that sit on top of an image.
 *
 * The detail screens used bare white icons floating over the preview, which
 * disappeared against a bright solar disc and gave no touch target to aim at.
 * The dark scrim and hairline ring keep them readable whatever is behind.
 *
 * `IconSet` lets a caller pass MaterialIcons (or any other @expo/vector-icons
 * family) instead of the Ionicons default.
 */
export default function IconButton({
  name,
  size = 22,
  color = '#fff',
  onPress,
  IconSet = Ionicons,
  style,
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.88} style={[styles.button, style]}>
      <IconSet name={name} size={size} color={color} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    // Set once at mount and never repainted, so the rounding survives on Android
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
});
