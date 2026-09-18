// Where the left limb of the Sun falls on the full frame.
//
// Outside cropped mode the frame shows the spectrum of a strip of the Sun :
// dispersion runs top to bottom, the slit left to right, so the Sun is a bright
// band across the middle of the frame with dark sky on either side. Its width
// depends on where the slit cuts the disk, which is why the line labels are
// hung off its left edge rather than off the frame.
//
// Plain arithmetic on an RGBA buffer, free of React and of Skia, so it runs
// under Node for testing.

// Rows kept in the middle of the frame. The lines run across the frame, so
// averaging rows costs the edge nothing and irons out the deepest of them.
export const LIMB_BAND_SHARE = 0.4;

// Columns smoothed over before looking for the edge, as a share of the width
const SMOOTHING_SHARE = 0.01;

// Contrast between sky and Sun under which there is no Sun to speak of, out of
// 255 : a closed cap, a cloud, a frame stretched on noise.
const MIN_CONTRAST = 24;

// The band has to stay bright over this share of the width past the edge : a
// hot pixel or a reflection is not the Sun.
const MIN_SUN_SHARE = 0.04;

/**
 * @param pixels RGBA bytes of a band of `rows` full rows of the frame
 * @param width width of the frame, in pixels
 * @param rows number of rows in `pixels`
 * @returns the left limb as a fraction of the width (0 left edge, 1 right
 *   edge), or null when no Sun can be told from the sky
 */
export function leftLimbOf(pixels, width, rows) {
  if (!pixels || width < 16 || rows < 1 || pixels.length < width * rows * 4) {
    return null;
  }

  // Brightest channel of each pixel : the colour frames are tinted, the mono
  // ones grey, and either way that is the channel that shows the Sun best.
  const levels = new Float32Array(width);
  for (let y = 0; y < rows; y += 1) {
    let i = y * width * 4;
    for (let x = 0; x < width; x += 1, i += 4) {
      levels[x] += Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
    }
  }

  const half = Math.max(1, Math.round((width * SMOOTHING_SHARE) / 2));
  const smooth = new Float32Array(width);
  let sum = 0;
  let count = 0;
  for (let x = -half; x < width; x += 1) {
    const inX = x + half;
    if (inX < width) { sum += levels[inX]; count += 1; }
    const outX = x - half - 1;
    if (outX >= 0) { sum -= levels[outX]; count -= 1; }
    if (x >= 0) smooth[x] = sum / (count * rows);
  }

  const sorted = Array.from(smooth).sort((a, b) => a - b);
  const sky = sorted[Math.floor(width * 0.05)];
  const sun = sorted[Math.floor(width * 0.95)];
  if (sun - sky < MIN_CONTRAST) {
    return null;
  }

  // First column past half way between sky and Sun that stays there
  const threshold = (sky + sun) / 2;
  const run = Math.max(2, Math.round(width * MIN_SUN_SHARE));
  for (let x = 0; x + run <= width; x += 1) {
    if (smooth[x] < threshold) continue;
    let stays = true;
    for (let k = 1; k < run; k += 1) {
      if (smooth[x + k] < threshold) { stays = false; x += k; break; }
    }
    if (!stays) continue;
    // Sub-pixel crossing between the column below and the one above
    if (x === 0) return 0;
    const below = smooth[x - 1];
    const crossing = x - 1 + (threshold - below) / Math.max(1e-6, smooth[x] - below);
    return (crossing + 0.5) / width;
  }
  return null;
}
