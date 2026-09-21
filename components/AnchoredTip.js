// Small explanation bubble pointing at a button, on its left. Drawn through the
// OverlayHost like ActionMenu: next to a button of the action column it would
// overflow its parent, and Android delivers no touch outside a parent's bounds,
// so its own button could not be pressed.

import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import PressableScale from './PressableScale';

const WIDTH = 250;
const MARGIN = 12;
const GAP = 12;
// Closes on its own: it explains, it does not ask for anything.
const AUTO_HIDE_MS = 6000;

/**
 * @param anchor {x, y, width, height} of the button, in window coordinates
 * @param text   the explanation
 * @param action optional {label, onPress}, shown as a button under the text
 */
export default function AnchoredTip({ anchor, text, action, onClose }) {
  const [layer, setLayer] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    const id = setTimeout(onClose, AUTO_HIDE_MS);
    return () => {
      sub.remove();
      clearTimeout(id);
    };
  }, [onClose]);

  const measure = () => {
    rootRef.current?.measureInWindow((x, y, width, height) => {
      setLayer({ x, y, width, height });
    });
  };

  let position = null;
  let arrowTop = 0;
  if (layer) {
    const centre = anchor.y - layer.y + anchor.height / 2;
    const top = Math.min(Math.max(MARGIN, centre - 24), layer.height - 120 - MARGIN);
    position = { top, left: Math.max(MARGIN, anchor.x - layer.x - WIDTH - GAP) };
    arrowTop = centre - top - 6;
  }

  return (
    <View ref={rootRef} onLayout={measure} style={StyleSheet.absoluteFill} collapsable={false}>
      {/* Any tap elsewhere closes it, without reaching the screen below */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      {position && (
        <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(100)} style={[styles.bubble, position]}>
          <Text style={styles.text}>{text}</Text>
          {action && (
            <PressableScale className="self-start mt-2 bg-emerald-600 rounded-full px-3 py-1" onPress={() => { onClose(); action.onPress(); }}>
              <Text style={styles.action}>{action.label}</Text>
            </PressableScale>
          )}
          <View style={[styles.arrow, { top: arrowTop }]} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    width: WIDTH,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#27272a',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  text: {
    color: '#fff',
    fontSize: 12,
  },
  action: {
    color: '#fff',
    fontSize: 11,
  },
  arrow: {
    position: 'absolute',
    right: -6,
    width: 12,
    height: 12,
    backgroundColor: '#27272a',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
    transform: [{ rotate: '45deg' }],
  },
});
