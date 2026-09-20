import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { selectLabels } from '../utils/SpectrumIdent';
import { linesDict } from './LineSelector';

// Mono frames are half the sensor width : 4056 -> 2028 columns. With the row
// count of the profile this gives the aspect ratio of the frame, hence where
// `contentFit="contain"` puts it inside its box.
const FRAME_COLUMNS = 2028;

// Room one label takes on screen, whatever the zoom
const LABEL_HEIGHT = 11;
const LABEL_WIDTH = 86;
const TICK_WIDTH = 8;
// Room left between the tip of the ticks and the limb
const LIMB_GAP = 3;
const MAX_LABELS = 40;

export const SOLAR_COLOR = '#fde68a';     // amber-200
export const TELLURIC_COLOR = '#7dd3fc';  // sky-300

// The lines a scan can be tagged with at the end of a recording (Balmer, Na,
// Mg b, Ca II H & K...) : those are the ones people point the grating at, so
// they stand out, in the colour of their tag. The species has to agree as well
// as the wavelength : Fe I 5167.5 sits right next to Mg I 5167.3. Most tags
// are a single line, matched to an angstrom ; the sodium tag stands for the D
// doublet (5890 and 5896), hence its wider window.
const KEY_LINES = linesDict
  .filter((line) => line.wl && line.color)
  .map((line) => ({
    wavelengthA: parseFloat(line.wl),
    toleranceA: line.key === 'sodium' ? 3.5 : 1,
    species: line.short,
    color: line.color,
  }));

function keyLineOf(feature) {
  return KEY_LINES.find(
    (line) => Math.abs(line.wavelengthA - feature.wavelengthA) <= line.toleranceA
      && feature.label.startsWith(line.species),
  ) || null;
}

/**
 * Names of the spectral lines, pinned on the live frame.
 *
 * Drawn beside the Zoomable, not inside it, in the coordinates of the screen.
 * Inside it the labels had to be scaled down by the zoom to keep their size,
 * and iOS rasterises a scaled-down view at that reduced size before the zoom
 * stretches it back : past 2x the names and even the ticks were mush. Out
 * here they are plain views at screen resolution.
 *
 * The price is that they cannot follow a gesture frame by frame : the
 * Zoomable only tells where it stands once the gesture is over. So they fade
 * out while the spectrum moves and come back where it stops. Zooming in still
 * reveals the fainter lines, like a map reveals the smaller towns.
 *
 * @param features what identifyLines() returned
 * @param sampleCount length of the profile the features were measured on
 * @param frameWidth,frameHeight the box of the image, in layout points
 * @param view where the Zoomable left its content : `scale`, `translateX`,
 *   `translateY` as its getInfo() reports them, and the `width` and `height`
 *   of its container, which this overlay shares
 * @param visible false while the spectrum is moving
 * @param sunLeft column of the left limb of the Sun, in frame columns, or null
 *   to hang the labels off the left edge of the image
 */
function LineIdentOverlay({
  features,
  sampleCount,
  frameWidth,
  frameHeight,
  view,
  visible = true,
  sunLeft = null,
}) {
  // Where "contain" draws the frame inside the box
  const frame = useMemo(() => {
    const aspect = FRAME_COLUMNS / Math.max(1, sampleCount);
    const drawnHeight = Math.min(frameHeight, frameWidth / aspect);
    const drawnWidth = drawnHeight * aspect;
    return {
      top: (frameHeight - drawnHeight) / 2,
      height: drawnHeight,
      left: (frameWidth - drawnWidth) / 2,
      width: drawnWidth,
    };
  }, [sampleCount, frameWidth, frameHeight]);

  const { scale, translateX, translateY, width, height } = view;

  const labels = useMemo(() => {
    const pointsPerSample = (frame.height / Math.max(1, sampleCount)) * scale;
    return selectLabels(features, {
      minGap: LABEL_HEIGHT / pointsPerSample,
      maxCount: MAX_LABELS,
      isKey: (feature) => keyLineOf(feature) != null,
    });
  }, [features, sampleCount, frame.height, scale]);

  // The image box sits centred in the container, and the Zoomable scales its
  // content about the centre of that container after translating it : a point
  // of the box lands on screen at centre + translate + (point - box centre) x
  // scale. The same mapping, inverted, is what the screen uses to tell which
  // part of the frame is showing.
  const toScreenX = (x) => width / 2 + translateX + (x - frameWidth / 2) * scale;
  const toScreenY = (y) => height / 2 + translateY + (y - frameHeight / 2) * scale;

  // Labels hang just left of the solar limb, so they stay next to the lines
  // whatever the width of the Sun on the slit (left of the image when the limb
  // is unknown). Once the zoom pushes that spot out of view they ride the
  // visible edge instead, over the spectrum on the left, pointing at the limb
  // beyond it on the right.
  const limb = sunLeft == null ? 0 : frame.left + (sunLeft / FRAME_COLUMNS) * frame.width;
  const anchor = Math.min(Math.max(toScreenX(limb) - LIMB_GAP, LABEL_WIDTH), width);

  const fade = useAnimatedStyle(
    () => ({ opacity: withTiming(visible ? 1 : 0, { duration: visible ? 180 : 90 }) }),
    [visible],
  );

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overlay, fade]}>
      {labels.map((feature) => {
        const y = toScreenY(frame.top + ((feature.position + 0.5) / sampleCount) * frame.height);
        if (y < -LABEL_HEIGHT || y > height + LABEL_HEIGHT) {
          return null;
        }
        const key = keyLineOf(feature);
        const color = key ? key.color : (feature.telluric ? TELLURIC_COLOR : SOLAR_COLOR);
        return (
          <View
            key={feature.wavelengthA}
            style={[styles.label, { right: width - anchor, top: y - LABEL_HEIGHT / 2 }]}
          >
            <View style={[styles.badge, key && { backgroundColor: color }]}>
              <Text numberOfLines={1} style={[styles.text, key ? styles.keyText : { color }]}>
                {feature.label} {feature.wavelengthA.toFixed(1)}
              </Text>
            </View>
            <View style={[styles.tick, { backgroundColor: color }]} />
          </View>
        );
      })}
    </Animated.View>
  );
}

// The labels only move when the identification finds a new solution or the
// zoom settles, while the screen around them re-renders with the live feed :
// the props are shallow-compared so those frames cost nothing here.
export default React.memo(LineIdentOverlay);

const styles = StyleSheet.create({
  overlay: {
    overflow: 'hidden',
  },
  label: {
    position: 'absolute',
    width: LABEL_WIDTH,
    height: LABEL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  // The rounded background sits on a wrapper rather than on the Text itself :
  // clipping a Text to a radius costs an offscreen pass on iOS.
  badge: {
    paddingHorizontal: 3,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  text: {
    fontSize: 8.5,
    lineHeight: LABEL_HEIGHT,
  },
  // The tag colours are dark : they fill the badge, under white bold text
  keyText: {
    color: '#fff',
    fontWeight: '700',
  },
  tick: {
    width: TICK_WIDTH,
    height: StyleSheet.hairlineWidth * 2,
  },
});
