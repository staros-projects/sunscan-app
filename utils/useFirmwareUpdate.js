import { useContext, useState } from 'react';
import { Asset, useAssets } from 'expo-asset';

import AppContext from '../components/AppContext';
import firmareIsUpToDate from './Helpers';

// Firmware payload pushed to the SUNSCAN. Kept at module scope so the prefetch
// (useAssets) and the upload (Asset.fromModule) refer to the very same asset.
const FIRMWARE_ZIP = require('../assets/sunscan_backend_source.zip');

// The SUNSCAN restarts its backend as soon as it has unpacked the archive, so
// the HTTP response of /update is regularly lost. These bound the upload and
// the "did it actually land?" probe that follows a dropped connection.
const FIRMWARE_UPLOAD_TIMEOUT_MS = 120000;
const FIRMWARE_PROBE_TIMEOUT_MS = 60000;
const FIRMWARE_PROBE_INTERVAL_MS = 3000;
// On a good connection the upload is over in a second or two, which reads as
// "nothing happened". The progress screen stays up at least this long.
const FIRMWARE_MIN_DURATION_MS = 6000;

/**
 * Pushes the firmware embedded in the app to the SUNSCAN.
 *
 * status: 'idle' | 'updating' | 'success' | 'failed'. `detail` carries the
 * backend's own message when it refused the archive, null otherwise.
 */
export default function useFirmwareUpdate() {
  const myContext = useContext(AppContext);
  // Prefetch the ZIP so the upload does not have to wait for it
  useAssets([FIRMWARE_ZIP]);
  const [status, setStatus] = useState('idle');
  const [detail, setDetail] = useState(null);

  // Ask the SUNSCAN which backend version it currently runs. Returns null when
  // the device is unreachable, which during an update simply means "not back yet".
  const readBackendVersion = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FIRMWARE_PROBE_INTERVAL_MS);
    try {
      const response = await fetch('http://' + myContext.apiURL + '/sunscan/stats', {
        signal: controller.signal,
      });
      const json = await response.json();
      return json?.backend_api_version || null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  // The device drops the connection while it restarts, so a network error on
  // /update tells us nothing. Poll the stats endpoint until the backend answers
  // again and report what version actually ended up installed.
  const probeFirmwareAfterRestart = async () => {
    const deadline = Date.now() + FIRMWARE_PROBE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const version = await readBackendVersion();
      if (version) {
        myContext.setBackendApiVersion(version);
        return firmareIsUpToDate({ backendApiVersion: version });
      }
      await new Promise((resolve) => setTimeout(resolve, FIRMWARE_PROBE_INTERVAL_MS));
    }
    return false;
  };

  // Runs the upload and resolves to its outcome, { status, detail }
  const runUpdate = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FIRMWARE_UPLOAD_TIMEOUT_MS);
    try {
      // useAssets may not have finished yet, and in a production build the
      // asset only has a bundle URI until it is downloaded. Without a readable
      // file:// URI the native layer fails the multipart part, which surfaces
      // as the same generic "Network request failed" as a real network issue.
      const asset = Asset.fromModule(FIRMWARE_ZIP);
      if (!asset.localUri) {
        await asset.downloadAsync();
      }
      const uri = asset.localUri || asset.uri;
      if (!uri) {
        return { status: 'failed' };
      }

      // Content-Type is deliberately left unset: React Native builds the
      // multipart body itself and needs to attach its own boundary.
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: 'sunscan_backend_source.zip',
        type: 'application/zip',
      });

      const response = await fetch('http://' + myContext.apiURL + '/update', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (response.ok) {
        return { status: 'success' };
      }
      return { status: 'failed', detail: (await response.text()) || `HTTP ${response.status}` };
    } catch (e) {
      // fetch rejects with a generic "Network request failed" for every
      // transport failure, including the backend closing the socket while it
      // restarts on a successful update. Check the device before crying wolf.
      console.log('firmware update request failed:', e?.message);
      return { status: (await probeFirmwareAfterRestart()) ? 'success' : 'failed' };
    } finally {
      clearTimeout(timer);
    }
  };

  const start = async () => {
    if (status === 'updating') {
      return;
    }
    setStatus('updating');
    setDetail(null);
    const startedAt = Date.now();
    const result = await runUpdate();
    const remaining = FIRMWARE_MIN_DURATION_MS - (Date.now() - startedAt);
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
    setDetail(result.detail || null);
    setStatus(result.status);
  };

  const reset = () => {
    setStatus('idle');
    setDetail(null);
  };

  return { status, detail, start, reset };
}
