import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { colors, toolbarSurface } from './theme';

// Same colours as the Max ADU tiles of the settings panel
const CHANNEL_COLORS = { r: '#dc2626', g: '#16a34a', b: '#3b82f6' };

// Channels lit for each advice, and the texts that go with it : what was
// measured, then what a tap does about it. Two lines and no more, the bubble
// shares the screen of a phone with the assistant above it.
const ADVICES = {
  red: { lit: ['r'], title: 'channelAdviceRedTitle', action: 'channelAdviceRedAction' },
  rgb: { lit: ['r', 'g', 'b'], title: 'channelAdviceRgbTitle', action: 'channelAdviceRgbAction' },
  blue: { lit: ['b'], title: 'channelAdviceBlueTitle', action: 'channelAdviceBlueAction' },
};

/**
 * Small bubble shown in cropped mode when the light on the slit sits in another
 * Bayer channel than the one in use (see useChannelAdvice). A tap switches to
 * the advised channel, the cross sends the bubble away : it only ever suggests.
 */
export default function ChannelHint({ advice, busy = false, onApply, onClose }) {
  const { t } = useTranslation();
  const progress = useSharedValue(0);
  const content = ADVICES[advice];

  useEffect(() => {
    progress.value = withTiming(content ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [content]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 8 }],
  }));

  if (!content) {
    return null;
  }

  return (
    <Animated.View style={[toolbarSurface, {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      maxWidth: 360,
      backgroundColor: 'rgba(0,0,0,0.85)',
    }, animatedStyle]}>
      <Pressable
        disabled={busy}
        onPress={onApply}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 12, flexShrink: 1 }}
      >
        {busy
          ? <ActivityIndicator size="small" color={colors.accent} style={{ width: 34 }} />
          : <View style={{ flexDirection: 'row', gap: 3, width: 34, justifyContent: 'center' }}>
              {['r', 'g', 'b'].map((channel) => (
                <View key={channel} style={{
                  width: 9,
                  height: 9,
                  borderRadius: 5,
                  backgroundColor: content.lit.includes(channel) ? CHANNEL_COLORS[channel] : 'rgba(255,255,255,0.15)',
                }} />
              ))}
            </View>}
        <View style={{ flexShrink: 1 }}>
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>{t('common:' + content.title)}</Text>
          <Text style={{ color: colors.accent, fontSize: 10, marginTop: 2 }}>{t('common:' + content.action)}</Text>
        </View>
      </Pressable>
      <Pressable onPress={onClose} hitSlop={8} style={{ paddingVertical: 8, paddingHorizontal: 10 }}>
        <Ionicons name="close" size={16} color="#a1a1aa" />
      </Pressable>
    </Animated.View>
  );
}
