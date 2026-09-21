import md5 from 'md5';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import AppContext from '../components/AppContext';
import WebSocketContext from './WSContext';
import { getNetworkStatus } from './SunscanNetwork';

// SpectroSolHub (https://spectrosolhub.com): the SUNSCAN itself uploads the
// JPEG images of a processed scan or of a stack, or the GIFs of an animation,
// the app only drives it. The backend trades
// the password for an API token at login and keeps nothing else, and it runs
// one upload at a time for the whole device.
//
// Every error comes back as {status: 'failed', error: <key>, detail: <raw>},
// `error` being what gets translated and `detail` only good for the logs.

const STATUS_TIMEOUT_MS = 4000;
// ?verify=true asks the hub, which may take up to 10 s.
const VERIFY_TIMEOUT_MS = 12000;
// Login goes out to the hub as well.
const LOGIN_TIMEOUT_MS = 15000;
const ACTION_TIMEOUT_MS = 8000;

// Neither list is exhaustive: the backend may add keys without the app being
// updated, hence the generic labels.
const ERROR_KEYS = [
  'missing_credentials',
  'invalid_credentials',
  'totp_required',
  'invalid_totp',
  'hub_unreachable',
  'hub_rejected',
  'hub_error',
  'token_expired',
  'not_connected',
  'busy',
  'processing_in_progress',
  'not_processed',
  'invalid_image',
  'no_image',
  'invalid_line',
  'invalid_path',
  'file_not_found',
  'missing_observation_date',
  'invalid_observation_date',
  'quota_exceeded',
  'upload_failed',
  'request_failed',
];

const STEP_KEYS = [
  'starting',
  'checking_account',
  'creating_session',
  'uploading_images',
  'publishing',
  'done',
];

export const hubErrorKey = (error) =>
  'common:hubError_' + (ERROR_KEYS.includes(error) ? error : 'generic');

export const hubStepKey = (step) =>
  'common:hubStep_' + (STEP_KEYS.includes(step) ? step : 'generic');

/**
 * What the hub routes take as `filename`: the SER of a scan, the `path` of a
 * stack or an animation (storage/stacking/<folder>). The channel key is its md5.
 */
export const hubFilename = (item) => item?.ser || item?.path || null;

/**
 * Whether the backend can send this item. Stacks and animations only carry
 * `hub_status` once the backend sends them too: the one of 19/09 morning only
 * knew scans, and answers invalid_path for the others.
 */
export const hubCanSend = (item) => !!item && (!!item.ser || item.hub_status !== undefined);

/** Resolves to {status, json}; `json` is null on a non JSON answer. Rejects when unreachable. */
async function request(apiURL, path, { method = 'GET', body, timeoutMs = ACTION_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`http://${apiURL}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    let json = null;
    try {
      json = await response.json();
    } catch {
      // Non JSON answer (old backend 404 page...): the status says enough
    }
    return { status: response.status, json };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET /spectrosolhub/status. Resolves to the account state, or
 * {supported: false} against a backend without the hub routes.
 * `verify` checks the token with the hub: `verified`, `error` and `quota` are
 * then filled, and an expired token comes back with `connected: false`.
 */
export async function getHubStatus(apiURL, { verify = false } = {}) {
  const { status, json } = await request(
    apiURL,
    `/spectrosolhub/status${verify ? '?verify=true' : ''}`,
    { timeoutMs: verify ? VERIFY_TIMEOUT_MS : STATUS_TIMEOUT_MS }
  );
  if (status === 404 || !json) {
    return { supported: false };
  }
  return { supported: true, ...json };
}

/** POST /spectrosolhub/login. Resolves to {ok, account} or {ok: false, error, detail}. */
export async function hubLogin(apiURL, { username, password, totpCode = '' }) {
  try {
    const { status, json } = await request(apiURL, '/spectrosolhub/login', {
      method: 'POST',
      body: { username, password, totp_code: totpCode },
      timeoutMs: LOGIN_TIMEOUT_MS,
    });
    if (status === 200 && json?.connected) {
      return { ok: true, account: { supported: true, ...json } };
    }
    return { ok: false, error: json?.error || 'hub_error', detail: json?.detail || `HTTP ${status}` };
  } catch (e) {
    return { ok: false, error: 'request_failed', detail: e?.message };
  }
}

/** POST /spectrosolhub/logout. The token stays listed on the site, where it can be revoked. */
export async function hubLogout(apiURL) {
  const { status } = await request(apiURL, '/spectrosolhub/logout', { method: 'POST' });
  return status >= 200 && status < 300;
}

/**
 * POST /spectrosolhub/scan/: what the upload screen needs for one scan, stack
 * or animation (type, images, defaults, lines, last_upload).
 * Resolves to {ok, data} or {ok: false, error}.
 */
export async function getHubScan(apiURL, filename) {
  try {
    const { status, json } = await request(apiURL, '/spectrosolhub/scan/', {
      method: 'POST',
      body: { filename },
    });
    if (status === 200 && json?.key) {
      return { ok: true, data: json };
    }
    return { ok: false, error: json?.error || 'hub_error', detail: json?.detail || `HTTP ${status}` };
  } catch (e) {
    return { ok: false, error: 'request_failed', detail: e?.message };
  }
}

/**
 * Account state shared through the app context. `hubSupported` stays false
 * until a backend answers the hub routes, and the whole feature is hidden
 * meanwhile.
 */
export function useHubAccountState(apiURL, sunscanIsConnected) {
  const [hubSupported, setHubSupported] = useState(false);
  const [hubAccount, setHubAccount] = useState(null);

  const refreshHubAccount = useCallback(async ({ verify = false } = {}) => {
    try {
      const account = await getHubStatus(apiURL, { verify });
      setHubSupported(account.supported);
      setHubAccount(account.supported ? account : null);
      return account;
    } catch (e) {
      // Unreachable SUNSCAN: keep what is known, the next connection retries.
      return null;
    }
  }, [apiURL]);

  // Another SUNSCAN may not know the hub, nor this account. Declared first so
  // the reset never lands after the answer of the probe below.
  useEffect(() => {
    setHubSupported(false);
    setHubAccount(null);
  }, [apiURL]);

  useEffect(() => {
    if (sunscanIsConnected) {
      refreshHubAccount();
    }
  }, [sunscanIsConnected, refreshHubAccount]);

  return { hubSupported, hubAccount, setHubAccount, refreshHubAccount };
}

/**
 * Whether the SUNSCAN can reach the hub right now, checked when `check` is
 * called (on focus of a screen). Resolves `reachable` to:
 *   null  while unknown, and whenever nothing proves the hub out of reach: an
 *         older backend without the network API, or no account to verify
 *         with (the sign-in then tells);
 *   false with `reason` 'hotspot' (the SUNSCAN runs its own wifi, no internet)
 *         or 'hub_unreachable' (on a wifi, but the hub does not answer);
 *   true  otherwise.
 * The hub check goes through the context's refreshHubAccount, so an expired
 * token found on the way also updates the account everywhere.
 */
export function useHubReachability() {
  const { apiURL, hubSupported, hubAccount, refreshHubAccount } = useContext(AppContext);
  const [state, setState] = useState({ reachable: null, reason: null });
  const accountConnected = !!hubAccount?.connected;

  const check = useCallback(async () => {
    if (!hubSupported) {
      return;
    }
    try {
      const network = await getNetworkStatus(apiURL);
      if (network?.mode === 'hotspot') {
        setState({ reachable: false, reason: 'hotspot' });
        return;
      }
    } catch (e) {
      // SUNSCAN unreachable: the connection state already says so.
      return;
    }
    if (!accountConnected) {
      setState({ reachable: null, reason: null });
      return;
    }
    const account = await refreshHubAccount({ verify: true });
    if (account?.verified === false && account.error === 'hub_unreachable') {
      setState({ reachable: false, reason: 'hub_unreachable' });
    } else {
      setState({ reachable: account?.verified ? true : null, reason: null });
    }
  }, [apiURL, hubSupported, accountConnected, refreshHubAccount]);

  return { ...state, check };
}

const IDLE = {
  status: 'idle',
  percent: 0,
  step: null,
  errorKey: null,
  image: 0,
  images: 0,
  url: '',
  published: false,
};

/**
 * Starts and follows the upload of one scan, stack or animation to the hub, on the channel
 *
 *   spectrosolhub_upload_<key>;#;<status>;#;<percent>;#;<step>;#;<error>;#;<detail>;#;<image>;#;<images>;#;<url>;#;<published>
 *
 * The order is not the one of the processing: the final state of a previous
 * upload stays replayable for 30 minutes, and a listener attached before the
 * POST could take it for the new one. So: POST, wait for the 202 (the backend
 * resets the scan's state before answering), subscribe, then ask for the state
 * once to catch up with what happened in between. A message sent before that
 * answer may still be read after it, hence a percentage that never goes back
 * while processing, a final state that always wins, and nothing read after it.
 *
 * @param {object} scan  a scan (`ser` is read) or a stack / animation (`path`)
 * @param {object} options
 * @param {function} options.onCompleted called once with {url, published}
 */
export function useHubUpload(scan, { onCompleted } = {}) {
  const myContext = useContext(AppContext);
  const [subscribe, unsubscribe] = useContext(WebSocketContext);
  const { apiURL } = myContext;

  const ser = hubFilename(scan);
  const channel = useMemo(() => (ser ? 'spectrosolhub_upload_' + md5(ser) : null), [ser]);

  const [state, setState] = useState(IDLE);

  const handlers = useRef({});
  handlers.current = { onCompleted };

  // Bumped by every start and on unmount: a callback from an earlier run, or
  // an answer that lands after the screen is gone, is then simply ignored.
  const run = useRef(0);
  const finished = useRef(true);
  const listener = useRef(null);

  const detach = useCallback(() => {
    if (listener.current) {
      unsubscribe(listener.current.channel, listener.current.callback);
      listener.current = null;
    }
  }, [unsubscribe]);

  // Returns the function that applies one state, bound to run `id`.
  const makeApply = useCallback((id) => (message) => {
    if (id !== run.current || finished.current) {
      return;
    }
    const [, status, rawPercent, step, error, detail, image, images, url, published] = message;
    if (status === 'processing') {
      const value = parseInt(rawPercent, 10);
      setState((prev) => ({
        ...prev,
        status: 'processing',
        percent: Math.max(prev.status === 'processing' ? prev.percent : 0, isNaN(value) ? 0 : value),
        step: step || prev.step,
        image: parseInt(image, 10) || 0,
        images: parseInt(images, 10) || prev.images,
        url: url || prev.url,
      }));
      return;
    }
    if (status !== 'completed' && status !== 'failed') {
      // 'unknown': nothing known yet, the channel will tell.
      return;
    }
    finished.current = true;
    detach();
    const isPublished = published === '1';
    if (status === 'failed') {
      console.warn('hub upload failed', step, error, detail);
    }
    setState((prev) => ({
      ...prev,
      status,
      percent: status === 'completed' ? 100 : prev.percent,
      step: step || prev.step,
      errorKey: status === 'failed' ? (error || '') : null,
      image: parseInt(image, 10) || prev.image,
      images: parseInt(images, 10) || prev.images,
      url: url || '',
      published: isPublished,
    }));
    if (status === 'completed') {
      handlers.current.onCompleted?.({ url, published: isPublished });
    }
  }, [detach]);

  const attach = useCallback((id) => {
    detach();
    const callback = makeApply(id);
    subscribe(channel, callback);
    listener.current = { channel, callback };
    return callback;
  }, [channel, subscribe, detach, makeApply]);

  const fetchState = useCallback(async () => {
    const { json } = await request(apiURL, '/spectrosolhub/upload/status/', {
      method: 'POST',
      body: { filename: ser },
    });
    return json;
  }, [apiURL, ser]);

  // The status route answers with named fields: rebuilt as a channel message
  // so both sources go through the same rules.
  const asMessage = (s) => [
    channel, s.status, String(s.percent ?? 0), s.step || '', s.error || '', s.detail || '',
    String(s.image ?? 0), String(s.images ?? 0), s.url || '', String(s.published ?? 0),
  ];

  /**
   * Launches the upload. Resolves to null once it is started, or to the error
   * key of an immediate refusal (not_connected, busy...), also stored in the state.
   */
  const startUpload = useCallback(async (body) => {
    if (!ser) {
      return 'file_not_found';
    }
    const id = ++run.current;
    detach();
    finished.current = false;
    setState({ ...IDLE, status: 'processing', step: 'starting' });

    const failLocally = (error) => {
      if (id !== run.current) {
        return;
      }
      finished.current = true;
      setState({ ...IDLE, status: 'failed', errorKey: error });
    };

    let response;
    try {
      response = await request(apiURL, '/spectrosolhub/upload/', {
        method: 'POST',
        body: { filename: ser, ...body },
      });
    } catch (e) {
      console.warn('hub upload request failed', e?.message);
      failLocally('request_failed');
      return 'request_failed';
    }
    if (response.status !== 202) {
      const error = response.json?.error || 'upload_failed';
      console.warn('hub upload refused', error, response.json?.detail);
      failLocally(error);
      return error;
    }
    if (id !== run.current) {
      return null;
    }

    const apply = attach(id);
    try {
      const s = await fetchState();
      if (s?.status) {
        apply(asMessage(s));
      }
    } catch (e) {
      // The channel remains the source of truth.
    }
    return null;
  }, [ser, apiURL, attach, detach, fetchState, channel]);

  /**
   * Picks up an upload already under way for this scan (started from another
   * screen, or before the app was killed). A finished one is not replayed: the
   * screen opens on the form, with last_upload telling what went out.
   */
  const resume = useCallback(async () => {
    if (!ser || !finished.current) {
      return;
    }
    const id = run.current;
    try {
      const s = await fetchState();
      if (id !== run.current || s?.status !== 'processing') {
        return;
      }
      finished.current = false;
      const apply = attach(id);
      apply(asMessage(s));
    } catch (e) {
      // Older backend or unreachable: nothing to resume.
    }
  }, [ser, attach, fetchState, channel]);

  const reset = useCallback(() => {
    if (finished.current) {
      setState(IDLE);
    }
  }, []);

  useEffect(() => () => {
    run.current++;
    finished.current = true;
    detach();
    setState(IDLE);
  }, [channel, detach]);

  return { ...state, startUpload, resume, reset };
}
