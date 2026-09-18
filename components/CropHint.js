import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { colors, toolbarSurface } from './theme';

/**
 * Small bubble shown next to the right toolbar when the user presses record
 * while the frame is not cropped : an acquisition only runs in cropped mode,
 * so it points at the crop button and shows its icon to make the next step
 * obvious. Dismisses itself after a few seconds, or on tap.
 */
export default function CropHint({ visible, onClose, duration = 4000 }) {
  const { t } = useTranslation();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
    if (!visible) {
      return;
    }
    const id = setTimeout(onClose, duration);
    return () => clearTimeout(id);
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: (1 - progress.value) * 12 }],
  }));

  if (!visible) {
    return null;
  }

  return (
    <Animated.View style={[{ width: 270, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }, animatedStyle]}>
      <Pressable
        onPress={onClose}
        style={[toolbarSurface, {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 10,
          paddingHorizontal: 12,
          flexShrink: 1,
          backgroundColor: 'rgba(0,0,0,0.85)',
        }]}
      >
        <View style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: colors.accent,
        }}>
          <Ionicons name="crop-outline" size={22} color={colors.accent} />
        </View>
        <View style={{ flexShrink: 1 }}>
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>{t('common:cropRequiredTitle')}</Text>
          <Text style={{ color: '#d4d4d8', fontSize: 11, marginTop: 2 }}>{t('common:cropRequiredMsg')}</Text>
        </View>
      </Pressable>
      {/* arrow pointing at the crop button */}
      <View style={{
        width: 0,
        height: 0,
        borderTopWidth: 8,
        borderBottomWidth: 8,
        borderLeftWidth: 9,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: 'rgba(0,0,0,0.85)',
      }} />
    </Animated.View>
  );
}
