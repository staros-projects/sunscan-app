// Live, very rough reconstruction of the disk while a scan is recording.
//
// The backend pushes, with every preview frame, the core of the darkest line
// along the slit (`scanline` message, one value per bin along the slit). Laid
// side by side in arrival order, those rows are the spectroheliogram being
// built : nothing more than what the real processing does, minus the
// geometric corrections and at a few frames per second instead of the full
// camera rate. Good enough to see the disk come in and leave.

import { useCallback, useContext, useEffect, useRef, useState } from 'react';

import WebSocketContext from './WSContext';

// Columns reserved before the scan duration is known
const DEFAULT_CAPACITY = 240;

// Rebuilding the preview means re-encoding the whole image : a BMP of
// width x height bytes, then a base64 string a third larger again. The backend
// pushes scanlines several times a second, and doing that work on every one of
// them is the single heaviest thing the app does while recording. Twice a
// second is plenty to watch a disk drift across in minutes. Raise it for a
// smoother preview, at a cost paid during the one operation that must not
// stutter.
const RENDER_INTERVAL_MS = 500;

// Runaway guard, not a normal limit : a usual scan is a few hundred columns.
// Past this the preview stops taking new ones rather than grow without end.
const MAX_COLUMNS = 4000;

/**
 * Builds an 8-bit grayscale BMP (bottom-up, 256-entry palette).
 * `pixels` is row-major, top row first.
 */
function encodeGrayBmp(pixels, width, height) {
  const rowSize = (width + 3) & ~3;
  const paletteSize = 256 * 4;
  const dataOffset = 54 + paletteSize;
  const fileSize = dataOffset + rowSize * height;
  const bytes = new Uint8Array(fileSize);
  const view = new DataView(bytes.buffer);

  bytes[0] = 0x42; // B
  bytes[1] = 0x4d; // M
  view.setUint32(2, fileSize, true);
  view.setUint32(10, dataOffset, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 8, true);
  view.setUint32(34, rowSize * height, true);
  view.setUint32(46, 256, true);

  for (let i = 0; i < 256; i += 1) {
    const p = 54 + i * 4;
    bytes[p] = i;
    bytes[p + 1] = i;
    bytes[p + 2] = i;
  }

  for (let y = 0; y < height; y += 1) {
    const src = y * width;
    const dst = dataOffset + (height - 1 - y) * rowSize;
    bytes.set(pixels.subarray(src, src + width), dst);
  }
  return bytes;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function toBase64(bytes) {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += `${B64[(n >> 18) & 63]}${B64[(n >> 12) & 63]}==`;
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += `${B64[(n >> 18) & 63]}${B64[(n >> 12) & 63]}${B64[(n >> 6) & 63]}=`;
  }
  return out;
}

/**
 * @param recording      true while the scan runs : the preview resets on start
 * @param scanDurationS  ephemeris estimate of the crossing, to size the image
 *                       so the disk fills it rather than being squeezed
 */
export default function useScanPreview({ recording, scanDurationS }) {
  const [subscribe, unsubscribe] = useContext(WebSocketContext);
  const [uri, setUri] = useState(null);

  const columnsRef = useRef([]);
  const startedAtRef = useRef(0);
  const peakRef = useRef(0);
  const floorRef = useRef(Infinity);
  const durationRef = useRef(scanDurationS);
  useEffect(() => { durationRef.current = scanDurationS; }, [scanDurationS]);
  // Throttling of the rebuild, see scheduleRender
  const lastRenderRef = useRef(0);
  const pendingRef = useRef(null);

  const render = useCallback(() => {
    const columns = columnsRef.current;
    if (!columns.length) return;
    const height = columns[0].length;

    // Sized on the expected number of columns once the arrival rate is known,
    // so the image fills up from the left instead of being stretched.
    let capacity = DEFAULT_CAPACITY;
    const elapsed = (Date.now() - startedAtRef.current) / 1000;
    if (Number.isFinite(durationRef.current) && elapsed > 3) {
      capacity = Math.round((columns.length / elapsed) * durationRef.current);
    }
    const width = Math.max(columns.length, capacity, 1);

    const peak = peakRef.current;
    const floor = Math.min(floorRef.current, peak);
    const span = Math.max(1, peak - floor);
    const pixels = new Uint8Array(width * height);
    for (let x = 0; x < columns.length; x += 1) {
      const column = columns[x];
      for (let y = 0; y < height; y += 1) {
        const v = (column[y] - floor) / span;
        // Slight gamma so the limb darkening does not swallow the edge
        pixels[y * width + x] = v <= 0 ? 0 : v >= 1 ? 255 : Math.round(255 * Math.sqrt(v));
      }
    }
    setUri(`data:image/bmp;base64,${toBase64(encodeGrayBmp(pixels, width, height))}`);
  }, []);

  // Renders at most every RENDER_INTERVAL_MS, and always renders the last
  // scanline : a trailing timer, so the preview ends on the whole image rather
  // than on whatever the last tick happened to catch.
  const scheduleRender = useCallback(() => {
    const now = Date.now();
    const due = lastRenderRef.current + RENDER_INTERVAL_MS;
    if (now >= due) {
      lastRenderRef.current = now;
      render();
      return;
    }
    if (pendingRef.current == null) {
      pendingRef.current = setTimeout(() => {
        pendingRef.current = null;
        lastRenderRef.current = Date.now();
        render();
      }, due - now);
    }
  }, [render]);

  const onScanline = useCallback((message) => {
    // Parsed straight into a Float32Array : one pass instead of three, and the
    // column is 4 bytes a bin rather than a JS array of boxed doubles, which is
    // what an entire scan of them is kept in.
    const parts = message[1].split(',');
    if (!parts.length) return;
    const values = new Float32Array(parts.length);
    let max = 0;
    let min = Infinity;
    for (let i = 0; i < parts.length; i += 1) {
      const v = Number(parts[i]);
      if (!Number.isFinite(v)) return; // a bad sample discards the column
      values[i] = v;
      if (v > max) max = v;
      if (v < min) min = v;
    }

    const columns = columnsRef.current;
    if (columns.length && columns[0].length !== values.length) return;
    if (columns.length >= MAX_COLUMNS) return;
    columns.push(values);

    peakRef.current = Math.max(peakRef.current, max);
    floorRef.current = Math.min(floorRef.current, min);

    scheduleRender();
  }, [scheduleRender]);

  useEffect(() => {
    if (!recording) return undefined;

    columnsRef.current = [];
    startedAtRef.current = Date.now();
    peakRef.current = 0;
    floorRef.current = Infinity;
    lastRenderRef.current = 0; // the first scanline draws straight away
    setUri(null);

    subscribe('scanline', onScanline);
    return () => {
      unsubscribe('scanline', onScanline);
      // A rebuild was owed when the scan stopped : run it now rather than on a
      // timer, so the preview is left showing every column that arrived, and
      // nothing fires afterwards.
      if (pendingRef.current != null) {
        clearTimeout(pendingRef.current);
        pendingRef.current = null;
        render();
      }
    };
  }, [recording, subscribe, unsubscribe, onScanline, render]);

  return { uri };
}
