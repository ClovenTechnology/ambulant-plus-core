// apps/patient-app/src/devices/decoders/glucoseDecoder.ts
export type GlucoseParsed = {
  glucose: number;
  unit: 'mg/dl' | 'mmol/l';
  stripCode?: string;
  testType?: string;
  timestamp?: string; // ISO if available
  raw: Uint8Array;
};

/**
 * Typical vendor spot-read glucose layout (example derived from Linktop demo):
 * [0]  start marker / header
 * [1]  command/type
 * [2]  unit flag (0 = mg/dL, 1 = mmol/L)
 * [3..4]  glucose raw (uint16 little-endian) or BCD
 * [5]  strip code (if encoded as byte), else ascii block follows
 *
 * This is a defensive parser: checks lengths and plausible ranges.
 */
export function parseGlucoseChar(buf: DataView | Uint8Array): GlucoseParsed | null {
  let u8: Uint8Array;
  if (buf instanceof DataView) {
    u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } else {
    u8 = buf;
  }
  if (u8.length < 4) return null;

  // Heuristics from SDK/demo: unit at byte 2, value at 3..4 LE
  const unitFlag = u8[2];
  const unit = unitFlag === 1 ? 'mmol/l' : 'mg/dl';

  // grab 16-bit value little-endian (safe guard)
  const valLE = (u8[3] | (u8[4] << 8)) >>> 0;

  // If unit is mmol/l the value might be scaled (e.g. 4.5 -> 45 encoded) — try to detect.
  let glucose = valLE;
  if (unit === 'mmol/l') {
    // many vendors encode as integer with one decimal: 45 -> 4.5.
    // prefer float with one decimal if > 30
    glucose = +( (valLE / 10).toFixed(1) );
  } else {
    // mg/dL directly
    glucose = valLE;
  }

  // plausible range check
  if (unit === 'mg/dl' && (glucose < 10 || glucose > 1000)) return null;
  if (unit === 'mmol/l' && (glucose < 0.5 || glucose > 55)) return null;

  // optional strip code as ascii after byte 5
  let strip: string | undefined;
  if (u8.length > 5) {
    try {
      const tail = u8.slice(5);
      // if ascii letters/digits
      const ascii = String.fromCharCode(...tail).replace(/\0/g, '').trim();
      if (/^[A-Za-z0-9\-]+$/.test(ascii)) strip = ascii;
    } catch {}
  }

  return {
    glucose,
    unit,
    stripCode: strip,
    testType: undefined,
    timestamp: new Date().toISOString(),
    raw: u8,
  };
}
