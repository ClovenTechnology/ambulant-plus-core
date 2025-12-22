// apps/patient-app/src/devices/decoders/glucose.ts
// Heuristic glucose decoder. Replace `decodeGlucosePacket` with exact logic
// from vendor Communicate/Protocol when available.

export type GlucoseDecoded = {
  timestamp: string; // ISO
  glucose: number;   // numeric in canonical unit below
  unit: 'mg/dl' | 'mmol/l';
  stripCode?: string;
  testType?: string;
  fasting?: boolean;
  raw: Uint8Array;
};

/**
 * decodeGlucosePacket
 * - bytes may be ArrayBuffer | DataView | Uint8Array
 * - returns null if packet doesn't decode or is implausible
 *
 * NOTE: Many vendors encode glucose as:
 *  - byte[0]: header/marker
 *  - byte[1]: type/cmd
 *  - byte[2]: unit flag (0=mg/dL,1=mmol/L)
 *  - bytes[3..4]: value LE (16-bit) maybe scaled by 10
 *  - bytes[5..]: optional ascii strip code
 *
 * Replace the VENDOR_PARSE block with exact code from the SDK comunicate parser
 * if/when you extract it from the AAR.
 */
export function decodeGlucosePacket(bytes: ArrayBuffer | DataView | Uint8Array): GlucoseDecoded | null {
  let u8: Uint8Array;
  if (bytes instanceof Uint8Array) u8 = bytes;
  else if (bytes instanceof DataView) u8 = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  else u8 = new Uint8Array(bytes);

  const now = new Date().toISOString();
  const raw = u8;

  // Minimum length safety
  if (u8.length < 3) return null;

  // --- VENDOR PARSE HOOK ---
  // If you have exact Java parsing logic, port it here and return the precise fields.
  // For now we use a deterministic, validated decode with clear heuristics.

  try {
    // heuristic: unit at index 2 if plausible
    let unit: 'mg/dl' | 'mmol/l' = 'mg/dl';
    if (u8.length > 2 && (u8[2] === 0 || u8[2] === 1)) unit = u8[2] === 1 ? 'mmol/l' : 'mg/dl';

    // get value candidate from bytes 3..4 or 0..1
    const getU16LE = (off: number) => (u8[off] || 0) | ((u8[off + 1] || 0) << 8);
    const candOffsets = [3, 0, 1];
    let rawVal: number | null = null;
    for (const off of candOffsets) {
      if (off + 1 < u8.length) {
        const v = getU16LE(off);
        if (v > 0 && v < 2000) { rawVal = v; break; }
      }
    }
    if (rawVal === null) return null;

    // interpret rawVal according to unit heuristics:
    // many devices encode mmol*10 (e.g. 45 -> 4.5), many encode mg/dl directly
    let glucose: number;
    if (unit === 'mmol/l') {
      // if rawVal looks > 30 it's probably mg/dL mis-detected
      if (rawVal > 30) {
        // fallback: treat as mg/dL then convert
        glucose = +(rawVal / 18).toFixed(1);
        unit = 'mmol/l';
      } else {
        // likely encoded as (mmol*10) or direct mmol
        glucose = rawVal > 20 ? +(rawVal / 10).toFixed(1) : +(rawVal).toFixed(1);
      }
    } else {
      // mg/dL expected
      if (rawVal < 30) {
        // maybe device encodes mmol*10, convert to mg/dL
        glucose = Math.round((rawVal * 10) * 18);
        unit = 'mg/dl';
      } else {
        glucose = rawVal;
      }
    }

    // plausibility checks
    if (unit === 'mg/dl' && (glucose < 10 || glucose > 2000)) return null;
    if (unit === 'mmol/l' && (glucose < 0.5 || glucose > 200)) return null;

    // optional strip code ascii tail
    let strip: string | undefined;
    if (u8.length > 5) {
      try {
        const tail = u8.slice(5);
        const ascii = String.fromCharCode(...tail).replace(/\0/g, '').trim();
        if (/^[A-Za-z0-9\-\_]+$/.test(ascii)) strip = ascii;
      } catch {}
    }

    return {
      timestamp: now,
      glucose: +(unit === 'mg/dl' ? glucose : +(glucose).toFixed(1)),
      unit: unit === 'mg/dl' ? 'mg/dl' : 'mmol/l',
      stripCode: strip,
      raw
    };
  } catch (e) {
    console.warn('decodeGlucosePacket error', e);
    return null;
  }
}


/*
HOW TO REPLACE: When you provide the vendor Java decode method (Communicate.packageParse),
port its parsing branch that handles glucose (usually based on characteristic UUID 0000ffd1...) into this function.
*/
