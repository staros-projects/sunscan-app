import md5 from 'md5';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import AppContext from '../components/AppContext';
import WebSocketContext from './WSContext';

// Progress of a scan processing, as published by the backend on
// scan_progress_<md5(scan.ser)>:
//
//   scan_progress_<key>;#;<status>;#;<percent>;#;<step>;#;<error>;#;<detail>
//
// The backend only ever publishes the *latest* state, a few times per second,
// so percentages get skipped — that is expected, and it also means a listener
// that merely subscribes learns within a fraction of a second that a scan is
// already being processed. Every connected client receives the messages, and
// the current state of every tracked scan is replayed on each (re)connection,
// so a screen coming back from the background resynchronises on its own. The
// price is that the same terminal state can arrive twice: everything below is
// written to be idempotent.
//
// The old scan_process_<key> channel, which only carried the terminal state, is
// kept as a fallback for a backend that predates scan_progress_<key>.

// Neither list is exhaustive — the backend may add steps and errors without the
// app being updated, hence the generic labels.
const STEP_LABELS = {
  starting: 'processStepStarting',
  reading_scan: 'processStepReadingScan',
  building_disk: 'processStepBuildingDisk',
  correcting_geometry: 'processStepCorrectingGeometry',
  image_surface: 'processStepImageSurface',
  image_continuum: 'processStepImageContinuum',
  image_prominences: 'processStepImageProminences',
  image_doppler: 'processStepImageDoppler',
  image_helium: 'processStepImageHelium',
  done: 'processStepDone',
};

const ERROR_LABELS = {
  file_not_found: 'processErrorFileNotFound',
  reconstruction_failed: 'processErrorReconstructionFailed',
  image_generation_failed: 'processErrorImageGenerationFailed',
};

export const stepTranslationKey = (step) =>
  'common:' + (STEP_LABELS[step] || 'processStepGeneric');

export const errorTranslationKey = (error) =>
  'common:' + (ERROR_LABELS[error] || 'processErrorGeneric');

/**
 * Follows the processing of one scan, and starts it on demand.
 *
 * The hook subscribes as soon as it is mounted, without waiting for the user to
 * press play: that is how a card picks up a run started from another screen, or
 * one still going after the app spent a while in the background.
 *
 * @param {object} scan          the scan, only `ser` and `status` are read
 * @param {object} options
 * @param {function} options.onCompleted called once when the run succeeds
 * @param {function} options.onFailed    called once with the error key when it fails
 */
export default function useScanProcess(scan, { onCompleted, onFailed } = {}) {
  const myContext = useContext(AppContext);
  const [subscribe, unsubscribe] = useContext(WebSocketContext);

  const ser = scan?.ser;
  const key = useMemo(() => (ser ? md5(ser) : null), [ser]);

  const [isStarted, setIsStarted] = useState(false);
  // null while unknown: an older backend reports no progress at all, and the UI
  // has to be able to tell "0 %" from "no idea".
  const [percent, setPercent] = useState(null);
  const [step, setStep] = useState(null);
  const [errorKey, setErrorKey] = useState(null);
  const [scanStatus, setScanStatus] = useState(scan?.status);

  // Kept in a ref so the websocket callbacks never need to be rebuilt when the
  // caller re-renders with new closures.
  const handlers = useRef({});
  handlers.current = { onCompleted, onFailed };

  // Set as soon as the new protocol shows up, so the legacy channel can be
  // ignored: it carries no error key, and would otherwise win the race and
  // leave the user with a generic message.
  const usesProgressChannel = useRef(false);
  // Guards against the terminal state being delivered twice.
  const terminalSeen = useRef(false);
  // A finished run detaches itself, so starting a second one has to attach again.
  const attachRef = useRef(() => {});
  const detachRef = useRef(() => {});

  useEffect(() => {
    if (!key) {
      return undefined;
    }

    terminalSeen.current = false;

    const progressChannel = 'scan_progress_' + key;
    const legacyChannel = 'scan_process_' + key;

    const finish = (status, error) => {
      if (terminalSeen.current) {
        return;
      }
      terminalSeen.current = true;
      unsubscribe(progressChannel, onProgress);
      unsubscribe(legacyChannel, onLegacy);
      setIsStarted(false);
      setScanStatus(status);
      if (status === 'completed') {
        setPercent(100);
        setStep('done');
        setErrorKey(null);
        handlers.current.onCompleted?.();
      } else {
        setErrorKey(error || '');
        handlers.current.onFailed?.(error || '');
      }
    };

    const onProgress = (message) => {
      const [, status, rawPercent, currentStep, error, detail] = message;
      usesProgressChannel.current = true;

      if (status === 'processing') {
        // A terminal state already handled wins: the backend replays state for
        // half an hour, and a stale 'processing' must not revive a finished run.
        if (terminalSeen.current) {
          return;
        }
        const value = parseInt(rawPercent, 10);
        if (!isNaN(value)) {
          setPercent(value);
        }
        setStep(currentStep || null);
        setErrorKey(null);
        setIsStarted(true);
        return;
      }

      if (status === 'failed') {
        console.warn('scan processing failed', currentStep, error, detail);
        finish('failed', error);
      } else if (status === 'completed') {
        finish('completed');
      }
    };

    const onLegacy = (message) => {
      if (usesProgressChannel.current) {
        return;
      }
      const status = message[1];
      if (status === 'completed' || status === 'failed') {
        finish(status);
      }
    };

    // Idempotent: the channels hold a set of callbacks, so attaching twice
    // registers the same two functions once.
    const attach = () => {
      subscribe(progressChannel, onProgress);
      subscribe(legacyChannel, onLegacy);
    };
    const detach = () => {
      unsubscribe(progressChannel, onProgress);
      unsubscribe(legacyChannel, onLegacy);
    };
    attachRef.current = attach;
    detachRef.current = detach;
    attach();

    return () => {
      attachRef.current = () => {};
      detachRef.current = () => {};
      detach();
    };
  }, [key, subscribe, unsubscribe]);

  /** Asks the backend for the last known state, for a run started before this screen was. */
  const refreshStatus = useCallback(async () => {
    if (!ser) {
      return;
    }
    try {
      const response = await fetch(`http://${myContext.apiURL}/sunscan/scan/process/status/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: ser }),
      });
      const json = await response.json();
      if (!json || json.status !== 'processing') {
        return;
      }
      usesProgressChannel.current = true;
      // A run is under way, whoever started it: listen again if an earlier one
      // had already detached us.
      terminalSeen.current = false;
      attachRef.current();
      const value = parseInt(json.percent, 10);
      setPercent(isNaN(value) ? 0 : value);
      setStep(json.step || null);
      setErrorKey(null);
      setIsStarted(true);
    } catch (error) {
      // An older backend has no such route, and there is nothing to recover:
      // the websocket remains the source of truth.
    }
  }, [ser, myContext.apiURL]);

  /**
   * Launches the processing. `body` is the POST payload minus `filename`, which
   * the hook fills in.
   */
  const startProcess = useCallback(async (body) => {
    if (!ser) {
      return;
    }
    terminalSeen.current = false;
    attachRef.current();
    setIsStarted(true);
    setPercent(0);
    setStep('starting');
    setErrorKey(null);

    const failLocally = (error) => {
      terminalSeen.current = true;
      detachRef.current();
      setIsStarted(false);
      setScanStatus('failed');
      setErrorKey(error);
      handlers.current.onFailed?.(error);
    };

    try {
      const response = await fetch(`http://${myContext.apiURL}/sunscan/scan/process/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: ser, ...body }),
      });
      // null with a backend that predates the progress channel
      const json = await response.json();
      if (json && json.key) {
        usesProgressChannel.current = true;
      }
      if (json && json.status === 'failed') {
        failLocally(json.error || '');
      }
    } catch (error) {
      console.error('Error during scan processing:', error);
      failLocally('request_failed');
    }
  }, [ser, myContext.apiURL]);

  return {
    isStarted,
    setIsStarted,
    percent,
    step,
    errorKey,
    scanStatus,
    setScanStatus,
    startProcess,
    refreshStatus,
  };
}
