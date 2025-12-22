// apps/patient-app/src/devices/decoders/spo2Decoder.ts
export type SpO2Parsed = {
  spo2: number;    // percent
  pulse?: number;  // bpm
  perfIndex?: number;
  timestamp?: string;
  raw: Uint8Array;
};

/**
 * Example vendor spO2 characteristic layout (based on demo):
 * Many vendors send a small spot notify with:
 * [0] header/seq
 * [1] spo2 value (uint8)
 * [2] pulse (uint8)
 * [3] perf index (uint8 or uint16)
 *
 * Another pattern: first byte flags -> data positions shift. We implement both heuristics.
 */
export function parseSpO2Char(buf: DataView | Uint8Array): SpO2Parsed | null {
  let u8: Uint8Array;
  if (buf instanceof DataView) {
    u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } else u8 = buf;

  if (u8.length < 2) return null;

  // heuristic #1: direct [0]=spo2, [1]=pulse
  let spo2 = u8[0];
  let pulse = u8[1];

  // If first byte looks like flags (e.g. >250) try second byte as spo2
  if (u8[0] > 200 && u8.length >= 3) {
    spo2 = u8[1];
    pulse = u8[2];
  }

  if (spo2 <= 0 || spo2 > 100) return null;
  if (pulse <= 0 || pulse > 250) pulse = undefined;

  let perfIndex: number | undefined;
  if (u8.length >= 4) {
    perfIndex = u8[3];
    if (perfIndex === 0) perfIndex = undefined;
  }

  return {
    spo2,
    pulse,
    perfIndex,
    timestamp: new Date().toISOString(),
    raw: u8,
  };
}
