// Glue between the `profile` websocket channel, the spectrum solver and the
// overlay that prints the line names on the live frame.
//
// Unlike useScanAssistant this hook subscribes on its own : nothing else reads
// the `profile` channel, and the backend only streams it once asked to, so
// there is no payload being split twice. It also owns that switch : the profile
// is turned on when the identification starts and off when it stops, which
// keeps the websocket as quiet as before for everyone not using it.

import { useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import AppContext from '../components/AppContext';
import WebSocketContext from './WSContext';
import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia';

import { createSolver, identifyLines, prepareProfile, track } from './SpectrumIdent';
import { LIMB_BAND_SHARE, leftLimbOf } from './SunLimb';

const CALIBRATION_STORAGE_KEY = 'SUNSCAN_APP::IDENT_CALIBRATION';

// Columns the backend averages into the profile. Enough to beat the noise down
// by four, few enough that the slant of the lines across them stays well under
// a sample.
const PROFILE_COLUMNS = 16;

// The backend pushes a profile about four times a second. Once is plenty for
// names that only change when somebody turns the grating.
const MEASURE_INTERVAL_MS = 1000;

// A blind search is a second or two of arithmetic : it runs in slices this
// long, handing the thread back in between so touches keep registering.
const SOLVER_SLICE_MS = 12;

// Tracked profiles that may fail in a row before the position is declared lost.
// One bad profile (a cloud, a hand on the instrument) is not worth a new search.
const MAX_TRACK_MISSES = 2;

// Pause after a search that found nothing, rather than searching flat out on a
// spectrum that is not going to become recognisable by itself
const RETRY_DELAY_MS = 3000;

// No profile for this long after asking means none is coming
const PROFILE_TIMEOUT_MS = 4000;

// Moves of the solar limb smaller than this, in frame columns, are left alone :
// the edge wobbles with the seeing and the labels would shiver along with it.
const EDGE_DEADBAND_COLUMNS = 6;

// Mono columns across the frame : the unit of the limb, in colour as in mono
const FRAME_COLUMNS = 2028;

// How often the limb is measured on the frame itself, when the backend does not
// send it along with the profile
const LIMB_INTERVAL_MS = 1000;

/**
 * Left limb of the Sun measured on a streamed frame (`data:image/jpg;base64,`),
 * in mono columns, or null. Only a band across the middle is read back.
 */
function measureLimb(frame) {
  const comma = typeof frame === 'string' ? frame.indexOf(',') : -1;
  if (comma < 0) return null;
  let data = null;
  let image = null;
  try {
    data = Skia.Data.fromBase64(frame.slice(comma + 1));
    image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) return null;
    const width = image.width();
    const rows = Math.max(1, Math.round(image.height() * LIMB_BAND_SHARE));
    const pixels = image.readPixels(0, Math.round((image.height() - rows) / 2), {
      width,
      height: rows,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Unpremul,
    });
    const share = leftLimbOf(pixels, width, rows);
    return share == null ? null : share * FRAME_COLUMNS;
  } catch (error) {
    return null;
  } finally {
    image?.dispose?.();
    data?.dispose?.();
  }
}

/**
 * @param enabled whether to identify at all
 * @param frame latest streamed frame, where the limb is measured when the
 *   backend does not send it
 * @param source what the frame is made of ('mono', 'color'). Switching it
 *   restarts the identification : the backend changes its capture path, which
 *   may drop the profile stream, and the noise of the new profiles has nothing
 *   to do with the old ones.
 * @returns {{status:string, solution:?Object, features:Array, sunLeft:?number}}
 *
 * sunLeft is the column of the left limb of the Sun in the frame, in mono
 * columns (0 to 2028), or null when there is no Sun to be seen. The backend may
 * send it with the profile ; otherwise it is measured on the frame.
 *
 * status is one of :
 *   'off'          not enabled
 *   'starting'     asked the backend for the profile, nothing received yet
 *   'unsupported'  the backend does not know the profile endpoint (old firmware)
 *   'silent'       no profile is coming : recording, old firmware in colour, or no answer
 *   'short' 'dark' 'saturated' 'flat'   the profile cannot be worked on
 *   'searching'    blind search in progress
 *   'locked'       `solution` and `features` are current
 *   'unknown'      searched, and the spectrum matches nothing
 */
export default function useLineIdent({ enabled = false, source = 'mono', frame = null } = {}) {
  const myContext = useContext(AppContext);
  const apiURL = myContext?.apiURL;
  const [subscribe, unsubscribe] = useContext(WebSocketContext);

  const [status, setStatus] = useState('off');
  const [solution, setSolution] = useState(null);
  const [features, setFeatures] = useState([]);
  const [sunLeft, setSunLeft] = useState(null);

  const calibrationRef = useRef(null);

  // Read by the limb timer : following the frame through the effect's
  // dependencies would restart the identification four times a second.
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(CALIBRATION_STORAGE_KEY)
      .then((stored) => {
        if (cancelled || stored == null) return;
        const value = JSON.parse(stored);
        if (value && Number.isFinite(value.scale)) {
          calibrationRef.current = { flip: !!value.flip, scale: value.scale };
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!enabled || !apiURL) {
      setStatus('off');
      setSolution(null);
      setFeatures([]);
      setSunLeft(null);
      return undefined;
    }

    let alive = true;
    let current = null;        // solution being tracked
    let previous = null;       // last usable prepared profile, for the noise
    let searching = false;
    let misses = 0;
    let lastMeasure = 0;
    let lastFailure = 0;
    let silenceTimer = null;
    let edge = null;           // last published left limb
    let limbFromBackend = false;
    let limbTimer = null;

    const publishEdge = (nextEdge) => {
      if (nextEdge == null || edge == null
        ? nextEdge !== edge
        : Math.abs(nextEdge - edge) > EDGE_DEADBAND_COLUMNS) {
        edge = nextEdge;
        setSunLeft(nextEdge);
      }
    };

    const setProfileStream = (on) => fetch('http://' + apiURL + '/camera/profile/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(on ? { enabled: true, columns: PROFILE_COLUMNS } : { enabled: false }),
    });

    const armSilenceTimer = () => {
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        if (!alive) return;
        current = null;
        setStatus((value) => (value === 'unsupported' ? value : 'silent'));
        setSolution(null);
        setFeatures([]);
      }, PROFILE_TIMEOUT_MS);
    };

    const publish = (prepared, found) => {
      current = found;
      misses = 0;
      setSolution(found);
      setFeatures(identifyLines(prepared, found));
      setStatus('locked');
    };

    const lose = (nextStatus) => {
      current = null;
      setSolution(null);
      setFeatures([]);
      setStatus(nextStatus);
    };

    // Runs a solver to its end, one slice per trip through the event loop
    const search = (prepared, calibration) => {
      searching = true;
      setStatus('searching');
      const solver = createSolver(prepared, { calibration });

      const advance = () => {
        if (!alive) return;
        const result = solver.step(SOLVER_SLICE_MS);
        if (!result) {
          setTimeout(advance, 0);
          return;
        }
        if (result.ok) {
          searching = false;
          calibrationRef.current = { flip: result.flip, scale: result.scale };
          AsyncStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(calibrationRef.current))
            .catch(() => {});
          publish(prepared, result);
        } else if (calibration) {
          // The remembered scale or direction no longer fits (another
          // instrument, a lens swapped) : search again with nothing assumed.
          search(prepared, null);
        } else {
          searching = false;
          lastFailure = Date.now();
          lose('unknown');
        }
      };
      advance();
    };

    const onProfile = (message) => {
      if (!alive || message.length < 4) return;
      armSilenceTimer();

      // Optional trailing field : where the left limb of the Sun is. Once the
      // backend sends it, the frame is no longer measured.
      if (message.length > 4) {
        limbFromBackend = true;
        const limb = Number(message[4]);
        publishEdge(Number.isFinite(limb) && limb >= 0 ? limb : null);
      }

      if (searching) return;

      const now = Date.now();
      if (now - lastMeasure < MEASURE_INTERVAL_MS) return;
      lastMeasure = now;

      const prepared = prepareProfile(message[3].split(','), previous);
      if (!prepared.usable) {
        previous = null;
        lose(prepared.reason);
        return;
      }
      previous = prepared;

      if (current) {
        const tracked = track(prepared, current);
        if (tracked.ok) {
          publish(prepared, tracked);
          return;
        }
        misses += 1;
        if (misses <= MAX_TRACK_MISSES) return;
        current = null;
      }

      if (now - lastFailure < RETRY_DELAY_MS) return;
      search(prepared, calibrationRef.current);
    };

    const measureFrame = () => {
      if (!alive || limbFromBackend) return;
      publishEdge(measureLimb(frameRef.current));
      limbTimer = setTimeout(measureFrame, LIMB_INTERVAL_MS);
    };

    setStatus('starting');
    subscribe('profile', onProfile);
    measureFrame();
    armSilenceTimer();
    setProfileStream(true)
      .then((response) => {
        if (alive && !response.ok) {
          setStatus('unsupported');
        }
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      alive = false;
      clearTimeout(silenceTimer);
      clearTimeout(limbTimer);
      unsubscribe('profile', onProfile);
      setProfileStream(false).catch(() => {});
    };
  }, [enabled, source, apiURL, subscribe, unsubscribe]);

  return { status, solution, features, sunLeft };
}
