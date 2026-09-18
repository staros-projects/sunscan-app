// Automatic exposure for the full frame colour preview.
//
// The Sun on the slit changes brightness with the haze, the height of the Sun
// and where the slit cuts the disk (the limb is darker than the centre). This
// keeps the brightest channel of the frame near TARGET_ADU by acting on the
// exposure time alone : the gain is left where the observer put it, since it is
// the one that sets the noise.
//
// It works off the Max ADU the backend streams with every frame (12 bit, per
// Bayer channel). The sensor is linear, so one reading tells by how much to
// change the exposure : the loop settles in a step or two, and only moves again
// when the light really changes.

import { useEffect, useRef } from 'react';

// Brightest channel aimed at, out of 4095 : bright enough for the faint end of
// the spectrum, with room above for a thinning cloud or a brighter part of the
// disk before anything clips.
export const TARGET_ADU = 3000;

// Readings within this band are left alone, so the exposure does not hunt
const LOW_ADU = 2400;
const HIGH_ADU = 3600;

// At or above this the frame clips : the reading only says "too much", not by
// how much, so the exposure is cut by a fixed share.
const SATURATED_ADU = 4000;
const SATURATED_RATIO = 0.4;

// Black level of the sensor, included in the Max ADU readings : only what is
// above it grows with the exposure.
const BLACK_ADU = 200;

// Under this, above the black level, only noise is read : the Sun is too faint
// to measure, or not there (cap on, Sun off the slit). The exposure is doubled
// until the Sun shows, but not past DARK_MAX_EXPOSURE_MS, so that a capped
// instrument does not end up on a two second exposure.
const DARK_SIGNAL_ADU = 150;
const DARK_MAX_EXPOSURE_MS = 160;

// Largest change in one step, either way
const MAX_STEP = 4;

// Exposure range, in ms, the range of the manual sliders taken end to end
export const MIN_EXPOSURE_MS = 0.1;
export const MAX_EXPOSURE_MS = 2000;

// Time for a new exposure to reach the frames the backend streams : the
// controls are applied between two frames, and the stream runs at 4 Hz.
const SETTLE_MS = 1500;

/**
 * @param exposureMs current exposure time
 * @param maxAdu brightest channel read on a frame taken at that exposure
 * @returns the exposure to switch to, or null to keep this one
 */
export function nextExposure(exposureMs, maxAdu) {
  if (!Number.isFinite(exposureMs) || !Number.isFinite(maxAdu)) {
    return null;
  }
  if (maxAdu >= LOW_ADU && maxAdu <= HIGH_ADU) {
    return null;
  }
  const signal = maxAdu - BLACK_ADU;
  let ratio;
  let ceiling = MAX_EXPOSURE_MS;
  if (maxAdu >= SATURATED_ADU) {
    ratio = SATURATED_RATIO;
  } else if (signal < DARK_SIGNAL_ADU) {
    ratio = 2;
    ceiling = Math.max(exposureMs, DARK_MAX_EXPOSURE_MS);
  } else {
    ratio = Math.min(MAX_STEP, Math.max(1 / MAX_STEP, (TARGET_ADU - BLACK_ADU) / signal));
  }
  const next = Math.min(ceiling, Math.max(MIN_EXPOSURE_MS, exposureMs * ratio));
  // Pinned at a bound : nothing left to change
  return Math.abs(next - exposureMs) < exposureMs * 0.02 ? null : next;
}

/**
 * Exposure mode of the manual slider whose range holds `exposureMs` :
 * 1 short (0.1 - 20 ms), 0 normal (20 - 160 ms), 2 long (200 ms and more).
 */
export function exposureModeFor(exposureMs) {
  if (exposureMs < 20) return 1;
  if (exposureMs <= 180) return 0;
  return 2;
}

/**
 * Drives the exposure while `enabled`. Hand it every new Max ADU reading.
 *
 * @param pixelStats {r, g, b} Max ADU of the last frame
 * @param channel 'r', 'g' or 'b' when the frame is made of that channel alone
 *   (mono from one Bayer layer), null to watch the brightest of the three
 *   (colour, or mono binned from all of them)
 * @param onChange called with the new exposure in ms
 */
export default function useAutoExposure({ enabled, exposureMs, pixelStats, channel = null, onChange }) {
  const lastChangeRef = useRef(0);
  const exposureRef = useRef(exposureMs);
  exposureRef.current = exposureMs;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Readings taken before auto mode was switched on are as good as any
  useEffect(() => {
    lastChangeRef.current = 0;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !pixelStats) return;
    const now = Date.now();
    // Long exposures take longer to show up in the stream
    const settle = SETTLE_MS + 2 * exposureRef.current;
    if (now - lastChangeRef.current < settle) return;

    const maxAdu = channel
      ? (pixelStats[channel] || 0)
      : Math.max(pixelStats.r || 0, pixelStats.g || 0, pixelStats.b || 0);
    const next = nextExposure(exposureRef.current, maxAdu);
    if (next == null) return;
    lastChangeRef.current = now;
    onChangeRef.current(next);
  }, [enabled, pixelStats, channel]);
}
