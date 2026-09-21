// Linux desktop of the Pi. The SUNSCAN is driven from the phone, so the backend
// boots without the desktop, and the app offers to turn it on for whoever
// works on the Pi with a screen. The backend being a system service, the link
// with the phone survives the switch: nothing to reconnect.
//
// Errors come back as {status: 'failed', error: <key>, detail: <raw>}, `error`
// being what gets translated and `detail` only good for the logs.

const STATUS_TIMEOUT_MS = 4000;
// The POST only answers once the switch is over, and a stop takes up to 45 s
// when an application is slow to close.
const SWITCH_TIMEOUT_MS = 60000;

// 'recording': `running` asked for while a scan is being recorded. The others
// (systemctl failures...) are shown as a generic failure.
const ERROR_KEYS = ['recording'];

export const desktopErrorKey = (error) =>
  'common:desktopError_' + (ERROR_KEYS.includes(error) ? error : 'generic');

/** Resolves to {status, json}; `json` is null on a non JSON answer. Rejects when unreachable. */
async function request(apiURL, path, { method = 'GET', body, timeoutMs } = {}) {
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
 * GET /sunscan/desktop. Resolves to {running, at_boot, ...}, or to null when
 * there is nothing to offer: backend older than the route (404), or system
 * image without a desktop (Raspberry Pi OS Lite). Rejects when unreachable.
 */
export async function getDesktopState(apiURL) {
  const { status, json } = await request(apiURL, '/sunscan/desktop', { timeoutMs: STATUS_TIMEOUT_MS });
  return status === 200 && json?.supported ? json : null;
}

/**
 * POST /sunscan/desktop with `running` and/or `at_boot`, a missing field being
 * left as it is. `running` only holds until the Pi is powered off, `at_boot`
 * does not touch the desktop currently running.
 * Resolves to {ok: true, desktop}, the state read after the switch, or to
 * {ok: false, error, detail}. Rejects when unreachable.
 */
export async function setDesktopState(apiURL, body) {
  const { status, json } = await request(apiURL, '/sunscan/desktop', {
    method: 'POST',
    body,
    timeoutMs: SWITCH_TIMEOUT_MS,
  });
  if (status === 200 && json) {
    return { ok: true, desktop: json };
  }
  return { ok: false, error: json?.error, detail: json?.detail || `HTTP ${status}` };
}
