// Where the solar disk actually sits along the slit, measured on the live frame.
//
// SolarGeometry says where the disk *should* be placed before the scan starts.
// This module closes the loop : it reads the intensity profile the backend
// streams and says where the disk *is*, so the assistant can guide instead of
// merely predict.
//
// Measuring beats trusting the optical formulas here. The arcmin-per-sample
// scale falls out of the observed disk width compared to the known solar
// diameter, so it stays right whatever the binning mode, and it absorbs any
// error in the assumed focal lengths or slit length.

import { sensorFieldArcmin, SUNSCAN_OPTICS } from './SolarGeometry';

// The backend sends `frame[0, 500:1500]` of a mono frame on the `intensity`
// channel (see the websocket loop in sunscan-backend/app/main.py). Mono frames
// are half the sensor width, because every monobin mode either bins 2x2 or
// pulls a single Bayer channel : 4056 -> 2028 samples across the slit.
export const INTENSITY_WINDOW = {
  frameSamples: 2028,
  start: 500,
  end: 1500,
};

// Disk edges closer than this to the ends of the window are the window cutting
// the disk, not the limb : treat them as "not seen".
const EDGE_GUARD_SAMPLES = 4;

// Below this peak-to-background ratio there is no disk on the slit at all
const MIN_CONTRAST_RATIO = 0.18;

// Close enough to the mark that nudging the tripod further is not worth the
// observer's time : under a tenth of the usable margin, and well under what a
// hand on a tripod head can resolve anyway.
export const TARGET_TOLERANCE_ARCMIN = 1.5;

// Box width of the smoothing applied before edge detection, in samples. Wide
// enough to kill sensor noise, far narrower than the ~800 sample disk.
const SMOOTH_SAMPLES = 5;

// A measured scale further than this from the optical prediction is a bad
// measurement, not a surprising instrument.
const SCALE_TOLERANCE = 0.25;

// Exponential smoothing applied to the scale, so it settles instead of
// twitching frame to frame
const SCALE_SMOOTHING = 0.15;

/** Nominal arcminutes per intensity sample, from the optics alone. */
export function nominalArcminPerSample(optics = SUNSCAN_OPTICS) {
  return sensorFieldArcmin(optics) / INTENSITY_WINDOW.frameSamples;
}

/**
 * Offset of the middle of the streamed window from the middle of the field, in
 * samples. The window is not quite centred : samples 500..1500 are centred on
 * 999.5 while the frame centre is 1013.5.
 */
function windowCentreBiasSamples() {
  const windowCentre = (INTENSITY_WINDOW.start + INTENSITY_WINDOW.end - 1) / 2;
  const frameCentre = (INTENSITY_WINDOW.frameSamples - 1) / 2;
  return windowCentre - frameCentre;
}

// Centred moving average over a prefix-sum, so the cost stays linear and the
// two ends average over whatever samples exist rather than darkening.
function smooth(values, width) {
  const n = values.length;
  const half = Math.floor(width / 2);
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i += 1) {
    prefix[i + 1] = prefix[i] + values[i];
  }
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const from = Math.max(0, i - half);
    const to = Math.min(n, i + half + 1);
    out[i] = (prefix[to] - prefix[from]) / (to - from);
  }
  return out;
}

// How far around a half-maximum crossing to look for the steepest point
const EDGE_REFINE_SAMPLES = 20;

/**
 * Refine a limb position by finding the steepest point of the profile near it.
 *
 * A half-maximum threshold looks like the obvious edge detector but it is
 * biased : limb darkening drags the intensity at the true limb well below half
 * of the central peak, so the crossing lands a good 1.5% inside the disk. The
 * inflexion point does not care about the plateau level, so it recovers the
 * diameter unbiased. This is also what the backend's focus analyzer keys on,
 * which keeps the two agreeing on where the limb is.
 *
 * @param rising true for the left limb (profile going up), false for the right
 */
function refineEdge(profile, approxIndex, rising) {
  const n = profile.length;
  const from = Math.max(1, Math.round(approxIndex) - EDGE_REFINE_SAMPLES);
  const to = Math.min(n - 2, Math.round(approxIndex) + EDGE_REFINE_SAMPLES);

  let best = -1;
  let bestSlope = 0;
  for (let i = from; i <= to; i += 1) {
    // central difference, signed so that a steeper edge always scores higher
    const slope = (profile[i + 1] - profile[i - 1]) * (rising ? 1 : -1);
    if (slope > bestSlope) {
      bestSlope = slope;
      best = i;
    }
  }
  if (best < 1 || best > n - 2) {
    return approxIndex;
  }

  // Parabolic interpolation through the three slopes around the peak, for a
  // sub-sample position
  const slopeAt = (i) => (profile[i + 1] - profile[i - 1]) * (rising ? 1 : -1);
  const y0 = slopeAt(best - 1);
  const y1 = slopeAt(best);
  const y2 = slopeAt(best + 1);
  const denominator = y0 - 2 * y1 + y2;
  const shift = denominator !== 0 ? (0.5 * (y0 - y2)) / denominator : 0;
  return best + (Math.abs(shift) <= 1 ? shift : 0);
}

/**
 * Locate the two limbs in an intensity profile.
 *
 * @param {Array<number|string>} rawProfile the `intensity` payload
 * @returns {{lit:boolean, hasLeft:boolean, hasRight:boolean, leftEdge:number,
 *            rightEdge:number, widthSamples:number, samples:number, contrast:number}}
 */
export function analyzeProfile(rawProfile) {
  const n = rawProfile?.length ?? 0;
  const empty = {
    lit: false, hasLeft: false, hasRight: false,
    leftEdge: null, rightEdge: null, widthSamples: null, samples: n, contrast: 0,
  };
  if (n < 32) {
    return empty;
  }

  const values = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const v = typeof rawProfile[i] === 'number' ? rawProfile[i] : parseFloat(rawProfile[i]);
    values[i] = Number.isFinite(v) ? v : 0;
  }

  const profile = smooth(values, SMOOTH_SAMPLES);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i += 1) {
    if (profile[i] < min) min = profile[i];
    if (profile[i] > max) max = profile[i];
  }

  const contrast = max > 0 ? (max - min) / max : 0;
  if (contrast < MIN_CONTRAST_RATIO) {
    return { ...empty, contrast };
  }

  // Half way up the limb : the steepest, least focus-sensitive part of the edge
  const level = min + 0.5 * (max - min);

  let leftIndex = -1;
  for (let i = 1; i < n; i += 1) {
    if (profile[i - 1] < level && profile[i] >= level) {
      leftIndex = i - 1;
      break;
    }
  }
  let rightIndex = -1;
  for (let i = n - 2; i >= 0; i -= 1) {
    if (profile[i + 1] < level && profile[i] >= level) {
      rightIndex = i;
      break;
    }
  }

  // The threshold says whether a limb is in the window at all ; the gradient
  // says exactly where it is.
  const leftEdge = leftIndex >= 0 ? refineEdge(profile, leftIndex, true) : 0;
  const rightEdge = rightIndex >= 0 ? refineEdge(profile, rightIndex + 1, false) : n - 1;

  const hasLeft = leftIndex >= 0 && leftEdge > EDGE_GUARD_SAMPLES;
  const hasRight = rightIndex >= 0 && rightEdge < n - 1 - EDGE_GUARD_SAMPLES;

  return {
    lit: true,
    hasLeft,
    hasRight,
    leftEdge,
    rightEdge,
    widthSamples: rightEdge - leftEdge,
    samples: n,
    contrast,
  };
}

/** Fresh calibration state, seeded with the optical prediction. */
export function createCalibration(optics = SUNSCAN_OPTICS) {
  return {
    arcminPerSample: nominalArcminPerSample(optics),
    measured: false,       // true once a full disk has been seen
    nominal: nominalArcminPerSample(optics),
  };
}

/**
 * Refine the plate scale from a profile showing both limbs.
 *
 * The disk width in samples against the known solar diameter gives arcminutes
 * per sample directly, which is the only scale the assistant needs. Returns the
 * previous calibration unchanged when the profile cannot improve on it.
 */
export function refineCalibration(calibration, analysis, diameterArcmin) {
  if (!analysis?.lit || !analysis.hasLeft || !analysis.hasRight) {
    return calibration;
  }
  if (!(analysis.widthSamples > 0) || !(diameterArcmin > 0)) {
    return calibration;
  }

  const candidate = diameterArcmin / analysis.widthSamples;
  const drift = Math.abs(candidate - calibration.nominal) / calibration.nominal;
  if (drift > SCALE_TOLERANCE) {
    // Off by more than a quarter : a partially lit slit or a bad frame
    return calibration;
  }

  const next = calibration.measured
    ? calibration.arcminPerSample + SCALE_SMOOTHING * (candidate - calibration.arcminPerSample)
    : candidate;

  return { ...calibration, arcminPerSample: next, measured: true };
}

/**
 * Position of the disk centre along the slit, in arcminutes from the centre of
 * the field. Positive is towards the right-hand end of the streamed profile,
 * which is a sensor direction : mapping it to the sky is the sign calibration's
 * job.
 *
 * Works on a single limb too, which matters because the whole point is to push
 * the disk off-centre : past about 4' of offset one limb leaves the window.
 *
 * @returns {number|null} null when no limb can be located.
 */
export function measureOffsetArcmin(analysis, calibration, diameterArcmin) {
  if (!analysis?.lit) {
    return null;
  }

  const scale = calibration.arcminPerSample;
  const diameterSamples = diameterArcmin / scale;

  let centre;
  if (analysis.hasLeft && analysis.hasRight) {
    centre = (analysis.leftEdge + analysis.rightEdge) / 2;
  } else if (analysis.hasRight) {
    centre = analysis.rightEdge - diameterSamples / 2;
  } else if (analysis.hasLeft) {
    centre = analysis.leftEdge + diameterSamples / 2;
  } else {
    // Slit fully lit end to end : the disk is centred to within the window,
    // but we cannot say better than that
    return null;
  }

  const windowCentre = (analysis.samples - 1) / 2;
  return (centre - windowCentre + windowCentreBiasSamples()) * scale;
}

// --- Direction of the sensor axis -------------------------------------------
//
// `startOffsetArcmin` is expressed in the sky frame (positive towards higher
// altitude). `measureOffsetArcmin` is expressed in the sensor frame. One sign
// relates the two, and it is a property of the instrument alone : tilting the
// SUNSCAN in elevation or swinging it in azimuth never flips it, and neither
// does changing hemisphere.
//
// The SUNSCAN is always built the same way, so the sign is a constant : the
// disk walks towards the right-hand end of the profile while the Sun climbs
// (morning) and towards the left while it comes down (afternoon).
//
// It used to be learnt by watching the disk drift, but a hand slowly moving the
// tripod head looks exactly like the sky drift, and the learnt sign then always
// put the mark on the side opposite to where the observer was heading.
export const ALONG_SLIT_SIGN = 1;

/**
 * Where the disk should sit on the sensor before the scan is started, in
 * arcminutes from the centre of the field, in the same frame as
 * measureOffsetArcmin.
 */
export function sensorTargetArcmin(geometry, alongSlitSign = ALONG_SLIT_SIGN) {
  if (!geometry) return 0;
  return alongSlitSign * geometry.startOffsetArcmin;
}

/** Same, for where the disk will have arrived once the scan ends. */
export function sensorEndArcmin(geometry, alongSlitSign = ALONG_SLIT_SIGN) {
  if (!geometry) return 0;
  return alongSlitSign * geometry.endOffsetArcmin;
}
