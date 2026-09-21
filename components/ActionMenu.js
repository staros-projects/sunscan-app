// Menu of the secondary actions of a detail screen, opened from a "more"
// button. The action column grew one round button per feature until it no
// longer fit the height of a phone in landscape: the frequent actions stay
// there, the others are listed here with their name, which an icon alone never
// said clearly.
//
// Drawn through the OverlayHost rather than in a Modal, like ExposureTip: the
// menu and the button it opens from then share one frame of reference, and the
// menu lands next to the button whatever the cutouts of the device.

import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { modalCard } from './theme';

const MENU_WIDTH = 230;
const ROW_HEIGHT = 44;
const MARGIN = 12;
// Room between the menu and the button it opens from
const GAP = 10;

/**
 * @param anchor {x, y, width, height} of the button, in window coordinates
 *   (measureInWindow). The menu opens on its left, centred on it.
 * @param items  [{key, icon, label, onPress, destructive, color, IconSet}]
 *   IconSet: an @expo/vector-icons family other than the Ionicons default
 */
export default function ActionMenu({ anchor, items, onClose }) {
  const [layer, setLayer] = useState(null);
  const rootRef = useRef(null);

  // Back closes the menu instead of leaving the screen from under it
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const measure = () => {
    rootRef.current?.measureInWindow((x, y, width, height) => {
      setLayer({ x, y, width, height });
    });
  };

  let position = null;
  if (layer) {
    const height = items.length * ROW_HEIGHT;
    const centre = anchor.y - layer.y + anchor.height / 2;
    position = {
      top: Math.min(Math.max(MARGIN, centre - height / 2), layer.height - height - MARGIN),
      left: Math.max(MARGIN, anchor.x - layer.x - MENU_WIDTH - GAP),
    };
  }

  // The menu closes before the action runs: an action opening a dialog of its
  // own must not end up under it.
  const run = (item) => {
    onClose();
    item.onPress();
  };

  return (
    <View ref={rootRef} onLayout={measure} style={StyleSheet.absoluteFill} collapsable={false}>
      <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onClose} />
      {position && (
        <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(100)} style={[styles.menu, position]}>
          {items.map((item, i) => (
            <Pressable
              key={item.key}
              onPress={() => run(item)}
              style={({ pressed }) => [styles.row, i > 0 && styles.separator, pressed && styles.pressed]}
            >
              <IconOf item={item} size={18} color={item.destructive ? '#ef4444' : (item.color || '#fff')} />
              <Text style={[styles.label, item.destructive && { color: '#ef4444' }]} numberOfLines={1}>{item.label}</Text>
            </Pressable>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

function IconOf({ item, ...props }) {
  const IconSet = item.IconSet || Ionicons;
  return <IconSet name={item.icon} {...props} />;
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  menu: {
    ...modalCard,
    position: 'absolute',
    width: MENU_WIDTH,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 12,
  },
  separator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  pressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  label: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
  },
});
