import * as Network from 'expo-network';

export const DEFAULT_SUNSCAN_PORT = 8000;

// The SUNSCAN backend answers /sunscan/stats with a payload carrying
// backend_api_version. We use that field as a fingerprint so another device
// listening on the same port is never mistaken for a SUNSCAN.
const PROBE_PATH = '/sunscan/stats';

// On a local network a SUNSCAN answers well under a second; unused addresses
// have to hit this timeout before we move on, so it drives the total scan time.
const PROBE_TIMEOUT_MS = 1200;

// mDNS resolution is slower than a direct IP hit, hence a longer timeout.
const MDNS_HOST = 'sunscan.local';
const MDNS_TIMEOUT_MS = 3000;

// Concurrent probes per batch. High enough to sweep a /24 in a few seconds,
// low enough not to exhaust the socket pool on iOS.
const BATCH_SIZE = 32;

const LAST_HOST = 254;

/**
 * Cleans up a user-typed address: drops the scheme and trailing slashes,
 * and appends the default port when none is given.
 */
export function normalizeApiURL(value) {
  let url = (value || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (url && !url.includes(':')) {
    url += `:${DEFAULT_SUNSCAN_PORT}`;
  }
  return url;
}

/**
 * Returns the /24 prefix of an IPv4 address ("192.168.1.42" -> "192.168.1"),
 * or null when the address is not a usable IPv4 (IPv6, 0.0.0.0, undefined...).
 */
function ipv4Prefix(ip) {
  const parts = (ip || '').split('.');
  if (parts.length !== 4) {
    return null;
  }
  const numbers = parts.map(Number);
  if (numbers.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  if (numbers[0] === 0 || numbers[0] === 127) {
    return null;
  }
  return parts.slice(0, 3).join('.');
}

/**
 * Probes a single "host:port" and resolves to true only when it answers
 * with a SUNSCAN stats payload.
 */
export async function probeSunscan(hostWithPort, timeoutMs = PROBE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`http://${hostWithPort}${PROBE_PATH}`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) {
      return false;
    }
    const json = await response.json();
    return Boolean(json && json.backend_api_version);
  } catch (e) {
    // Timeout, connection refused, non-JSON answer: not a SUNSCAN.
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Looks for a SUNSCAN reachable on the same network as the phone.
 *
 * Tries the sunscan.local mDNS name first (instant when the network resolves
 * it), then falls back to sweeping the phone's /24 subnet.
 *
 * @param {object} options
 * @param {number} options.port          port the backend listens on
 * @param {function} options.onProgress  called with {phase, scanned, total}
 * @param {function} options.isCancelled polled between batches to abort early
 * @returns {Promise<{url: string, method: string}|null>}
 */
export async function discoverSunscan({ port = DEFAULT_SUNSCAN_PORT, onProgress, isCancelled } = {}) {
  const cancelled = () => typeof isCancelled === 'function' && isCancelled();
  const report = (phase, scanned, total) => {
    if (typeof onProgress === 'function') {
      onProgress({ phase, scanned, total });
    }
  };

  // 1. mDNS hostname: no scan needed when the network resolves it.
  report('mdns', 0, 0);
  const mdnsHost = `${MDNS_HOST}:${port}`;
  if (await probeSunscan(mdnsHost, MDNS_TIMEOUT_MS)) {
    return { url: mdnsHost, method: 'mdns' };
  }
  if (cancelled()) {
    return null;
  }

  // 2. Sweep the phone's own /24 subnet.
  let ip;
  try {
    ip = await Network.getIpAddressAsync();
  } catch (e) {
    console.log('Discovery: could not read device IP', e);
    return null;
  }
  const prefix = ipv4Prefix(ip);
  if (!prefix) {
    console.log('Discovery: unusable device IP', ip);
    return null;
  }

  // DHCP tends to hand out nearby addresses, so probing outwards from our own
  // address finds the SUNSCAN sooner than a plain 1..254 sweep.
  const ownHost = Number(ip.split('.')[3]);
  const candidates = [];
  for (let i = 1; i <= LAST_HOST; i++) {
    if (i !== ownHost) {
      candidates.push(i);
    }
  }
  candidates.sort((a, b) => Math.abs(a - ownHost) - Math.abs(b - ownHost));

  let scanned = 0;
  report('scan', 0, candidates.length);
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    if (cancelled()) {
      return null;
    }
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (host) => {
        const candidate = `${prefix}.${host}:${port}`;
        return (await probeSunscan(candidate)) ? candidate : null;
      })
    );
    scanned += batch.length;
    report('scan', scanned, candidates.length);

    const found = results.find(Boolean);
    if (found) {
      return { url: found, method: 'scan' };
    }
  }

  return null;
}
