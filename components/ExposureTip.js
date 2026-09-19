// One time walkthrough of the EXP tile.
//
// The tile does two things that nothing on it shows : in cropped mode a short
// tap types the exposure in, and a long press steps through the exposure
// ranges (normal, short SE, long LE). The whole app is dimmed but for a round
// window over the tile, with the two gestures spelled out underneath, the way
// a tutorial points at the one control it is about.
//
// Drawn through the OverlayHost rather than in a Modal : the veil and the tile
// then sit in the same native window, and the window lands on the tile
// whatever the cutouts and system bars of the device.

import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import PressableScale from './PressableScale';
import { colors, modalCard } from './theme';

const BUBBLE_WIDTH = 320;
const MARGIN = 12;
// Room around the tile, so the window frames it instead of cutting its edges
const HOLE_PADDING = 14;

/**
 * @param target {x, y, width, height} of the EXP tile, in window coordinates
 *   (measureInWindow)
 */
export default function ExposureTip({ target, onClose }) {
  const { t } = useTranslation();
  // Where the layer sits in the window, and its size : the tile is measured
  // in the window, and brought into the layer by taking its origin off.
  const [size, setSize] = useState(null);
  const rootRef = useRef(null);

  // Back closes the walkthrough, as it would a dialog, instead of leaving
  // the screen from under it
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const measure = () => {
    rootRef.current?.measureInWindow((x, y, width, height) => {
      setSize({ x, y, width, height });
    });
  };

  const cx = target.x - (size?.x ?? 0) + target.width / 2;
  const cy = target.y - (size?.y ?? 0) + target.height / 2;
  const r = Math.max(target.width, target.height) / 2 + HOLE_PADDING;

  // Screen covered edge to edge, less a circle : even-odd filling leaves the
  // inner sub path empty.
  const veil = size && [
    `M0 0 H${size.width} V${size.height} H0 Z`,
    `M${cx - r} ${cy}`,
    `a${r} ${r} 0 1 0 ${2 * r} 0`,
    `a${r} ${r} 0 1 0 ${-2 * r} 0 Z`,
  ].join(' ');

  // Under the window, centred on it as far as the edges of the screen allow
  const bubbleLeft = size
    ? Math.min(size.width - BUBBLE_WIDTH - MARGIN, Math.max(MARGIN, cx - BUBBLE_WIDTH / 2))
    : MARGIN;
  const arrowLeft = Math.min(BUBBLE_WIDTH - 24, Math.max(12, cx - bubbleLeft - 8));

  return (
      <Pressable
        ref={rootRef}
        collapsable={false}
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        onLayout={measure}
      >
        {size && (
          <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
            <Path d={veil} fill="rgba(0,0,0,0.75)" fillRule="evenodd" />
            <Circle cx={cx} cy={cy} r={r} stroke={colors.accent} strokeWidth={2} fill="none" />
          </Svg>
        )}

        {size && <View style={[styles.bubbleWrapper, { left: bubbleLeft, top: cy + r + 10 }]}>
          <View style={[styles.arrow, { marginLeft: arrowLeft }]} />
          <View style={styles.bubble}>
            <Text style={styles.title}>{t('common:expTipTitle')}</Text>

            <View style={styles.row}>
              <View style={styles.gesture}>
                <Ionicons name="finger-print-outline" size={16} color={colors.accent} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.label}>{t('common:expTipTapLabel')}</Text>
                <Text style={styles.detail}>{t('common:expTipTapDetail')}</Text>
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.gesture}>
                <Ionicons name="timer-outline" size={16} color={colors.accent} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.label}>{t('common:expTipLongPressLabel')}</Text>
                <Text style={styles.detail}>{t('common:expTipLongPressDetail')}</Text>
              </View>
            </View>

            <PressableScale style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>{t('common:gotIt')}</Text>
            </PressableScale>
          </View>
        </View>}
      </Pressable>
  );
}

const styles = StyleSheet.create({
  bubbleWrapper: {
    position: 'absolute',
    width: BUBBLE_WIDTH,
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#18181b',
  },
  bubble: {
    ...modalCard,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  gesture: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,185,129,0.15)',
    marginRight: 10,
  },
  rowText: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  detail: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 1,
  },
  button: {
    marginTop: 4,
    alignSelf: 'flex-end',
    backgroundColor: 'rgb(5 150 105)',
    paddingVertical: 7,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
  },
});
