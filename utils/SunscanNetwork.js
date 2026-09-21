import { NativeModules } from 'react-native';

export const DEFAULT_SUNSCAN_PORT = 8000;

// Address of the SUNSCAN when it runs its own hotspot (the default).
export const HOTSPOT_API_URL = `10.42.0.1:${DEFAULT_SUNSCAN_PORT}`;

// Timings of a switch to the home wifi, as announced by the backend: it waits
// `switch_in` seconds before leaving the hotspot, gives the home network
// `timeout` seconds, and needs up to ~30 s to bring the hotspot back on failure.
export const HOTSPOT_RETURN_S = 30;

const STATUS_TIMEOUT_MS = 4000;
// A scan takes 3 to 10 s on the SUNSCAN side.
const SCAN_TIMEOUT_MS = 20000;
const ACTION_TIMEOUT_MS = 8000;

// mDNS / DNS-SD service announced by the backend: `SunScan <id>`, TXT id=<id>
const MDNS_SERVICE_TYPE = 'sunscan';
// A browse started on one network does not always follow the phone to the
// next one (which is exactly what happens while the SUNSCAN switches), so the
// browse is restarted periodically.
const MDNS_RESTART_MS = 10000;
const MDNS_HOST = 'sunscan.local';

// Error codes the backend can return, immediately or in attempt.error.
// Anything else is shown as a generic failure.
export const WIFI_ERROR_CODES = [
  'invalid_ssid',
  'invalid_password',
  'unsupported_security',
  'busy',
  'not_supported',
  'wrong_password',
  'network_not_found',
  'timeout',
  'no_address',
  'connection_failed',
];

// Security modes the SUNSCAN can join (wep and enterprise are refused)
const SUPPORTED_SECURITY = ['open', 'psk', 'sae'];

export const isSecuritySupported = (security) => !security || SUPPORTED_SECURITY.includes(security);

// Byte length of the UTF-8 encoding: an SSID is capped at 32 bytes, not chars.
function utf8Length(value) {
  let bytes = 0;
  for (const char of value) {
    const code = char.codePointAt(0);
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/**
 * Checks the fields the backend would refuse with a 400, so the user gets the
 * message without a round trip. Returns an error code or null.
 * `security` is unknown (undefined) for a hidden network typed by hand.
 */
export function validateWifiCredentials({ ssid, password, security, hotspotSsid }) {
  if (!ssid || utf8Length(ssid) > 32 || (hotspotSsid && ssid === hotspotSsid)) {
    return 'invalid_ssid';
  }
  if (!isSecuritySupported(security)) {
    return 'unsupported_security';
  }
  const needsPassword = security ? security !== 'open' : !!password;
  if (needsPassword && (!password || password.length < 8 || password.length > 63)) {
    return 'invalid_password';
  }
  return null;
}

// Maps an error code to its translation key, falling back to the generic one
export function wifiErrorKey(code) {
  return `common:wifiError_${WIFI_ERROR_CODES.includes(code) ? code : 'connection_failed'}`;
}

/**
 * Calls the network API of the SUNSCAN at `hostWithPort`.
 * Resolves to {status, json}; rejects on transport failure or timeout.
 */
async function request(hostWithPort, path, { method = 'GET', body, timeoutMs = ACTION_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`http://${hostWithPort}${path}`, {
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
 * GET /network/status. Resolves to the status payload, or {supported:false}
 * when the backend predates the network API. Rejects when unreachable.
 */
export async function getNetworkStatus(hostWithPort, timeoutMs = STATUS_TIMEOUT_MS) {
  const { status, json } = await request(hostWithPort, '/network/status', { timeoutMs });
  if (status === 404 || !json) {
    return { supported: false };
  }
  return json;
}

// GET /network/wifi/scan. `refresh: false` returns the last results without scanning.
export async function scanWifiNetworks(hostWithPort, { refresh = true } = {}) {
  const { json } = await request(
    hostWithPort,
    `/network/wifi/scan${refresh ? '' : '?refresh=false'}`,
    { timeoutMs: SCAN_TIMEOUT_MS }
  );
  return json || { networks: [], cached: true, scanned_at: null };
}

/**
 * POST /network/wifi/connect. Resolves to {accepted, error, detail, switchIn, timeout}.
 * The phone loses the SUNSCAN a couple of seconds after an accepted request.
 */
export async function connectWifi(hostWithPort, { ssid, password, hidden }) {
  const { status, json } = await request(hostWithPort, '/network/wifi/connect', {
    method: 'POST',
    body: { ssid, password: password || '', hidden: !!hidden },
  });
  if (status === 202) {
    return {
      accepted: true,
      switchIn: json?.switch_in ?? 2,
      timeout: json?.timeout ?? 45,
    };
  }
  return {
    accepted: false,
    error: json?.error || 'connection_failed',
    detail: json?.detail || `HTTP ${status}`,
  };
}

// POST /network/wifi/forget. Resolves to {ok, error}.
export async function forgetWifi(hostWithPort, ssid) {
  const { status, json } = await request(hostWithPort, '/network/wifi/forget', {
    method: 'POST',
    body: { ssid },
  });
  return { ok: status >= 200 && status < 300, error: json?.error };
}

// POST /network/hotspot. Resolves to the backend answer ({status, switching}).
export async function switchToHotspot(hostWithPort) {
  const { json } = await request(hostWithPort, '/network/hotspot', { method: 'POST' });
  return json || {};
}

/**
 * Resolves to true when `hostWithPort` is the SUNSCAN identified by `deviceId`
 * (any SUNSCAN when no id is known yet).
 */
export async function probeDevice(hostWithPort, deviceId, timeoutMs = 2000) {
  try {
    const status = await getNetworkStatus(hostWithPort, timeoutMs);
    if (!status || status.supported === false) {
      return false;
    }
    return !deviceId || status.device_id === deviceId;
  } catch {
    return false;
  }
}

// --- mDNS ------------------------------------------------------------------

// react-native-zeroconf is native: missing in Expo Go and on the web, where
// discovery silently falls back to the other methods.
function createZeroconf() {
  if (!NativeModules.RNZeroconf) {
    return null;
  }
  try {
    const Zeroconf = require('react-native-zeroconf').default;
    return new Zeroconf();
  } catch (e) {
    console.log('mDNS: zeroconf unavailable', e?.message);
    return null;
  }
}

// Only one browse at a time: the native module keeps a single browser.
let activeWatch = null;

/**
 * Browses `_sunscan._tcp` and calls `onFound({url, id, version})` for each
 * SUNSCAN resolved, filtered on `deviceId` when given (every SUNSCAN is called
 * sunscan.local, the TXT id is the only reliable identity).
 * Returns a stop function. Does nothing when zeroconf is unavailable.
 */
export function watchSunscanMdns({ deviceId, onFound }) {
  if (activeWatch) {
    activeWatch();
  }
  const zeroconf = createZeroconf();
  if (!zeroconf) {
    return () => {};
  }

  let stopped = false;
  zeroconf.on('resolved', (service) => {
    if (stopped) {
      return;
    }
    const id = service?.txt?.id;
    if (deviceId && id !== deviceId) {
      return;
    }
    const ip = (service.addresses || []).find((a) => a.includes('.') && !a.includes(':'));
    if (!ip) {
      return;
    }
    onFound({ url: `${ip}:${service.port || DEFAULT_SUNSCAN_PORT}`, id, version: service?.txt?.version });
  });
  zeroconf.on('error', (err) => console.log('mDNS error', err?.message));

  const scan = () => {
    try {
      zeroconf.stop();
    } catch {}
    try {
      zeroconf.scan(MDNS_SERVICE_TYPE, 'tcp', 'local.');
    } catch (e) {
      console.log('mDNS: scan failed', e?.message);
    }
  };
  scan();
  const restartTimer = setInterval(scan, MDNS_RESTART_MS);

  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    clearInterval(restartTimer);
    try {
      zeroconf.stop();
    } catch {}
    zeroconf.removeDeviceListeners();
    zeroconf.removeAllListeners();
    if (activeWatch === stop) {
      activeWatch = null;
    }
  };
  activeWatch = stop;
  return stop;
}

/**
 * Looks for a SUNSCAN on the network the phone is on, in the order advised by
 * the backend: mDNS browse, the address it had last time on the home network,
 * then the sunscan.local host name. Resolves to {url, method} or null.
 */
export async function locateSunscan({ deviceId, lastIp, mdnsTimeoutMs = 10000, isCancelled } = {}) {
  const cancelled = () => typeof isCancelled === 'function' && isCancelled();

  const viaMdns = await new Promise((resolve) => {
    let stop = () => {};
    const done = (value) => {
      clearTimeout(timer);
      clearInterval(cancelPoll);
      stop();
      resolve(value);
    };
    const timer = setTimeout(() => done(null), mdnsTimeoutMs);
    const cancelPoll = setInterval(() => cancelled() && done(null), 250);
    stop = watchSunscanMdns({ deviceId, onFound: ({ url }) => done(url) });
  });
  if (viaMdns) {
    return { url: viaMdns, method: 'zeroconf' };
  }
  if (cancelled()) {
    return null;
  }

  if (lastIp) {
    const url = `${lastIp}:${DEFAULT_SUNSCAN_PORT}`;
    if (await probeDevice(url, deviceId)) {
      return { url, method: 'lastIp' };
    }
  }
  if (cancelled()) {
    return null;
  }

  const mdnsHost = `${MDNS_HOST}:${DEFAULT_SUNSCAN_PORT}`;
  if (await probeDevice(mdnsHost, deviceId, 3000)) {
    return { url: mdnsHost, method: 'mdns' };
  }
  return null;
}
