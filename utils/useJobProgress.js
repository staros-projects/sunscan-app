import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import AppContext from '../components/AppContext';
import JobProgressModal from '../components/JobProgressModal';
import WebSocketContext from './WSContext';

// Progress of a stacking or an animation, as published by the backend on
// job_progress_<job_id>:
//
//   job_progress_<id>;#;<status>;#;<percent>;#;<step>;#;<error>;#;<detail>;#;<kind>;#;<current>;#;<total>;#;<path>
//
// Unlike a scan, a job has no name before it is done, so the app picks the id
// and sends it along with the request. It is new on every run: no stale state
// can sit on its channel, and subscribing before the POST is safe.
//
// The POST is synchronous, so the end arrives twice, on the channel and as the
// HTTP response, in any order: the first one wins. The backend also replays the
// last state on every websocket (re)connection, so a terminal state may be seen
// twice as well.
//
// A backend that predates job_id ignores it: no message ever comes, `percent`
// stays null, and the HTTP response alone ends the job.

const STORAGE_KEY = 'sunscan:runningJob';

const ROUTES = {
  stack: '/sunscan/process/stack/',
  animation: '/sunscan/process/animate/',
};

// 1 to 64 characters among A-Z a-z 0-9 _ -
const newJobId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

const toInt = (value) => {
  const n = parseInt(value, 10);
  return isNaN(n) ? 0 : n;
};

/**
 * Runs one stacking or animation at a time and follows it.
 *
 * `job` is null when idle, otherwise
 * { id, kind, status: 'processing' | 'failed', percent, step, current, total,
 *   count, startedAt, error }. A completed job goes straight back to null and
 * calls onCompleted.
 *
 * The running job id is kept in AsyncStorage: the stacking goes on on the box
 * if the app is closed, and its state is fetched again on the next launch.
 *
 * @param {object} options
 * @param {function} options.onCompleted (kind, path, { resumed }) once per job;
 *        path is null with a backend that predates job_id
 */
function useJobProgress({ onCompleted } = {}) {
  const myContext = useContext(AppContext);
  const [subscribe, unsubscribe] = useContext(WebSocketContext);
  const [job, setJob] = useState(null);

  const handlers = useRef({});
  handlers.current = { onCompleted };

  // The job being followed: { id, kind, channel, callback, finished }
  const active = useRef(null);

  const finish = useCallback((id, status, path, error, resumed = false) => {
    const current = active.current;
    if (!current || current.id !== id || current.finished) {
      return;
    }
    current.finished = true;
    unsubscribe(current.channel, current.callback);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    if (status === 'completed') {
      active.current = null;
      setJob(null);
      handlers.current.onCompleted?.(current.kind, path || null, { resumed });
    } else {
      setJob((prev) => prev && { ...prev, status: 'failed', error: error || '' });
    }
  }, [unsubscribe]);

  const listen = useCallback((id, kind) => {
    const channel = 'job_progress_' + id;
    const callback = (message) => {
      const [, status, rawPercent, step, error, detail, , current, total, path] = message;
      if (status === 'processing') {
        // A terminal state already handled wins over a replayed one
        if (active.current?.id !== id || active.current.finished) {
          return;
        }
        const percent = parseInt(rawPercent, 10);
        setJob((prev) => prev && {
          ...prev,
          percent: isNaN(percent) ? prev.percent : Math.max(prev.percent ?? 0, percent),
          step: step || prev.step,
          current: toInt(current),
          total: toInt(total) || prev.total,
        });
        return;
      }
      if (status === 'failed') {
        console.warn('job failed', kind, error, detail);
      }
      if (status === 'completed' || status === 'failed') {
        finish(id, status, path, error);
      }
    };
    active.current = { id, kind, channel, callback, finished: false };
    subscribe(channel, callback);
  }, [subscribe, finish]);

  /**
   * Launches a job. `body` is the POST payload minus job_id, `count` the number
   * of selected items, shown until the backend reports its own total.
   * Returns false when a job is already running.
   */
  const start = useCallback(async (kind, body, count) => {
    if (active.current && !active.current.finished) {
      return false;
    }
    const id = newJobId();
    const startedAt = Date.now();
    setJob({ id, kind, status: 'processing', percent: null, step: 'starting', current: 0, total: count, count, startedAt, error: null });
    // 1. subscribe before the POST: its response only comes at the end
    listen(id, kind);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ id, kind, count, startedAt })).catch(() => {});

    // 2. launch
    try {
      const response = await fetch('http://' + myContext.apiURL + ROUTES[kind], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, job_id: id }),
      });
      let json;
      try {
        json = await response.json();
      } catch (e) {
        // An older backend answers a crash with plain text
        json = undefined;
      }
      if (json && (json.status === 'completed' || json.status === 'failed')) {
        finish(id, json.status, json.path, json.error);
      } else if (response.ok) {
        // Older backend: null for a stack, {message, gifs} for an animation
        finish(id, 'completed', null);
      } else {
        console.warn('job request failed', kind, response.status, json);
        finish(id, 'failed', null, '');
      }
    } catch (error) {
      console.error('job request failed:', kind, error);
      finish(id, 'failed', null, 'request_failed');
    }
    return true;
  }, [myContext.apiURL, listen, finish]);

  /** Closes a failed job. */
  const dismiss = useCallback(() => {
    if (active.current && !active.current.finished) {
      return;
    }
    active.current = null;
    setJob(null);
  }, []);

  // A job left running when the app was closed: ask the box where it got to.
  // Retried on every (re)connection until the box has answered.
  useEffect(() => {
    if (!myContext.apiURL || !myContext.sunscanIsConnected) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw || cancelled || active.current) {
          return;
        }
        const saved = JSON.parse(raw);
        const response = await fetch(`http://${myContext.apiURL}/sunscan/process/job/${saved.id}`);
        const json = await response.json();
        if (cancelled || active.current) {
          return;
        }
        if (json?.status === 'processing' || json?.status === 'completed' || json?.status === 'failed') {
          setJob({
            id: saved.id,
            kind: saved.kind,
            status: 'processing',
            percent: toInt(json.percent),
            step: json.step || null,
            current: toInt(json.current),
            total: toInt(json.total) || saved.count,
            count: saved.count,
            startedAt: saved.startedAt,
            error: null,
          });
          listen(saved.id, saved.kind);
          if (json.status !== 'processing') {
            finish(saved.id, json.status, json.path, json.error, true);
          }
        } else {
          // 'unknown' (forgotten after 30 min, or the box restarted), or a
          // backend without this route: nothing left to follow.
          AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
        }
      } catch (error) {
        // Box not reachable yet: kept for the next connection
      }
    })();
    return () => { cancelled = true; };
  }, [myContext.apiURL, myContext.sunscanIsConnected, listen, finish]);

  // Leaving stops the listening only: the stored id brings the job back.
  useEffect(() => () => {
    const current = active.current;
    if (current && !current.finished) {
      current.finished = true;
      unsubscribe(current.channel, current.callback);
    }
    active.current = null;
  }, [unsubscribe]);

  return {
    job,
    isRunning: job?.status === 'processing',
    start,
    dismiss,
  };
}

const JobContext = createContext(null);

/**
 * Holds the running job for the whole app, and draws its pop-in.
 *
 * Above the navigator rather than in the gallery: the tab navigator keeps every
 * screen mounted and hides the inactive ones with display: none, and a Modal
 * opened from a hidden screen -- a job resumed on launch while another tab is
 * shown -- is presented invisible, and swallows every touch of the app.
 *
 * `completed` is the last job that ended well, { kind, path, resumed, at }, for
 * the gallery to refresh itself.
 */
export function JobProgressProvider({ children }) {
  const [completed, setCompleted] = useState(null);
  const onCompleted = useCallback((kind, path, { resumed }) => {
    setCompleted({ kind, path, resumed, at: Date.now() });
  }, []);
  const { job, isRunning, start, dismiss } = useJobProgress({ onCompleted });

  const value = React.useMemo(() => ({ job, isRunning, start, completed }), [job, isRunning, start, completed]);

  return (
    <JobContext.Provider value={value}>
      {children}
      <JobProgressModal job={job} onClose={dismiss} />
    </JobContext.Provider>
  );
}

/** { job, isRunning, start(kind, body, count), completed }, see JobProgressProvider. */
export default function useJobs() {
  return useContext(JobContext);
}
