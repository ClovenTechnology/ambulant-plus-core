// apps/patient-app/src/devices/decoders/spo2Decoder.ts

export type SpO2Parsed = {
  spo2: number;
  pulse?: number;
  perfIndex?: number;
  timestamp?: string;
  raw: Uint8Array;
};

function toUint8Array(buf: DataView | Uint8Array): Uint8Array {
  if (buf instanceof DataView) {
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  return buf;
}

function isPlausibleSpO2(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 100;
}

function normalisePulse(value: number): number | undefined {
  if (!Number.isFinite(value) || value <= 0 || value > 250) {
    return undefined;
  }

  return value;
}

function normalisePerfIndex(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return value;
}

/**
 * parseSpO2Char
 *
 * Parses compact vendor SpO2 notifications.
 *
 * Supported heuristics:
 * - direct layout: [0] spo2, [1] pulse
 * - flagged/header layout: [0] header/flags, [1] spo2, [2] pulse
 * - optional perfusion index at [3]
 */
export function parseSpO2Char(buf: DataView | Uint8Array): SpO2Parsed | null {
  const u8 = toUint8Array(buf);

  if (u8.length < 2) {
    return null;
  }

  let spo2 = u8[0];
  let pulse: number | undefined = u8[1];

  if (u8[0] > 200 && u8.length >= 3) {
    spo2 = u8[1];
    pulse = u8[2];
  }

  if (!isPlausibleSpO2(spo2)) {
    return null;
  }

  pulse = normalisePulse(pulse);

  const perfIndex = normalisePerfIndex(u8.length >= 4 ? u8[3] : undefined);

  return {
    spo2,
    pulse,
    perfIndex,
    timestamp: new Date().toISOString(),
    raw: u8,
  };
}