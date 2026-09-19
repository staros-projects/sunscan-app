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

  const onScanline = useCallback((message) => {
    const values = message[1].split(',').map(Number);
    if (!values.length || values.some((v) => !Number.isFinite(v))) return;

    const columns = columnsRef.current;
    if (columns.length && columns[0].length !== values.length) return;
    columns.push(values);

    let max = 0;
    let min = Infinity;
    for (let i = 0; i < values.length; i += 1) {
      if (values[i] > max) max = values[i];
      if (values[i] < min) min = values[i];
    }
    peakRef.current = Math.max(peakRef.current, max);
    floorRef.current = Math.min(floorRef.current, min);

    render();
  }, [render]);

  useEffect(() => {
    if (!recording) return undefined;

    columnsRef.current = [];
    startedAtRef.current = Date.now();
    peakRef.current = 0;
    floorRef.current = Infinity;
    setUri(null);

    subscribe('scanline', onScanline);
    return () => unsubscribe('scanline', onScanline);
  }, [recording, subscribe, unsubscribe, onScanline]);

  return { uri };
}
