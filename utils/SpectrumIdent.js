// Which stretch of the solar spectrum is on screen, and what its lines are.
//
// Outside cropped mode the frame shows about a hundred angstroms of spectrum,
// dispersed top to bottom. The backend can stream one column of it as a 12 bit
// profile (the `profile` websocket channel) : this module works out where that
// profile sits in the solar spectrum, then names the lines in it.
//
// Nothing tells the app where the grating is pointing, so the position has to
// be recovered from the spectrum alone, the way a plate solver recovers a
// pointing from the stars alone. The profile is slid along a reference solar
// atlas and the wavelength with the best correlation wins. The atlas was taken
// from the ground, so the telluric O2 and H2O lines take part in the match
// like any other line instead of getting in its way.
//
// Correlating a whole spectrum beats pairing detected lines with a line list :
// it degrades gracefully with noise, it needs no detection threshold, and a
// blend the instrument cannot split still scores for what it is.
//
// What the optics predict is trusted only so far. The dispersion follows from
// the grating equation, but the focal length has a tolerance and the angle of
// the grating mount is assumed rather than measured, so a scale factor is
// fitted along with the wavelength. Which end of the frame is blue depends on
// how the light folds inside the box : both directions are simply tried. Once
// found, the two are worth remembering (see `calibration` below), which makes
// the next search ten times shorter.
//
// Everything here is plain arithmetic on typed arrays, free of React and of the
// network, so it runs under Node for testing.

import { SUNSCAN_OPTICS } from './SolarGeometry';
import {
  ATLAS_BASE64,
  ATLAS_CONTINUUM,
  ATLAS_COUNT,
  ATLAS_START_A,
  ATLAS_STEP_A,
} from './data/SolarAtlas';
import { LINES, SPECIES } from './data/SolarLines';

const RAD = Math.PI / 180;

// Mono frames are half the sensor resolution (2x2 binning, or a single Bayer
// channel) : one profile sample spans two sensor pixels.
const PROFILE_BINNING = 2;

// A cropped frame is about 130 samples tall, some 13 A : far too little to tell
// one stretch of spectrum from another.
export const MIN_PROFILE_SAMPLES = 400;

// Mean level under which there is no Sun on the column, out of 4095
const MIN_LEVEL_ADU = 120;
// Share of clipped samples above which line depths mean nothing any more
const MAX_SATURATED_SHARE = 0.3;
const SATURATION_ADU = 4090;
// Spread of the line depths under which the profile is a featureless ramp
const MIN_DEPTH_SPREAD = 0.012;

// Dispersion per profile sample, give or take 15% across the visible. Only used
// to size windows, never to compute a wavelength.
const NOMINAL_SAMPLE_A = 0.11;

// Width of the sliding window that follows the continuum. Wide enough to ride
// over any metallic line, narrow enough to follow vignetting along the frame.
// The wings of H alpha or Ca II K are wider and get flattened : the atlas goes
// through the very same treatment, so both sides lose the same thing.
const ENVELOPE_WINDOW_A = 9;

// The search runs coarse to fine : block-averaging the profile by 8 makes the
// blind pass 64 times cheaper, and what it finds is then polished on sharper
// versions.
const COARSE_FACTOR = 8;
const MID_FACTOR = 2;
const FINE_FACTOR = 1;

// Dispersion scales tried by the blind search, relative to the optical
// prediction. 2% apart, so never more than 1% off : at the coarse level that
// slides the ends of the window by about half a sample. Any looser and the
// stretches of spectrum with few, narrow lines (the far red) stop matching.
const BLIND_SCALES = [0.94, 0.96, 0.98, 1, 1.02, 1.04, 1.06];

// Coarse peaks closer than this are the same match seen twice
const PEAK_SEPARATION_A = 4;
// How many coarse peaks are worth polishing. The right one is nearly always
// first, but "nearly" is what the runner-up margin below is measured against.
const MAX_SEEDS = 12;
// Two matches closer than this share most of their window : the weaker one is
// the same identification with a worse scale, not a rival. It happens around
// H alpha, whose sheer width keeps a wrongly scaled window correlating.
const RIVAL_SEPARATION_A = 15;

// A match is accepted on two counts : it correlates, and it clearly beats the
// best match found anywhere else in the spectrum. The margin is the one that
// tells right from wrong : a noisy profile of the far red, where lines are few
// and faint, correlates at 0.5 with the right place and 0.2 with the next best,
// while a spectrum that is not the Sun's gets 0.35 everywhere alike.
export const MIN_CORRELATION = 0.4;
export const MIN_MARGIN = 0.12;
// Following a known position has no rival to beat, only a correlation to hold
const MIN_TRACK_CORRELATION = 0.4;
// How far the spectrum may have slid between two tracked profiles
const TRACK_RANGE_A = 4;

// A dip has to be this deep to count as a line, on top of the noise allowance
const MIN_LINE_DEPTH = 0.035;
const MIN_LINE_PROMINENCE = 0.015;
// Samples looked at on each side of a dip to measure how much it stands out
const PROMINENCE_REACH = 4;
// A catalogue line further than this from a dip is not that dip
const MATCH_TOLERANCE_A = 0.18;
// Second pass, for the few lines far wider than the instrument profile
const BROAD_SMOOTHING = 7;
const BROAD_REACH = 12;
const BROAD_TOLERANCE_A = 0.35;

// ---------------------------------------------------------------------------
// Small numeric helpers
// ---------------------------------------------------------------------------

// Centred moving average over a prefix sum : linear cost, and the two ends
// average over whatever samples exist.
function boxcar(values, width) {
  const n = values.length;
  const half = Math.floor(width / 2);
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i += 1) {
    prefix[i + 1] = prefix[i] + values[i];
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const from = Math.max(0, i - half);
    const to = Math.min(n, i + half + 1);
    out[i] = (prefix[to] - prefix[from]) / (to - from);
  }
  return out;
}

// Centred sliding maximum. A monotonic queue keeps it linear, which matters
// for the 63000 samples of the atlas.
function runningMax(values, width) {
  const n = values.length;
  const half = Math.floor(width / 2);
  const out = new Float32Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  let next = 0;
  for (let i = 0; i < n; i += 1) {
    const to = Math.min(n - 1, i + half);
    while (next <= to) {
      while (tail > head && values[queue[tail - 1]] <= values[next]) {
        tail -= 1;
      }
      queue[tail] = next;
      tail += 1;
      next += 1;
    }
    while (queue[head] < i - half) {
      head += 1;
    }
    out[i] = values[queue[head]];
  }
  return out;
}

/**
 * Line depth below the local continuum : 0 on the continuum, 1 for a black line.
 *
 * Dividing by an upper envelope rather than subtracting a mean is what makes
 * the live profile comparable to the atlas : vignetting, limb darkening along
 * the column and the exposure level are all multiplicative.
 */
function depthBelowEnvelope(values, envelopeSource, window) {
  const n = values.length;
  // Two passes. On a slope, a sliding maximum always finds its value at the
  // uphill end of the window, so the envelope rides above the continuum by the
  // slope times half the window : with the vignetting of a real frame that is a
  // fake 10% "line" at both ends, enough to drown the few real ones of the far
  // red. After one division the profile is nearly level, and a second envelope
  // taken on that has next to no slope left to be fooled by.
  const first = boxcar(runningMax(envelopeSource, window), window);
  const levelled = new Float32Array(n);
  const levelledSource = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const level = first[i] > 0 ? first[i] : 1;
    levelled[i] = values[i] / level;
    levelledSource[i] = envelopeSource[i] / level;
  }
  const second = boxcar(runningMax(levelledSource, window), window);
  const depth = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const value = second[i] > 0 ? 1 - levelled[i] / second[i] : 0;
    depth[i] = value < 0 ? 0 : (value > 1 ? 1 : value);
  }
  return depth;
}

function median(values) {
  const sorted = Float32Array.from(values).sort();
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Hermes only grew atob() recently : decoding by hand costs twenty lines and
// works everywhere.
function decodeBase64(text, byteCount) {
  const lookup = new Uint8Array(128);
  for (let i = 0; i < BASE64_ALPHABET.length; i += 1) {
    lookup[BASE64_ALPHABET.charCodeAt(i)] = i;
  }
  const out = new Uint8Array(byteCount);
  let written = 0;
  // '=' padding is not in the table and reads as 0, which is what it stands for
  for (let i = 0; i < text.length && written < byteCount; i += 4) {
    const a = lookup[text.charCodeAt(i)];
    const b = lookup[text.charCodeAt(i + 1)];
    const c = lookup[text.charCodeAt(i + 2)];
    const d = lookup[text.charCodeAt(i + 3)];
    out[written] = (a << 2) | (b >> 4);
    written += 1;
    if (written < byteCount) {
      out[written] = ((b & 15) << 4) | (c >> 2);
      written += 1;
    }
    if (written < byteCount) {
      out[written] = ((c & 3) << 6) | d;
      written += 1;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Reference data, unpacked on first use
// ---------------------------------------------------------------------------

let atlasCache = null;
let catalogueCache = null;

// One resolution of the atlas : line depths smoothed to the width of a profile
// sample at that level, then decimated.
function buildAtlasLevel(depth, factor) {
  const smoothBins = Math.max(1, Math.round((factor * NOMINAL_SAMPLE_A) / ATLAS_STEP_A));
  const stepBins = Math.max(1, Math.floor(smoothBins / 2));
  const smoothed = smoothBins > 1 ? boxcar(depth, smoothBins) : depth;
  const count = Math.floor((depth.length - 1) / stepBins) + 1;
  const values = new Float32Array(count);
  for (let k = 0; k < count; k += 1) {
    values[k] = smoothed[k * stepBins];
  }
  const stepA = stepBins * ATLAS_STEP_A;
  return {
    values,
    startA: ATLAS_START_A,
    stepA,
    endA: ATLAS_START_A + (count - 1) * stepA,
  };
}

/**
 * Unpack the atlas. Takes a few tens of milliseconds, once : the solver calls
 * it as its first step so the cost lands inside the search, not at import.
 */
export function getAtlas() {
  if (atlasCache) {
    return atlasCache;
  }
  const bytes = decodeBase64(ATLAS_BASE64, ATLAS_COUNT);
  const flux = new Float32Array(ATLAS_COUNT);
  for (let i = 0; i < ATLAS_COUNT; i += 1) {
    flux[i] = bytes[i] / ATLAS_CONTINUUM;
  }
  const depth = depthBelowEnvelope(flux, flux, Math.round(ENVELOPE_WINDOW_A / ATLAS_STEP_A));
  atlasCache = {
    [COARSE_FACTOR]: buildAtlasLevel(depth, COARSE_FACTOR),
    [MID_FACTOR]: buildAtlasLevel(depth, MID_FACTOR),
    [FINE_FACTOR]: buildAtlasLevel(depth, FINE_FACTOR),
  };
  return atlasCache;
}

function getCatalogue() {
  if (catalogueCache) {
    return catalogueCache;
  }
  const count = LINES.length / 3;
  const wavelengthA = new Float64Array(count);
  const widthMa = new Float32Array(count);
  const species = new Uint16Array(count);
  for (let i = 0; i < count; i += 1) {
    wavelengthA[i] = LINES[3 * i] / 1000;
    widthMa[i] = LINES[3 * i + 1];
    species[i] = LINES[3 * i + 2];
  }
  catalogueCache = { count, wavelengthA, widthMa, species };
  return catalogueCache;
}

// ---------------------------------------------------------------------------
// Dispersion model
// ---------------------------------------------------------------------------

// Grating equation in the first order : lambda = d (sin a + sin b), with the
// incident and diffracted beams a fixed angle apart since neither the
// collimator nor the camera lens moves. Turning the grating changes a and b
// together. The diffracted beam is the one closer to the grating normal, which
// is the Sol'Ex arrangement : it narrows the image of the slit and is where the
// resolving power comes from.
//
// Returned as three lengths so that the wavelength of a sample at an angle t off
// the axis is   offsetA + sinTermA cos t + cosTermA sin t   with no
// trigonometry left in the inner loops.
function gratingTerms(centreA, optics) {
  const spacingA = 1e7 / optics.gratingLinesPerMm;
  const half = (optics.gratingTotalAngleDeg * RAD) / 2;
  const mid = Math.asin(centreA / (2 * spacingA * Math.cos(half)));
  return {
    offsetA: spacingA * Math.sin(mid + half),
    sinTermA: spacingA * Math.sin(mid - half),
    cosTermA: spacingA * Math.cos(mid - half),
  };
}

// Angle off the optical axis of each sample, as seen from the camera lens.
// `positions` are sample indices, fractional for block-averaged levels.
function sampleAngles(positions, count, scale, flip, optics) {
  const pitch = (optics.pixelSizeMm * PROFILE_BINNING * scale) / optics.cameraFocalMm;
  const centre = (count - 1) / 2;
  const sign = flip ? -1 : 1;
  const cos = new Float64Array(positions.length);
  const sin = new Float64Array(positions.length);
  for (let j = 0; j < positions.length; j += 1) {
    const angle = sign * Math.atan((positions[j] - centre) * pitch);
    cos[j] = Math.cos(angle);
    sin[j] = Math.sin(angle);
  }
  return { cos, sin };
}

/**
 * Wavelength in angstroms of a (possibly fractional) sample of the profile.
 *
 * @param solution {centreA, scale, flip, count} as returned by the solver
 */
export function wavelengthAt(solution, position, optics = SUNSCAN_OPTICS) {
  const terms = gratingTerms(solution.centreA, optics);
  const pitch = (optics.pixelSizeMm * PROFILE_BINNING * solution.scale) / optics.cameraFocalMm;
  const angle = (solution.flip ? -1 : 1)
    * Math.atan((position - (solution.count - 1) / 2) * pitch);
  return terms.offsetA + terms.sinTermA * Math.cos(angle) + terms.cosTermA * Math.sin(angle);
}

// ---------------------------------------------------------------------------
// Profile preparation
// ---------------------------------------------------------------------------

function buildProfileLevel(depth, factor) {
  const count = Math.floor(depth.length / factor);
  const values = new Float32Array(count);
  const positions = new Float64Array(count);
  let sum = 0;
  let sumSquares = 0;
  for (let j = 0; j < count; j += 1) {
    let total = 0;
    for (let k = 0; k < factor; k += 1) {
      total += depth[j * factor + k];
    }
    const value = total / factor;
    values[j] = value;
    positions[j] = j * factor + (factor - 1) / 2;
    sum += value;
    sumSquares += value * value;
  }
  return { values, positions, sum, sumSquares };
}

/**
 * Turn a `profile` payload into what the solver works on.
 *
 * @param {Array<number|string>} rawProfile one value per frame row, 0..4095
 * @param previous the prepared profile that came just before, if any : two
 *   profiles a moment apart differ by their noise and little else, which
 *   measures it far better than anything a single profile can offer
 * @returns {{usable:boolean, reason:?string, count:number, depth:Float32Array,
 *   noise:number, levels:Object}} `reason` is 'short', 'dark', 'saturated' or
 *   'flat' when the profile cannot be solved
 */
export function prepareProfile(rawProfile, previous = null) {
  const count = rawProfile ? rawProfile.length : 0;
  if (count < MIN_PROFILE_SAMPLES) {
    return { usable: false, reason: 'short', count };
  }

  const values = new Float32Array(count);
  let total = 0;
  let saturated = 0;
  for (let i = 0; i < count; i += 1) {
    const value = Number(rawProfile[i]) || 0;
    values[i] = value;
    total += value;
    if (value >= SATURATION_ADU) {
      saturated += 1;
    }
  }
  if (total / count < MIN_LEVEL_ADU) {
    return { usable: false, reason: 'dark', count };
  }
  if (saturated / count > MAX_SATURATED_SHARE) {
    return { usable: false, reason: 'saturated', count };
  }

  // The envelope is taken on a lightly smoothed copy so that a noise spike
  // does not lift it, but the depths keep the full resolution.
  const window = Math.round(ENVELOPE_WINDOW_A / NOMINAL_SAMPLE_A);
  const depth = depthBelowEnvelope(values, boxcar(values, 3), window);

  // Noise, estimated two ways, each of which can only err on the high side.
  // From the second difference, on the grounds that a line is smooth at the
  // scale of one sample and noise is not : fine in the red, but in the blue the
  // lines are so crowded that they leak into it. And against the previous
  // profile, where the lines cancel out and leave twice the noise variance :
  // exact, unless the grating moved in between. The smaller of the two is the
  // one that was not fooled. The median keeps outliers out of both, and the
  // last factor turns it into the standard deviation of one sample.
  const paired = !!previous && previous.usable && previous.count === count;
  const curvature = new Float32Array(count - 2);
  const change = new Float32Array(paired ? count - 2 : 0);
  let depthSum = 0;
  let depthSquares = 0;
  for (let i = 0; i < count; i += 1) {
    depthSum += depth[i];
    depthSquares += depth[i] * depth[i];
    if (i > 0 && i < count - 1) {
      curvature[i - 1] = Math.abs(depth[i] - 0.5 * (depth[i - 1] + depth[i + 1]));
      if (paired) {
        change[i - 1] = Math.abs(depth[i] - previous.depth[i]);
      }
    }
  }
  let noise = (median(curvature) * 1.4826) / Math.sqrt(1.5);
  if (paired) {
    noise = Math.min(noise, (median(change) * 1.4826) / Math.sqrt(2));
  }
  const spread = Math.sqrt(Math.max(0, depthSquares / count - (depthSum / count) ** 2));
  if (spread < MIN_DEPTH_SPREAD) {
    return { usable: false, reason: 'flat', count };
  }

  return {
    usable: true,
    reason: null,
    count,
    depth,
    noise,
    levels: {
      [COARSE_FACTOR]: buildProfileLevel(depth, COARSE_FACTOR),
      [MID_FACTOR]: buildProfileLevel(depth, MID_FACTOR),
      [FINE_FACTOR]: buildProfileLevel(depth, FINE_FACTOR),
    },
  };
}

// ---------------------------------------------------------------------------
// Correlation
// ---------------------------------------------------------------------------

// Pearson correlation between one level of the profile and the atlas read at
// the wavelengths the model gives for `centreA`. -1 when the window would hang
// over either end of the atlas.
function correlationAt(profile, atlas, angles, centreA, optics) {
  const { offsetA, sinTermA, cosTermA } = gratingTerms(centreA, optics);
  const { cos, sin } = angles;
  const observed = profile.values;
  const reference = atlas.values;
  const count = observed.length;
  const last = count - 1;

  const first = offsetA + sinTermA * cos[0] + cosTermA * sin[0];
  const final = offsetA + sinTermA * cos[last] + cosTermA * sin[last];
  if (Math.min(first, final) < atlas.startA || Math.max(first, final) > atlas.endA) {
    return -1;
  }

  const startA = atlas.startA;
  const perA = 1 / atlas.stepA;
  let sum = 0;
  let sumSquares = 0;
  let cross = 0;
  for (let j = 0; j < count; j += 1) {
    const wavelength = offsetA + sinTermA * cos[j] + cosTermA * sin[j];
    const value = reference[((wavelength - startA) * perA + 0.5) | 0];
    sum += value;
    sumSquares += value * value;
    cross += value * observed[j];
  }
  const variance = (count * sumSquares - sum * sum) * (count * profile.sumSquares - profile.sum * profile.sum);
  return variance > 0 ? (count * cross - sum * profile.sum) / Math.sqrt(variance) : -1;
}

// Exhaustive search of a small box around a seed, at one level
function refine(prepared, factor, seed, centreReachA, centreStepA, scaleReach, scaleStep, optics) {
  const profile = prepared.levels[factor];
  const atlas = getAtlas()[factor];
  let best = { ...seed, correlation: -1 };
  const scaleSteps = Math.round(scaleReach / scaleStep);
  const centreSteps = Math.round(centreReachA / centreStepA);
  for (let s = -scaleSteps; s <= scaleSteps; s += 1) {
    const scale = seed.scale + s * scaleStep;
    const angles = sampleAngles(profile.positions, prepared.count, scale, seed.flip, optics);
    for (let c = -centreSteps; c <= centreSteps; c += 1) {
      const centreA = seed.centreA + c * centreStepA;
      const correlation = correlationAt(profile, atlas, angles, centreA, optics);
      if (correlation > best.correlation) {
        best = { centreA, scale, flip: seed.flip, correlation };
      }
    }
  }
  return best;
}

function describe(prepared, match, runnerUp, optics) {
  const solution = {
    centreA: match.centreA,
    scale: match.scale,
    flip: match.flip,
    count: prepared.count,
    correlation: match.correlation,
    runnerUp,
  };
  const first = wavelengthAt(solution, 0, optics);
  const last = wavelengthAt(solution, prepared.count - 1, optics);
  solution.startA = Math.min(first, last);
  solution.endA = Math.max(first, last);
  solution.dispersionA = (solution.endA - solution.startA) / (prepared.count - 1);
  return solution;
}

/**
 * Blind search, cut into slices so it never holds the JS thread for long.
 *
 * Call `step()` until it returns something : null means "not done yet, call me
 * again", and the final answer is either a solution or `{ok:false}`.
 *
 * @param calibration optional `{flip, scale}` remembered from an earlier
 *   success : the search then only scans the wavelength. A wrong calibration
 *   just fails, so the caller falls back to a full search.
 */
export function createSolver(prepared, { calibration = null, optics = SUNSCAN_OPTICS } = {}) {
  const combos = [];
  if (calibration && Number.isFinite(calibration.scale)) {
    combos.push({ flip: !!calibration.flip, scale: calibration.scale });
  } else {
    [false, true].forEach((flip) => {
      BLIND_SCALES.forEach((scale) => combos.push({ flip, scale }));
    });
  }

  let stage = 'atlas';
  let comboIndex = 0;
  let candidate = 0;
  let angles = null;
  let scores = null;
  let peaks = [];
  let seeds = [];
  let seedIndex = 0;
  let result = null;

  let coarse = null;
  let centres = 0;
  let firstCentreA = 0;

  function collectPeaks(combo) {
    for (let k = 1; k < centres - 1; k += 1) {
      const score = scores[k];
      if (score > 0 && score >= scores[k - 1] && score > scores[k + 1]) {
        peaks.push({
          centreA: firstCentreA + k * coarse.stepA,
          scale: combo.scale,
          flip: combo.flip,
          correlation: score,
        });
      }
    }
  }

  function pickSeeds() {
    peaks.sort((a, b) => b.correlation - a.correlation);
    const kept = [];
    for (let i = 0; i < peaks.length && kept.length < MAX_SEEDS; i += 1) {
      const peak = peaks[i];
      const duplicate = kept.some((other) => other.flip === peak.flip
        && Math.abs(other.centreA - peak.centreA) < PEAK_SEPARATION_A);
      if (!duplicate) {
        kept.push(peak);
      }
    }
    return kept;
  }

  function conclude() {
    seeds.sort((a, b) => b.correlation - a.correlation);
    const best = seeds[0];
    if (!best) {
      return { ok: false, correlation: 0, runnerUp: 0 };
    }
    let runnerUp = 0;
    for (let i = 1; i < seeds.length; i += 1) {
      const other = seeds[i];
      const elsewhere = other.flip !== best.flip
        || Math.abs(other.centreA - best.centreA) >= RIVAL_SEPARATION_A;
      if (elsewhere && other.correlation > runnerUp) {
        runnerUp = other.correlation;
      }
    }
    const solution = describe(prepared, best, runnerUp, optics);
    solution.ok = best.correlation >= MIN_CORRELATION
      && best.correlation - runnerUp >= MIN_MARGIN;
    return solution;
  }

  function step(budgetMs = 12) {
    const deadline = Date.now() + budgetMs;

    if (stage === 'atlas') {
      coarse = getAtlas()[COARSE_FACTOR];
      // Half a window of margin at each end, generously : correlationAt turns
      // down whatever still overhangs.
      const marginA = prepared.count * NOMINAL_SAMPLE_A * 0.4;
      firstCentreA = coarse.startA + marginA;
      centres = Math.floor((coarse.endA - marginA - firstCentreA) / coarse.stepA);
      stage = 'coarse';
      return null;
    }

    if (stage === 'coarse') {
      const profile = prepared.levels[COARSE_FACTOR];
      while (comboIndex < combos.length) {
        const combo = combos[comboIndex];
        if (!angles) {
          angles = sampleAngles(profile.positions, prepared.count, combo.scale, combo.flip, optics);
          scores = new Float32Array(centres);
          candidate = 0;
        }
        while (candidate < centres) {
          const until = Math.min(centres, candidate + 32);
          for (; candidate < until; candidate += 1) {
            scores[candidate] = correlationAt(
              profile, coarse, angles, firstCentreA + candidate * coarse.stepA, optics,
            );
          }
          if (Date.now() >= deadline) {
            return null;
          }
        }
        collectPeaks(combo);
        angles = null;
        comboIndex += 1;
      }
      seeds = pickSeeds();
      peaks = [];
      stage = 'refine';
      return null;
    }

    if (stage === 'refine') {
      while (seedIndex < seeds.length) {
        const mid = refine(prepared, MID_FACTOR, seeds[seedIndex], 0.7, 0.1, 0.015, 0.003, optics);
        seeds[seedIndex] = refine(prepared, FINE_FACTOR, mid, 0.1, 0.02, 0.003, 0.001, optics);
        seedIndex += 1;
        if (Date.now() >= deadline) {
          return null;
        }
      }
      result = conclude();
      stage = 'done';
    }

    return result;
  }

  return {
    step,
    /** 0..1, for a progress indicator */
    progress() {
      if (stage === 'done') return 1;
      if (stage === 'refine') return 0.8 + (0.2 * seedIndex) / Math.max(1, seeds.length);
      if (stage === 'coarse') {
        return (0.8 * (comboIndex + candidate / Math.max(1, centres))) / combos.length;
      }
      return 0;
    },
  };
}

/** Run a solver to the end in one go. For tests and scripts, not for the UI. */
export function solve(prepared, options) {
  const solver = createSolver(prepared, options);
  let result = solver.step(1000);
  while (!result) {
    result = solver.step(1000);
  }
  return result;
}

/**
 * Follow a spectrum that was already located : look only around the previous
 * position, which costs a hundredth of a blind search. Returns `{ok:false}`
 * when the spectrum is no longer there, typically because the grating was
 * turned by more than a few angstroms between two profiles.
 */
export function track(prepared, previous, optics = SUNSCAN_OPTICS) {
  if (!prepared.usable || prepared.count !== previous.count) {
    return { ok: false };
  }
  const mid = refine(prepared, MID_FACTOR, previous, TRACK_RANGE_A, 0.1, 0, 0.001, optics);
  const fine = refine(prepared, FINE_FACTOR, mid, 0.1, 0.02, 0.002, 0.001, optics);
  const solution = describe(prepared, fine, 0, optics);
  solution.ok = fine.correlation >= MIN_TRACK_CORRELATION;
  return solution;
}

// ---------------------------------------------------------------------------
// Naming the lines
// ---------------------------------------------------------------------------

// Index of the first catalogue line at or above a wavelength
function lowerBound(wavelengths, target) {
  let low = 0;
  let high = wavelengths.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (wavelengths[middle] < target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

// Dips of a depth profile that stand out from their surroundings by more than
// the noise could explain, with a sub-sample centre.
function findDips(depth, reach, minDepth, minProminence) {
  const dips = [];
  for (let i = reach; i < depth.length - reach; i += 1) {
    const value = depth[i];
    if (value < minDepth || value < depth[i - 1] || value <= depth[i + 1]) {
      continue;
    }
    let lowLeft = value;
    let lowRight = value;
    for (let k = 1; k <= reach; k += 1) {
      lowLeft = Math.min(lowLeft, depth[i - k]);
      lowRight = Math.min(lowRight, depth[i + k]);
    }
    if (value - Math.max(lowLeft, lowRight) < minProminence) {
      continue;
    }
    // Parabola through the three samples around the dip
    const curvature = depth[i - 1] - 2 * value + depth[i + 1];
    const shift = curvature !== 0 ? (0.5 * (depth[i - 1] - depth[i + 1])) / curvature : 0;
    dips.push({ position: i + (Math.abs(shift) <= 1 ? shift : 0), depth: value });
  }
  return dips;
}

/**
 * Find the dips of the profile and name the ones the catalogue knows.
 *
 * Works from what is seen towards the catalogue, not the other way round : a
 * line is only ever labelled where the profile actually shows a dip, so a
 * catalogue line drowned in noise, or a telluric line absent on a dry day, is
 * left out instead of being pinned on nothing.
 *
 * When several catalogue lines fall inside one dip the strongest names it :
 * at this resolution a blend looks like its main contributor.
 *
 * Two passes, because the lines come in two sizes. Nearly all of them are as
 * narrow as the instrument allows and show up sample to sample. The cores of
 * Ca II H and K or H alpha are an angstrom wide and flat : sample to sample
 * they are just noise on a plateau, so they are looked for again on a smoothed
 * copy, with a longer reach.
 *
 * @returns {Array<{position:number, wavelengthA:number, label:string,
 *   telluric:boolean, widthMa:number, depth:number}>} sorted by position
 */
export function identifyLines(prepared, solution, optics = SUNSCAN_OPTICS) {
  if (!prepared.usable || !solution) {
    return [];
  }
  const { depth, noise } = prepared;
  const catalogue = getCatalogue();
  const byLine = new Map();

  const passes = [
    { depth, reach: PROMINENCE_REACH, noise, toleranceA: MATCH_TOLERANCE_A },
    {
      depth: boxcar(depth, BROAD_SMOOTHING),
      reach: BROAD_REACH,
      noise: noise / Math.sqrt(BROAD_SMOOTHING),
      toleranceA: BROAD_TOLERANCE_A,
    },
  ];

  passes.forEach((pass, passIndex) => {
    const dips = findDips(
      pass.depth,
      pass.reach,
      MIN_LINE_DEPTH + 3 * pass.noise,
      MIN_LINE_PROMINENCE + 3 * pass.noise,
    );
    dips.forEach((dip) => {
      const seenA = wavelengthAt(solution, dip.position, optics);
      let chosen = -1;
      const from = lowerBound(catalogue.wavelengthA, seenA - pass.toleranceA);
      for (let k = from; k < catalogue.count && catalogue.wavelengthA[k] <= seenA + pass.toleranceA; k += 1) {
        if (chosen < 0 || catalogue.widthMa[k] > catalogue.widthMa[chosen]) {
          chosen = k;
        }
      }
      if (chosen < 0) {
        return;
      }
      // One label per catalogue line. The sharp pass has the better position,
      // so the broad one only adds what it alone has seen.
      const known = byLine.get(chosen);
      if (known && (passIndex > 0 || known.depth >= dip.depth)) {
        return;
      }
      const [label, telluric] = SPECIES[catalogue.species[chosen]];
      byLine.set(chosen, {
        position: dip.position,
        wavelengthA: catalogue.wavelengthA[chosen],
        label,
        telluric,
        widthMa: catalogue.widthMa[chosen],
        depth: dip.depth,
      });
    });
  });

  return Array.from(byLine.values()).sort((a, b) => a.position - b.position);
}

/**
 * Pick the lines worth printing when there is not room for all of them : the
 * deepest first, each one keeping `minGap` samples clear on both sides.
 * `isKey` marks lines that go before all the others whatever their depth.
 *
 * @returns the chosen features, sorted by position
 */
export function selectLabels(features, { minGap = 40, maxCount = 14, isKey = null } = {}) {
  const rank = (feature) => (isKey && isKey(feature) ? 1 : 0);
  const byDepth = features.slice().sort((a, b) => (rank(b) - rank(a)) || (b.depth - a.depth));
  const chosen = [];
  for (let i = 0; i < byDepth.length && chosen.length < maxCount; i += 1) {
    const feature = byDepth[i];
    if (chosen.every((other) => Math.abs(other.position - feature.position) >= minGap)) {
      chosen.push(feature);
    }
  }
  return chosen.sort((a, b) => a.position - b.position);
}
