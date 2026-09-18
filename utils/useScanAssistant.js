// Glue between the ephemeris, the live intensity profile and the assistant UI.
//
// Deliberately fed rather than self-subscribing : ScanScreen already splits the
// `intensity` payload for the continuum graph, so handing the parsed profile
// over costs nothing, where a second subscriber would split the same 1000-value
// string twice per frame.

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import AppContext from '../components/AppContext';
import { acquirePosition } from './Position';
import {
  getDriftGeometry,
  getObservingWindow,
  simulatedDaytime,
} from './SolarGeometry';
import {
  analyzeProfile,
  createCalibration,
  createSignTracker,
  measureOffsetArcmin,
  refineCalibration,
  sensorEndArcmin,
  sensorTargetArcmin,
  TARGET_TOLERANCE_ARCMIN,
  updateSignTracker,
} from './ScanGeometry';

const SIGN_STORAGE_KEY = 'SUNSCAN_APP::ALONG_SLIT_SIGN';

// The backend pushes a profile about four times a second. Twice is plenty for a
// human aiming a tripod, and halves the work.
const MEASURE_INTERVAL_MS = 500;

// The ephemeris barely moves : recomputing it twice a minute is generous
const GEOMETRY_INTERVAL_MS = 30000;

// Smoothing of the displayed position, so the marker glides instead of jittering
const POSITION_SMOOTHING = 0.35;

// Offline mode refreshes its fake measurement at this rate
const SIMULATION_INTERVAL_MS = 500;

/**
 * @param enabled    computes the geometry
 * @param recording  true while a scan runs
 * @param locate     fetches the position itself when none is known yet. Kept
 *                   apart from `enabled` so a permission prompt only ever shows
 *                   when the panel is opened, never in the middle of a scan.
 */
export default function useScanAssistant({ enabled = true, recording = false, locate = false } = {}) {
  const myContext = useContext(AppContext);
  const coords = myContext?.locationData?.location?.coords;
  const latitude = coords?.latitude;
  const longitude = coords?.longitude;
  const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude);
  const demo = !!myContext?.demo;
  const setLocationData = myContext?.setLocationData;

  // 'searching' | 'denied' | 'unavailable', meaningless once hasLocation
  const [locationStatus, setLocationStatus] = useState('searching');
  const [locateAttempt, setLocateAttempt] = useState(0);

  // The position normally comes from the home screen. Going straight to the
  // scan screen, or a first launch, leaves none : ask for it here.
  useEffect(() => {
    if (!locate || hasLocation) return undefined;
    let cancelled = false;
    setLocationStatus('searching');
    acquirePosition().then((result) => {
      if (cancelled) return;
      if (result.status === 'ok') {
        // No geocode : the home screen fills it in when it has the network
        setLocationData?.({ location: result.location, geocode: null });
      } else {
        setLocationStatus(result.status);
      }
    });
    return () => { cancelled = true; };
  }, [locate, hasLocation, locateAttempt, setLocationData]);

  const retryLocation = useCallback(() => setLocateAttempt((n) => n + 1), []);

  const [alongSlitSign, setAlongSlitSign] = useState(1);
  const [signKnown, setSignKnown] = useState(false);
  const [measuredArcmin, setMeasuredArcmin] = useState(null);
  const [geometry, setGeometry] = useState(null);
  // True once the disk has been parked on the mark. Survives the disk leaving
  // the field, which is exactly what happens next : the observer swings the
  // instrument until the slit goes dark, and the panel has to keep saying "go"
  // rather than falling back to "centre the Sun".
  const [armed, setArmed] = useState(false);

  const calibrationRef = useRef(createCalibration());
  const signTrackerRef = useRef(createSignTracker());
  const lastMeasureRef = useRef(0);
  const smoothedRef = useRef(null);
  const geometryRef = useRef(null);
  const signManuallySetRef = useRef(false);
  // Mirrors alongSlitSign for the measurement path, which runs outside render
  const signRef = useRef(1);
  useEffect(() => { signRef.current = alongSlitSign; }, [alongSlitSign]);

  // A finished scan leaves the instrument pointing wherever the Sun drifted to :
  // the next one has to be aimed again from scratch.
  useEffect(() => {
    if (!recording) {
      setArmed(false);
    }
  }, [recording]);

  // Offline mode has no observing session : pick one plausible daytime instant
  // and stay on it, the same way the home screen sun graph does.
  const simulatedDate = useMemo(() => {
    if (!demo) return null;
    return simulatedDaytime(latitude, longitude);
  }, [demo, latitude, longitude]);

  // --- persisted sensor axis direction --------------------------------------

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(SIGN_STORAGE_KEY)
      .then((stored) => {
        if (cancelled || stored == null) return;
        const value = parseInt(stored, 10);
        if (value === 1 || value === -1) {
          setAlongSlitSign(value);
          setSignKnown(true);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const persistSign = useCallback((value) => {
    AsyncStorage.setItem(SIGN_STORAGE_KEY, `${value}`).catch(() => {});
  }, []);

  const flipSign = useCallback(() => {
    signManuallySetRef.current = true;
    setAlongSlitSign((previous) => {
      const next = -previous;
      persistSign(next);
      return next;
    });
    setSignKnown(true);
    signTrackerRef.current = createSignTracker();
  }, [persistSign]);

  // --- ephemeris ------------------------------------------------------------

  useEffect(() => {
    if (!enabled) return undefined;

    const compute = () => {
      const next = getDriftGeometry({
        latitude,
        longitude,
        date: simulatedDate ?? new Date(),
      });
      geometryRef.current = next;
      setGeometry(next);
    };

    compute();
    // A frozen simulated instant never needs refreshing
    if (simulatedDate) return undefined;
    const id = setInterval(compute, GEOMETRY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled, latitude, longitude, simulatedDate]);

  const observingWindow = useMemo(() => {
    if (!enabled || !Number.isFinite(latitude)) return null;
    return getObservingWindow({
      latitude,
      longitude,
      date: simulatedDate ?? new Date(),
      minQuality: 'good',
    });
    // Recomputed only when the day or the place changes, not on every tick
  }, [enabled, latitude, longitude, simulatedDate ? simulatedDate.toDateString() : new Date().toDateString()]);

  // --- live measurement -----------------------------------------------------

  /**
   * Feed one `intensity` payload. Safe to call at the full websocket rate :
   * it throttles itself.
   */
  const ingestProfile = useCallback((rawProfile) => {
    if (!enabled || demo) return;

    const now = Date.now();
    if (now - lastMeasureRef.current < MEASURE_INTERVAL_MS) return;
    lastMeasureRef.current = now;

    const current = geometryRef.current;
    if (!current) return;

    const analysis = analyzeProfile(rawProfile);
    calibrationRef.current = refineCalibration(calibrationRef.current, analysis, current.diameterArcmin);

    const offset = measureOffsetArcmin(analysis, calibrationRef.current, current.diameterArcmin);
    if (offset == null) {
      // No limb in view : keep whatever "armed" said, the disk has most likely
      // just been walked off the slit on purpose.
      smoothedRef.current = null;
      setMeasuredArcmin(null);
      return;
    }

    const target = sensorTargetArcmin(current, signRef.current);
    setArmed(Math.abs(target - offset) <= TARGET_TOLERANCE_ARCMIN);

    // While the disk is crossing the slit the profile is a chord, not the disk :
    // measuring it would be meaningless, so guidance freezes during the scan.
    if (!recording) {
      const tracker = updateSignTracker(
        signTrackerRef.current,
        offset,
        current.alongRateArcminPerS,
        now,
      );
      signTrackerRef.current = tracker;
      if (tracker.confident && !signManuallySetRef.current) {
        setAlongSlitSign((previous) => {
          if (previous === tracker.sign) return previous;
          persistSign(tracker.sign);
          return tracker.sign;
        });
        setSignKnown(true);
      }
    }

    smoothedRef.current = smoothedRef.current == null
      ? offset
      : smoothedRef.current + POSITION_SMOOTHING * (offset - smoothedRef.current);
    setMeasuredArcmin(smoothedRef.current);
  }, [enabled, demo, recording, persistSign]);

  // --- offline simulation ---------------------------------------------------

  useEffect(() => {
    if (!enabled || !demo || !geometry) return undefined;

    // Start somewhere plausible but off the mark, so the guidance has something
    // to ask for, then let it drift at the real rate the ephemeris gives.
    const start = geometry.marginArcmin * (Math.random() - 0.5);
    const startedAt = Date.now();
    const rate = geometry.alongRateArcminPerS * alongSlitSign;

    const id = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const value = start + rate * elapsed;
      // Wrap back into the field rather than sailing off the lane for ever
      const limit = geometry.fieldArcmin / 2;
      const wrapped = ((value + limit) % (2 * limit) + 2 * limit) % (2 * limit) - limit;
      setMeasuredArcmin(wrapped);
    }, SIMULATION_INTERVAL_MS);

    return () => clearInterval(id);
  }, [enabled, demo, geometry, alongSlitSign]);

  // --- derived --------------------------------------------------------------

  const targetArcmin = useMemo(
    () => sensorTargetArcmin(geometry, alongSlitSign),
    [geometry, alongSlitSign],
  );
  const endArcmin = useMemo(
    () => sensorEndArcmin(geometry, alongSlitSign),
    [geometry, alongSlitSign],
  );

  return {
    geometry,
    targetArcmin,
    endArcmin,
    measuredArcmin,
    armed,
    simulatedDate,
    signKnown,
    flipSign,
    ingestProfile,
    observingWindow,
    hasLocation,
    locationStatus,
    retryLocation,
  };
}
