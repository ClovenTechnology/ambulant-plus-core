// apps/patient-app/src/devices/decoders/ecg.ts
export type EcgDecoded = {
  timestamp: string;
  durationSec?: number;
  rhr?: number;        // resting HR derived
  hrv?: number | null; // optional
  rawSummary?: any;    // vendor summary fields
  waveform?: Int16Array | Uint16Array | null; // optional small chunk (not entire continuous stream)
  meta?: any;
  raw: Uint8Array;
};

/**
 * decodeEcgPacket
 * - If packet contains summary (done measurement), parse key metrics
 * - If packet contains waveform chunk, return waveform field (client should forward to server)
 *
 * Replace VENDOR PARSE HOOK with vendor's exact parsing logic.
 */
export function decodeEcgPacket(bytes: ArrayBuffer | DataView | Uint8Array): EcgDecoded | null {
  let u8: Uint8Array;
  if (bytes instanceof Uint8Array) u8 = bytes;
  else if (bytes instanceof DataView) u8 = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  else u8 = new Uint8Array(bytes);

  const now = new Date().toISOString();
  const raw = u8;
  try {
    // Vendor patterns vary widely. Defensive checks:

    // If packet size is large and even -> likely waveform Int16 LE samples
    if (u8.length >= 200 && (u8.length % 2 === 0)) {
      const samples = new Int16Array(u8.buffer, u8.byteOffset, u8.byteLength / 2);
      return { timestamp: now, waveform: samples, raw };
    }

    // If small packet with fields: [hdr, type, rhr, dur_s, hrv_lo, hrv_hi ...]
    if (u8.length >= 5) {
      const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      // Heuristic: rhr at offset 2, duration at 3
      const rhr = dv.getUint8(2);
      const duration = dv.getUint8(3);
      if (rhr > 20 && rhr < 220) {
        return { timestamp: now, rhr, durationSec: duration, raw };
      }
    }

    // No parse
    return null;
  } catch (e) {
    console.warn('decodeEcgPacket error', e);
    return null;
  }
}


/*
Vendor SDK likely has precise framing & compression. Replace once available.
*/
