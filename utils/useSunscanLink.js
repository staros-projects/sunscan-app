import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { HOTSPOT_API_URL, locateSunscan, probeAnySunscan } from './SunscanNetwork';
import { discoverSunscan } from './Discovery';

// How the phone reaches the SUNSCAN: through its hotspot at the fixed address,
// or across the home network at `lanApiURL`. The choice used to be a switch in
// the settings; it is now found out by probing, so the user never has to know
// which network the box is on, nor tell the app about it.

// A probe that does not answer in this time is not there: the hotspot address
// from the home network, or a stale home address from the hotspot, both hang.
const PROBE_TIMEOUT_MS = 2500;
// mDNS browse of a quiet search. The deep search, from the settings, sweeps the
// subnet as well and has its own timings (Discovery.js).
const MDNS_TIMEOUT_MS = 6000;
// At start-up the websocket opens on the stored address within a second when
// it is right: no need to probe before that.
const STARTUP_GRACE_MS = 1500;
// A link that drops comes back by itself most of the time (the box was busy,
// the phone changed cell): wait before looking elsewhere.
const LOST_GRACE_MS = 6000;
// Never look for the box more often than this on our own initiative.
const AUTO_INTERVAL_MS = 30000;

const IDLE = { running: false, deep: false, progress: null, outcome: null };

/**
 * Keeps `viaHotspot` / `lanApiURL` pointing at where the SUNSCAN actually is.
 *
 * Probes on its own when the app starts or comes to the foreground without a
 * link, and a few seconds after the link drops (never while a scan records:
 * the box has nothing to spare then). `discover({deep: true})` is the search
 * offered in the settings, which also sweeps the phone's subnet.
 *
 * Returns {search, discover, cancel}. `search` is {running, deep, progress,
 * outcome}: `progress` is the {phase, scanned, total} of the deep search, and
 * `outcome` is 'found' or 'none' once a search is over.
 */
export default function useSunscanLink({
  ready, connected, recording,
  viaHotspot, setViaHotspot, lanApiURL, setLanApiURL, device, setDevice,
}) {
  const [search, setSearch] = useState(IDLE);
  // The search in flight, {cancelled}. A cancelled search finishes its current
  // probe in the background and must not report over a newer one.
  const runRef = useRef(null);
  const lastAutoRef = useRef(0);
  const startedRef = useRef(false);
  // Read by the callbacks and timers, which must see the current values
  // without being recreated on every change
  const latest = useRef({});
  latest.current = { connected, recording, viaHotspot, lanApiURL, device };

  // Point the app at `url`, and remember what the answer said about the box
  const apply = useCallback((url, info) => {
    if (url === HOTSPOT_API_URL) {
      setViaHotspot(true);
    } else {
      setLanApiURL(url);
      setViaHotspot(false);
    }
    if (!info) {
      return;
    }
    setDevice((prev) => {
      const next = {
        ...prev,
        id: info.deviceId || prev?.id,
        hotspot: info.hotspot || prev?.hotspot,
        lastIp: info.mode === 'client' && info.ip ? info.ip : prev?.lastIp,
      };
      // Same identity : keep the object, the settings are saved on each change
      const same = prev && ['id', 'hotspot', 'lastIp'].every((k) => (prev[k] || '') === (next[k] || ''));
      return same ? prev : next;
    });
  }, [setViaHotspot, setLanApiURL, setDevice]);

  const discover = useCallback(async ({ deep = false } = {}) => {
    if (runRef.current) {
      runRef.current.cancelled = true;
    }
    const run = { cancelled: false };
    runRef.current = run;
    setSearch({ running: true, deep, progress: null, outcome: null });

    const { viaHotspot: hot, lanApiURL: lan, device: dev } = latest.current;
    const current = hot ? HOTSPOT_API_URL : lan;
    // The address in use first (nothing to change when it answers), then the other one
    const candidates = [...new Set([current, HOTSPOT_API_URL, lan].filter(Boolean))];
    let found = null;
    try {
      for (const url of candidates) {
        if (run.cancelled) {
          break;
        }
        const info = await probeAnySunscan(url, PROBE_TIMEOUT_MS);
        if (info) {
          found = { url, info };
          break;
        }
      }
      if (!found && !run.cancelled) {
        const options = { deviceId: dev?.id, lastIp: dev?.lastIp, isCancelled: () => run.cancelled };
        const located = deep
          ? await discoverSunscan({
              ...options,
              onProgress: (progress) => {
                if (runRef.current === run) {
                  setSearch((s) => ({ ...s, progress }));
                }
              },
            })
          : await locateSunscan({ ...options, mdnsTimeoutMs: MDNS_TIMEOUT_MS });
        if (located && !run.cancelled) {
          found = { url: located.url, info: await probeAnySunscan(located.url, PROBE_TIMEOUT_MS) };
        }
      }
    } catch (e) {
      console.log('link: discovery failed', e?.message);
    }
    if (runRef.current !== run) {
      return null; // cancelled, or superseded by a newer search
    }
    runRef.current = null;
    if (found) {
      apply(found.url, found.info);
    }
    setSearch({ running: false, deep, progress: null, outcome: found ? 'found' : 'none' });
    return found ? found.url : null;
  }, [apply]);

  const cancel = useCallback(() => {
    if (runRef.current) {
      runRef.current.cancelled = true;
      runRef.current = null;
    }
    setSearch(IDLE);
  }, []);

  // On our own initiative: quiet search, rate limited, never over a search in progress
  const autoDiscover = useCallback(() => {
    if (runRef.current || latest.current.connected || latest.current.recording) {
      return;
    }
    if (Date.now() - lastAutoRef.current < AUTO_INTERVAL_MS) {
      return;
    }
    lastAutoRef.current = Date.now();
    discover();
  }, [discover]);

  // At start-up, and each time the link drops
  useEffect(() => {
    if (!ready || connected) {
      return undefined;
    }
    const delay = startedRef.current ? LOST_GRACE_MS : STARTUP_GRACE_MS;
    startedRef.current = true;
    const timer = setTimeout(autoDiscover, delay);
    return () => clearTimeout(timer);
  }, [ready, connected, autoDiscover]);

  // Back to the foreground without a link: the phone may have changed network meanwhile
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        lastAutoRef.current = 0; // a fresh look is worth it here
        autoDiscover();
      }
    });
    return () => subscription.remove();
  }, [autoDiscover]);

  return { search, discover, cancel };
}
