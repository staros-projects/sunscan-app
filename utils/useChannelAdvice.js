// Which Bayer channel suits the stretch of spectrum on the slit, in cropped mode.
//
// A mono frame is built from the raw Bayer data, either from the four
// photosites of each cell summed together or from one colour alone. Far in the
// red (H alpha) the green and blue photosites see next to nothing : summing
// them in adds their noise and none of their signal, so the red channel alone
// makes the better scan. The same goes for the blue channel at the blue end
// (Ca II H and K, H gamma). In between, two colours at least answer and the sum
// of the four photosites is the one to use.
//
// Nothing has to be identified for that. How the light splits between the three
// colours tells where in the spectrum the grating points, and it is the very
// thing the choice depends on. It is read off the Max ADU the backend streams
// with every frame (12 bit, per Bayer channel) : they are measured on the raw
// frame, before the channel is picked, so they do not depend on the one in use,
// and the backend stops refreshing them while it records.

import { useEffect, useRef, useState } from 'react';

// Black level of the sensor, included in the Max ADU readings. The true pedestal
// of the IMX477 rather than the 200 the backend takes off on purpose : a ratio
// between a strong and a weak channel is only as good as the zero of the weak one.
const BLACK_ADU = 256;

// Under this, above the black level, the brightest channel is too faint for the
// ratios to mean anything : what the weak channels read is then mostly the
// tallest noise spike of the frame.
const MIN_SIGNAL_ADU = 600;

// At or above this a channel clips : its reading is a floor, not a measure
const SATURATED_ADU = 4000;

// How many times stronger than both others a colour has to be for its channel
// alone to be advised, and the lower bar it has to stay above once advised, so
// that a spectrum near the limit does not flip the advice back and forth.
// Taken from the response curves of the IMX477, to be refined on the
// instrument : red over green is about 8 at H alpha and 2 at Na D and He D3,
// blue over green about 8 at H gamma, above 3 at Ca II K and 1 at H beta.
const RED_ENTER = 4;
const RED_LEAVE = 3;
const BLUE_ENTER = 3;
const BLUE_LEAVE = 2.2;

// Same reading this many times in a row before it is believed. The Max ADU are
// maxima : one cosmic ray or one cloud edge is enough to bend a single reading.
const STEADY_READINGS = 3;

// Monobin mode of the backend for each advice. Green alone (2) is never advised.
export const ADVICE_MODE = { rgb: 0, red: 1, blue: 3 };
const GREEN_MODE = 2;

/**
 * @param stats Max ADU per channel, {r, g, b}, black level included
 * @param previous advice in force, which gets the benefit of the doubt
 * @returns 'red', 'rgb', 'blue', or null when the reading says nothing
 */
export function adviseChannel(stats, previous = null) {
  const r = stats.r - BLACK_ADU;
  const g = stats.g - BLACK_ADU;
  const b = stats.b - BLACK_ADU;
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    return null;
  }
  if (Math.max(r, g, b) < MIN_SIGNAL_ADU) {
    return null;
  }
  // A clipped channel reads low : a colour that passes the bar anyway only
  // passes it by more, so both tests below hold on a saturated frame.
  if (r >= (previous === 'red' ? RED_LEAVE : RED_ENTER) * Math.max(g, b, 1)) {
    return 'red';
  }
  if (b >= (previous === 'blue' ? BLUE_LEAVE : BLUE_ENTER) * Math.max(r, g, 1)) {
    return 'blue';
  }
  // Not so for the verdict left : the clipped colour may well lead by enough
  if (Math.max(stats.r, stats.g, stats.b) >= SATURATED_ADU) {
    return null;
  }
  return 'rgb';
}

/**
 * @param enabled whether to advise at all
 * @param pixelStats latest Max ADU, {r, g, b} : a new object on every reading
 * @param mode monobin mode in use (0 rgb, 1 red, 2 green, 3 blue)
 * @returns 'red', 'rgb' or 'blue' when another channel than the one in use
 *   would do better, null otherwise
 */
export default function useChannelAdvice({ enabled = false, pixelStats, mode }) {
  const [advice, setAdvice] = useState(null);
  const adviceRef = useRef(null);
  const pendingRef = useRef({ value: null, count: 0 });

  useEffect(() => {
    if (!enabled) {
      adviceRef.current = null;
      pendingRef.current = { value: null, count: 0 };
      setAdvice(null);
      return;
    }
    const reading = adviseChannel(pixelStats, adviceRef.current);
    // Nothing to conclude (Sun off the slit, clipped frame) or nothing new :
    // what was said stands, the grating has not moved for all that.
    if (reading == null || reading === adviceRef.current) {
      pendingRef.current = { value: null, count: 0 };
      return;
    }
    const pending = pendingRef.current;
    pending.count = pending.value === reading ? pending.count + 1 : 1;
    pending.value = reading;
    if (pending.count >= STEADY_READINGS) {
      adviceRef.current = reading;
      pendingRef.current = { value: null, count: 0 };
      setAdvice(reading);
    }
  }, [enabled, pixelStats]);

  if (advice == null || mode === ADVICE_MODE[advice]) {
    return null;
  }
  // Green alone is as good as the sum where green leads (Mg b) : not worth
  // arguing with an observer who picked it.
  if (advice === 'rgb' && mode === GREEN_MODE
    && pixelStats.g >= pixelStats.r && pixelStats.g >= pixelStats.b) {
    return null;
  }
  return advice;
}
