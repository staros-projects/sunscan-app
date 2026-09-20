import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

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
const FONT_SIZE = 8.5;
const PADDING = 3;
// Beyond that the labels are sharp enough and the font sizes get silly
const MAX_SHARPEN = 4;
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
 * Lives inside the Zoomable, as a sibling of the image and with the same box,
 * so it pans and zooms with the spectrum for free. Two things keep it readable
 * when zoomed :
 *
 *   - every label is scaled by the inverse of the zoom, so the text keeps its
 *     size on screen. That runs on the UI thread off the shared value the
 *     Zoomable drives, and follows a pinch frame by frame. It is laid out
 *     `zoom` times bigger to match, so that iOS rasterises the names at the
 *     size the zoom is going to show them at (see `sharpen` below).
 *   - how many labels fit, and where the visible part of the frame starts, only
 *     matter once the gesture is over : those come as plain props (`zoom`,
 *     `visibleLeft`) that the screen refreshes when the interaction ends.
 *     Zooming in therefore reveals the fainter lines, like a map reveals the
 *     smaller towns.
 *
 * @param features what identifyLines() returned
 * @param sampleCount length of the profile the features were measured on
 * @param width,height the box of the image, in layout points
 * @param zoomScale the Reanimated shared value handed to the Zoomable
 * @param zoom settled zoom factor
 * @param visibleLeft,visibleRight edges of what is on screen, in the image's
 *   own coordinates (beyond the image when there is room around it)
 * @param sunLeft column of the left limb of the Sun, in frame columns, or null
 *   to hang the labels off the left edge of the image
 */
export default function LineIdentOverlay({
  features,
  sampleCount,
  width,
  height,
  zoomScale,
  zoom = 1,
  visibleLeft = -LABEL_WIDTH,
  visibleRight = Infinity,
  sunLeft = null,
}) {
  // Where "contain" draws the frame inside the box
  const frame = useMemo(() => {
    const aspect = FRAME_COLUMNS / Math.max(1, sampleCount);
    const drawnHeight = Math.min(height, width / aspect);
    const drawnWidth = drawnHeight * aspect;
    return {
      top: (height - drawnHeight) / 2,
      height: drawnHeight,
      left: (width - drawnWidth) / 2,
      width: drawnWidth,
    };
  }, [sampleCount, width, height]);

  const labels = useMemo(() => {
    const pointsPerSample = (frame.height / Math.max(1, sampleCount)) * zoom;
    return selectLabels(features, {
      minGap: LABEL_HEIGHT / pointsPerSample,
      maxCount: MAX_LABELS,
      isKey: (feature) => keyLineOf(feature) != null,
    });
  }, [features, sampleCount, frame.height, zoom]);

  // iOS draws a Text once, at the size it was laid out, and CoreAnimation
  // stretches that bitmap when the Zoomable scales up : at 3x the names turn
  // to mush, while their badge and their tick, drawn by the compositor rather
  // than rasterised, stay sharp. So the labels are laid out `zoom` times
  // bigger and shrunk back by as much : same size on screen, drawn with the
  // pixels the zoom is about to ask for. Android redraws text through the
  // canvas matrix and would do without it, but the geometry is the same.
  const sharpen = Math.min(Math.max(1, zoom), MAX_SHARPEN);

  const counterScale = useAnimatedStyle(
    () => ({ transform: [{ scale: 1 / (sharpen * Math.max(1, zoomScale.value)) }] }),
    [sharpen],
  );

  // Labels hang just left of the solar limb, so they stay next to the lines
  // whatever the width of the Sun on the slit (left of the image when the limb
  // is unknown). Everything scales with the zoom but the labels, hence the
  // divisions. Once the zoom pushes that spot out of view the labels ride the
  // visible edge instead, over the spectrum on the left, pointing at the limb
  // beyond it on the right.
  const limb = sunLeft == null
    ? 0
    : frame.left + (sunLeft / FRAME_COLUMNS) * frame.width - LIMB_GAP / zoom;
  const anchor = Math.min(
    Math.max(limb, visibleLeft + LABEL_WIDTH / zoom),
    visibleRight,
  );

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'visible' }]}>
      {labels.map((feature) => {
        const y = frame.top + ((feature.position + 0.5) / sampleCount) * frame.height;
        const key = keyLineOf(feature);
        const color = key ? key.color : (feature.telluric ? TELLURIC_COLOR : SOLAR_COLOR);
        return (
          <Animated.View
            key={feature.wavelengthA}
            style={[
              styles.label,
              {
                width: LABEL_WIDTH * sharpen,
                height: LABEL_HEIGHT * sharpen,
                right: width - anchor,
                top: y - (LABEL_HEIGHT * sharpen) / 2,
              },
              counterScale,
            ]}
          >
            <View
              style={[
                styles.badge,
                { paddingHorizontal: PADDING * sharpen, borderRadius: PADDING * sharpen },
                key && { backgroundColor: color },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  { fontSize: FONT_SIZE * sharpen, lineHeight: LABEL_HEIGHT * sharpen },
                  key ? styles.keyText : { color },
                ]}
              >
                {feature.label} {feature.wavelengthA.toFixed(1)}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: color,
                width: TICK_WIDTH * sharpen,
                height: StyleSheet.hairlineWidth * 2 * sharpen,
              }}
            />
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    // The tick is the part that has to stay on the line while the label shrinks
    transformOrigin: 'right center',
  },
  // The rounded background sits on a wrapper rather than on the Text itself :
  // clipping a Text to a radius costs an offscreen pass on iOS, which is one
  // more place for the glyphs to lose their pixels.
  badge: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  // The tag colours are dark : they fill the badge, under white bold text
  keyText: {
    color: '#fff',
    fontWeight: '700',
  },
});
