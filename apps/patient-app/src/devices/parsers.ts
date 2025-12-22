// apps/patient-app/src/devices/parsers.ts
// BLE payload parsers (Bluetooth SIG + pragmatic vendor heuristics)

export type HRParsed = { hr: number; contactDetected?: boolean; energyExpended?: number | null };
export type BPParsed = { systolic: number; diastolic: number; map?: number | null; unit: 'mmHg' | 'kPa' };
export type TempParsed = { celsius: number; fahrenheit?: number };
export type GlucoseParsed = { glucose: number; unit: 'mg/dL' | 'mmol/L' };
export type ECGChunk = { samples: number[]; sampleHz: number };    // 250Hz expected default
export type PPGChunk = { samples: number[]; sampleHz: number };    // ~25Hz expected default

// ---- helpers ----
function readUint16LE(dv: DataView, o: number) { return dv.getUint16(o, true); }
function readInt16LE(dv: DataView, o: number) { return dv.getInt16(o, true); }
function readFloat32LE(dv: DataView, o: number) { return dv.getFloat32(o, true); }

// IEEE-11073 SFLOAT (16-bit)
function readSFLOAT(dv: DataView, o: number): number {
  const raw = dv.getUint16(o, true);
  let mantissa = raw & 0x0FFF;
  const exp = (raw & 0xF000) >> 12;
  if (mantissa >= 0x0800) mantissa = -((0x0FFF + 1) - mantissa); // 12-bit signed
  const e = exp >= 0x8 ? exp - 16 : exp; // 4-bit signed
  return mantissa * Math.pow(10, e);
}

// ---------- SIG parsers ----------

// Heart Rate Measurement (0x2A37)
export function parseHRMeasurement(dv: DataView): HRParsed | null {
  if (!dv || dv.byteLength === 0) return null;
  const flags = dv.getUint8(0);
  const hr16 = (flags & 0x01) !== 0;
  let o = 1;
  const hr = hr16 ? readUint16LE(dv, o) : dv.getUint8(o); o += hr16 ? 2 : 1;

  const sensorContactSupported = (flags & 0x06) !== 0;
  const sensorContactDetected = (flags & 0x06) === 0x06;

  let energy: number | null = null;
  if (flags & 0x08) { energy = readUint16LE(dv, o); o += 2; }

  return { hr, contactDetected: sensorContactSupported ? sensorContactDetected : undefined, energyExpended: energy };
}

// Blood Pressure Measurement (0x2A35)
export function parseBPMeasurement(dv: DataView): BPParsed | null {
  if (!dv || dv.byteLength < 7) return null;
  const flags = dv.getUint8(0);
  const unit: 'mmHg' | 'kPa' = (flags & 0x01) ? 'kPa' : 'mmHg';
  let o = 1;
  const systolic = readSFLOAT(dv, o); o += 2;
  const diastolic = readSFLOAT(dv, o); o += 2;
  const map = readSFLOAT(dv, o); o += 2;
  return { systolic, diastolic, map, unit };
}

// ---------- Vendor temp/glucose heuristics ----------

// Vendor temp (0xFFE1): devices vary → try common encodings
export function parseVendorTemp(dv: DataView): TempParsed | null {
  if (!dv || dv.byteLength === 0) return null;

  // Heuristic 1: ASCII like "36.8"
  try {
    const txt = new TextDecoder().decode(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength)).trim();
    const c = parseFloat(txt);
    if (!Number.isNaN(c) && c > 25 && c < 45) {
      return { celsius: c, fahrenheit: +(c * 9/5 + 32).toFixed(1) };
    }
  } catch {}

  // Heuristic 2: uint16 tenths (e.g., 368 → 36.8)
  if (dv.byteLength >= 2) {
    const v = readUint16LE(dv, 0);
    const c = v / 10;
    if (c > 25 && c < 45) return { celsius: c, fahrenheit: +(c * 9/5 + 32).toFixed(1) };
  }

  // Heuristic 3: float32 little-endian
  if (dv.byteLength >= 4) {
    const c = readFloat32LE(dv, 0);
    if (c > 25 && c < 45) return { celsius: c, fahrenheit: +(c * 9/5 + 32).toFixed(1) };
  }
  return null;
}

// Vendor glucose (0xFFD1): mg/dL as uint16, or ASCII, or mmol/L float
export function parseVendorGlucose(dv: DataView): GlucoseParsed | null {
  if (!dv || dv.byteLength === 0) return null;

  // ASCII "106" or "5.9"
  try {
    const txt = new TextDecoder().decode(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength)).trim();
    const g = parseFloat(txt);
    if (!Number.isNaN(g)) {
      if (g > 20) return { glucose: g, unit: 'mg/dL' };
      if (g > 1 && g < 35) return { glucose: g, unit: 'mmol/L' };
    }
  } catch {}

  // uint16 mg/dL
  if (dv.byteLength >= 2) {
    const g = readUint16LE(dv, 0);
    if (g >= 20 && g <= 600) return { glucose: g, unit: 'mg/dL' };
  }
  return null;
}

// ---------- ECG/PPG waveform helpers ----------

// 12-bit unpack helpers
function signExtend12(n: number): number {
  // for signed 12-bit: values 0..4095, negative if bit 11 set
  return (n & 0x800) ? (n - 0x1000) : n;
}

function unpack12BitSigned_LE(u8: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i + 2 < u8.length; i += 3) {
    const b0 = u8[i], b1 = u8[i+1], b2 = u8[i+2];
    const s0 = signExtend12(b0 | ((b1 & 0x0F) << 8));
    const s1 = signExtend12((b1 >> 4) | (b2 << 4));
    out.push(s0, s1);
  }
  return out;
}

function unpack12BitUnsigned_LE(u8: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i + 2 < u8.length; i += 3) {
    const b0 = u8[i], b1 = u8[i+1], b2 = u8[i+2];
    const s0 = (b0 | ((b1 & 0x0F) << 8)) & 0x0FFF;
    const s1 = ((b1 >> 4) | (b2 << 4)) & 0x0FFF;
    out.push(s0, s1);
  }
  return out;
}

// Plain 16-bit parsers
export function parseECGWave_int16LE(dv: DataView, sampleHz = 250): ECGChunk | null {
  if (!dv || dv.byteLength < 2 || dv.byteLength % 2 !== 0) return null;
  const arr: number[] = [];
  for (let o = 0; o + 1 < dv.byteLength; o += 2) arr.push(readInt16LE(dv, o));
  return { samples: arr, sampleHz };
}

export function parsePPGWave_uint16LE(dv: DataView, sampleHz = 25): PPGChunk | null {
  if (!dv || dv.byteLength < 2 || dv.byteLength % 2 !== 0) return null;
  const arr: number[] = [];
  for (let o = 0; o + 1 < dv.byteLength; o += 2) arr.push(readUint16LE(dv, o));
  return { samples: arr, sampleHz };
}

// Auto-detect 12-bit vs 16-bit + ECG vs PPG (heuristic)
export function autodetectECGorPPG(payload: DataView): { kind: 'ecg' | 'ppg'; chunk: ECGChunk | PPGChunk } | null {
  if (!payload || payload.byteLength < 2) return null;
  const u8 = new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);

  // Case A: even length → try 16-bit paths
  if ((u8.length % 2) === 0) {
    const ecg16 = parseECGWave_int16LE(payload, 250);
    const ppg16 = parsePPGWave_uint16LE(payload, 25);

    // Heuristic: ECG tends to have significant negative samples; PPG is non-negative
    const negs = ecg16?.samples?.filter(s => s < 0).length ?? 0;
    const nonNegs = ppg16?.samples?.filter(s => s >= 0).length ?? 0;

    if ((ecg16 && negs > (ecg16.samples.length * 0.2))) return { kind: 'ecg', chunk: ecg16 };
    if (ppg16 && nonNegs === ppg16.samples.length) return { kind: 'ppg', chunk: ppg16 };

    // Fallback: prefer ECG if values look centered near zero
    if (ecg16) return { kind: 'ecg', chunk: ecg16 };
    if (ppg16) return { kind: 'ppg', chunk: ppg16 };
    return null;
  }

  // Case B: divisible by 3 → likely 12-bit packed
  if ((u8.length % 3) === 0) {
    // Try ECG 12-bit signed
    const sSigned = unpack12BitSigned_LE(u8);
    // Center of mass heuristic
    const mean = sSigned.reduce((a, b) => a + b, 0) / (sSigned.length || 1);
    const negs = sSigned.filter(v => v < 0).length;

    // Try PPG 12-bit unsigned
    const sUnsigned = unpack12BitUnsigned_LE(u8);
    const hasNegUnsigned = sUnsigned.some(v => v < 0);
    const allNonNegUnsigned = !hasNegUnsigned;

    // Choose based on sign + distribution
    if (negs > sSigned.length * 0.2 && Math.abs(mean) < 500) {
      return { kind: 'ecg', chunk: { samples: sSigned, sampleHz: 250 } };
    }
    if (allNonNegUnsigned) {
      return { kind: 'ppg', chunk: { samples: sUnsigned, sampleHz: 25 } };
    }
    // Fallback bias to ECG
    return { kind: 'ecg', chunk: { samples: sSigned, sampleHz: 250 } };
  }

  // Unknown packing; bail
  return null;
}

// Convenience wrappers (kept for compatibility)
export function parseECGWave(dv: DataView): ECGChunk | null {
  const res = autodetectECGorPPG(dv);
  return (res && res.kind === 'ecg') ? (res.chunk as ECGChunk) : null;
}

export function parsePPGWave(dv: DataView): PPGChunk | null {
  const res = autodetectECGorPPG(dv);
  return (res && res.kind === 'ppg') ? (res.chunk as PPGChunk) : null;
}
