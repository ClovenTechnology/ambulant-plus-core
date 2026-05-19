// apps/patient-app/src/devices/parsers.ts
// apps/patient-app/src/devices/parsers.ts
// BLE payload parsers with narrowed, task-aware Linktop support.

export type HRParsed = {
  hr: number;
  contactDetected?: boolean;
  energyExpended?: number | null;
};

export type BPParsed = {
  systolic: number;
  diastolic: number;
  map?: number | null;
  unit: 'mmHg' | 'kPa';
};

export type TempParsed = {
  celsius: number;
  fahrenheit?: number;
};

export type GlucoseParsed = {
  glucose: number;
  unit: 'mg/dL' | 'mmol/L';
};

export type VendorSpo2Parsed = {
  spo2: number;
  pulse?: number | null;
  pi?: number | null;
};

export type VendorBpParsed = {
  systolic: number;
  diastolic: number;
  map?: number | null;
  pulse?: number | null;
  unit: 'mmHg';
};

export type ECGChunk = {
  samples: number[];
  sampleHz: number;
};

export type PPGChunk = {
  samples: number[];
  sampleHz: number;
};

export type LinktopBpCalibrationParsed = {
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  c5: number;
};

export type LinktopBpTempCompParsed = {
  rawD2: number;
};

export type LinktopBpPressureFrame = {
  samples: number[];
  latestPressure: number | null;
  peakPressure: number | null;
  rawMode: 'bytes' | 'uint16';
};

export type LinktopBtFrameParsed = {
  kind: 'factory' | 'report';
  bodyTempC: number | null;
  compTempC: number | null;
  objectTempC: number | null;
  ambientTempC: number | null;
};

// ---- helpers ----
function readUint16LE(dv: DataView, o: number) {
  return dv.getUint16(o, true);
}

function readUint16BE(dv: DataView, o: number) {
  return dv.getUint16(o, false);
}

function readInt16LE(dv: DataView, o: number) {
  return dv.getInt16(o, true);
}

function toU8(dv: DataView): Uint8Array {
  return new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
}

function cToF(c: number) {
  return +(c * 9 / 5 + 32).toFixed(1);
}

function isIntInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

function dedupeViews(views: Uint8Array[]): Uint8Array[] {
  const seen = new Set<string>();
  const out: Uint8Array[] = [];

  for (const v of views) {
    if (!v.length) continue;
    const key = Array.from(v).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }

  return out;
}

function deinterleaveEven(u8: Uint8Array): Uint8Array {
  const out = new Uint8Array(Math.ceil(u8.length / 2));
  let j = 0;
  for (let i = 0; i < u8.length; i += 2) out[j++] = u8[i];
  return out;
}

function deinterleaveOdd(u8: Uint8Array): Uint8Array {
  const out = new Uint8Array(Math.floor(u8.length / 2));
  let j = 0;
  for (let i = 1; i < u8.length; i += 2) out[j++] = u8[i];
  return out;
}

function candidateViews(dv: DataView): Uint8Array[] {
  const raw = toU8(dv);
  return dedupeViews([raw, raw.subarray(1), raw.subarray(2), deinterleaveEven(raw), deinterleaveOdd(raw)]);
}

function asciiNumbers(u8: Uint8Array): number[] {
  try {
    const txt = new TextDecoder()
      .decode(u8)
      .replace(/[^\d.,:/ -]/g, ' ')
      .trim();

    if (!txt) return [];
    const parts = txt.match(/\d+(?:\.\d+)?/g) ?? [];
    return parts.map(Number).filter((n) => Number.isFinite(n));
  } catch {
    return [];
  }
}

// IEEE-11073 SFLOAT (16-bit)
function readSFLOAT(dv: DataView, o: number): number {
  const raw = dv.getUint16(o, true);
  let mantissa = raw & 0x0fff;
  const exp = (raw & 0xf000) >> 12;
  if (mantissa >= 0x0800) mantissa = -((0x0fff + 1) - mantissa);
  const e = exp >= 0x8 ? exp - 16 : exp;
  return mantissa * Math.pow(10, e);
}

// ---------- SIG parsers ----------

// Heart Rate Measurement (0x2A37)
export function parseHRMeasurement(dv: DataView): HRParsed | null {
  if (!dv || dv.byteLength < 2) return null;

  const flags = dv.getUint8(0);
  const hr16 = (flags & 0x01) !== 0;
  let o = 1;

  if (hr16) {
    if (dv.byteLength < o + 2) return null;
  } else {
    if (dv.byteLength < o + 1) return null;
  }

  const hr = hr16 ? readUint16LE(dv, o) : dv.getUint8(o);
  o += hr16 ? 2 : 1;

  const sensorContactSupported = (flags & 0x06) !== 0;
  const sensorContactDetected = (flags & 0x06) === 0x06;

  let energy: number | null = null;
  if (flags & 0x08) {
    if (dv.byteLength < o + 2) return null;
    energy = readUint16LE(dv, o);
  }

  return {
    hr,
    contactDetected: sensorContactSupported ? sensorContactDetected : undefined,
    energyExpended: energy,
  };
}

// Blood Pressure Measurement (0x2A35)
export function parseBPMeasurement(dv: DataView): BPParsed | null {
  if (!dv || dv.byteLength < 7) return null;

  const flags = dv.getUint8(0);
  const unit: 'mmHg' | 'kPa' = (flags & 0x01) ? 'kPa' : 'mmHg';

  let o = 1;
  if (dv.byteLength < o + 6) return null;

  const systolic = readSFLOAT(dv, o);
  o += 2;

  const diastolic = readSFLOAT(dv, o);
  o += 2;

  const map = readSFLOAT(dv, o);

  return { systolic, diastolic, map, unit };
}

// ---------- Native-task-aware Linktop helpers ----------

export function parseLinktopBpCalibrationPayload(
  input: DataView | Uint8Array,
): LinktopBpCalibrationParsed | null {
  const u8v = input instanceof Uint8Array ? input : toU8(input);
  if (u8v.length < 7) return null;
  if ((u8v[0] & 0xff) !== 0x01) return null;

  const c1 = ((u8v[1] & 0xff) << 6) + ((u8v[2] & 0xff) >> 2);
  const c2 = ((u8v[2] & 0x03) << 4) + ((u8v[3] & 0xff) >> 4);
  const c3 = ((u8v[3] & 0x0f) << 9) + ((u8v[4] & 0xff) << 1) + ((u8v[5] & 0xff) >> 7);
  const c4 = ((u8v[5] & 0x7f) << 2) + ((u8v[6] & 0xff) >> 6);
  const c5 = u8v[6] & 0x3f;

  return { c1, c2, c3, c4, c5 };
}

export function parseLinktopBpTempCompPayload(
  input: DataView | Uint8Array,
): LinktopBpTempCompParsed | null {
  const u8v = input instanceof Uint8Array ? input : toU8(input);
  if (u8v.length < 3) return null;
  if ((u8v[0] & 0xff) !== 0x02) return null;

  const rawD2 = (u8v[1] & 0xff) + ((u8v[2] & 0xff) << 8);
  return { rawD2 };
}

export function parseLinktopBpPressurePayload(
  input: DataView | Uint8Array,
): LinktopBpPressureFrame | null {
  const u8v = input instanceof Uint8Array ? input : toU8(input);
  if (u8v.length < 3) return null;
  if ((u8v[0] & 0xff) !== 0x03) return null;

  const body = Array.from(u8v.slice(1));
  if (body.length < 2) return null;

  const firstBytes: number[] = [];
  const secondBytes: number[] = [];

  for (let i = 0; i + 1 < body.length; i += 2) {
    firstBytes.push(body[i] & 0xff);
    secondBytes.push(body[i + 1] & 0xff);
  }

  const uniqueFirst = new Set(firstBytes).size;

  if (uniqueFirst <= 2 && secondBytes.length > 0) {
    const latestPressure = secondBytes[secondBytes.length - 1] ?? null;
    const peakPressure = secondBytes.length ? Math.max(...secondBytes) : null;
    return {
      samples: secondBytes,
      latestPressure,
      peakPressure,
      rawMode: 'bytes',
    };
  }

  const out: number[] = [];
  for (let i = 0; i + 1 < body.length; i += 2) {
    out.push(((body[i] & 0xff) << 8) | (body[i + 1] & 0xff));
  }

  const latestPressure = out[out.length - 1] ?? null;
  const peakPressure = out.length ? Math.max(...out) : null;

  return {
    samples: out,
    latestPressure,
    peakPressure,
    rawMode: 'uint16',
  };
}

export function parseLinktopBtFrame(dv: DataView): LinktopBtFrameParsed | null {
  if (!dv || dv.byteLength < 4) return null;
  const u8v = toU8(dv);

  // Native BtTask normal path: 4x uint16 values across two paired reads, then averaged.
  // On report path it also handles 8-byte structured values.
  if (u8v.length >= 8) {
    const loBody = readUint16LE(dv, 0);
    const hiBody = readUint16LE(dv, 2);
    const loComp = readUint16LE(dv, 4);
    const hiComp = readUint16LE(dv, 6);

    const objectTempC = +(loBody / 100).toFixed(2);
    const ambientTempC = +(hiBody / 100).toFixed(2);
    const bodyTempC = +(loComp / 100).toFixed(2);
    const compTempC = +(hiComp / 100).toFixed(2);

    const plausible =
      objectTempC > 20 &&
      objectTempC < 50 &&
      ambientTempC > 20 &&
      ambientTempC < 50 &&
      bodyTempC > 20 &&
      bodyTempC < 50 &&
      compTempC > 20 &&
      compTempC < 50;

    if (plausible) {
      return {
        kind: 'report',
        bodyTempC,
        compTempC,
        objectTempC,
        ambientTempC,
      };
    }
  }

  if (u8v.length >= 4) {
    const a = readUint16LE(dv, 0);
    const b = readUint16LE(dv, 2);

    const objectTempC = +(a / 100).toFixed(2);
    const ambientTempC = +(b / 100).toFixed(2);

    if (
      objectTempC > 20 &&
      objectTempC < 50 &&
      ambientTempC > 20 &&
      ambientTempC < 50
    ) {
      return {
        kind: 'factory',
        bodyTempC: objectTempC,
        compTempC: ambientTempC,
        objectTempC,
        ambientTempC,
      };
    }
  }

  return null;
}

// ---------- Vendor temp/glucose heuristics ----------

function tryParseVendorTempFromView(u8: Uint8Array): TempParsed | null {
  if (!u8.length) return null;

  const ascii = asciiNumbers(u8);
  if (ascii.length >= 1) {
    const c = ascii[0];
    if (c > 25 && c < 45) {
      return { celsius: c, fahrenheit: cToF(c) };
    }
  }

  if (u8.length >= 2) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

    const le10 = readUint16LE(dv, 0) / 10;
    if (le10 > 25 && le10 < 45) {
      return { celsius: le10, fahrenheit: cToF(le10) };
    }

    const be10 = readUint16BE(dv, 0) / 10;
    if (be10 > 25 && be10 < 45) {
      return { celsius: be10, fahrenheit: cToF(be10) };
    }

    const le100 = readUint16LE(dv, 0) / 100;
    if (le100 > 25 && le100 < 45) {
      return { celsius: le100, fahrenheit: cToF(le100) };
    }

    const be100 = readUint16BE(dv, 0) / 100;
    if (be100 > 25 && be100 < 45) {
      return { celsius: be100, fahrenheit: cToF(be100) };
    }
  }

  for (let i = 0; i + 1 < u8.length; i++) {
    const whole = u8[i];
    const tenths = u8[i + 1];
    if (whole >= 30 && whole <= 45 && tenths >= 0 && tenths <= 9) {
      const c = whole + tenths / 10;
      return { celsius: c, fahrenheit: cToF(c) };
    }
  }

  return null;
}

export function parseLinktopVendorTemp(dv: DataView): TempParsed | null {
  const bt = parseLinktopBtFrame(dv);
  if (bt?.bodyTempC != null) {
    return {
      celsius: bt.bodyTempC,
      fahrenheit: cToF(bt.bodyTempC),
    };
  }

  for (const view of candidateViews(dv)) {
    const parsed = tryParseVendorTempFromView(view);
    if (parsed) return parsed;
  }
  return null;
}

export function parseVendorTemp(dv: DataView): TempParsed | null {
  return parseLinktopVendorTemp(dv);
}

// Vendor glucose (0xFFD1): mg/dL as uint16, or ASCII, or mmol/L float
export function parseVendorGlucose(dv: DataView): GlucoseParsed | null {
  if (!dv || dv.byteLength === 0) return null;

  try {
    const txt = new TextDecoder().decode(toU8(dv)).trim();
    const g = parseFloat(txt);
    if (!Number.isNaN(g)) {
      if (g > 20) return { glucose: g, unit: 'mg/dL' };
      if (g > 1 && g < 35) return { glucose: g, unit: 'mmol/L' };
    }
  } catch {}

  if (dv.byteLength >= 2) {
    const g = readUint16LE(dv, 0);
    if (g >= 20 && g <= 600) return { glucose: g, unit: 'mg/dL' };
  }

  return null;
}

// Narrower scalar SpO2 parser.
// Avoid broad candidate guessing unless payload shape is short/plausible.
export function parseLinktopSpo2Scalar(dv: DataView): VendorSpo2Parsed | null {
  if (!dv || dv.byteLength < 2) return null;
  const u8v = toU8(dv);

  if (u8v.length <= 5) {
    for (let i = 0; i + 1 < u8v.length; i++) {
      const a = u8v[i] & 0xff;
      const b = u8v[i + 1] & 0xff;
      const c = i + 2 < u8v.length ? u8v[i + 2] & 0xff : null;

      if (a >= 70 && a <= 100 && b >= 25 && b <= 240) {
        return {
          spo2: a,
          pulse: b,
          pi: c != null && c <= 200 ? +(c / 10).toFixed(1) : null,
        };
      }

      if (b >= 70 && b <= 100 && a >= 25 && a <= 240) {
        return {
          spo2: b,
          pulse: a,
          pi: c != null && c <= 200 ? +(c / 10).toFixed(1) : null,
        };
      }
    }
  }

  const ascii = asciiNumbers(u8v);
  if (ascii.length >= 2) {
    const [a, b, c] = ascii;
    if (a >= 70 && a <= 100 && b >= 25 && b <= 240) {
      return {
        spo2: Math.round(a),
        pulse: Math.round(b),
        pi: typeof c === 'number' && c >= 0 && c <= 50 ? c : null,
      };
    }
  }

  return null;
}

function tryParseVendorSpo2FromView(u8: Uint8Array): VendorSpo2Parsed | null {
  if (!u8.length || u8.length > 8) return null;

  const ascii = asciiNumbers(u8);
  if (ascii.length >= 2) {
    const [a, b, c] = ascii;
    if (a >= 70 && a <= 100 && b >= 25 && b <= 240) {
      return {
        spo2: Math.round(a),
        pulse: Math.round(b),
        pi: typeof c === 'number' && c >= 0 && c <= 50 ? c : null,
      };
    }
  }

  for (let i = 0; i + 1 < u8.length; i++) {
    const a = u8[i] & 0xff;
    const b = u8[i + 1] & 0xff;
    const c = i + 2 < u8.length ? u8[i + 2] & 0xff : null;

    if (a >= 70 && a <= 100 && b >= 25 && b <= 240) {
      return {
        spo2: a,
        pulse: b,
        pi: c != null && c <= 200 ? +(c / 10).toFixed(1) : null,
      };
    }
  }

  return null;
}

export function parseLinktopVendorSpo2(dv: DataView): VendorSpo2Parsed | null {
  const strict = parseLinktopSpo2Scalar(dv);
  if (strict) return strict;

  for (const view of candidateViews(dv)) {
    const parsed = tryParseVendorSpo2FromView(view);
    if (parsed) return parsed;
  }
  return null;
}

function tryParseVendorBpFromView(u8: Uint8Array): VendorBpParsed | null {
  if (!u8.length || u8.length > 12) return null;

  const ascii = asciiNumbers(u8);
  if (ascii.length >= 2) {
    const [sys, dia, pulse, map] = ascii;
    if (sys >= 70 && sys <= 250 && dia >= 40 && dia <= 150 && sys > dia + 5) {
      return {
        systolic: Math.round(sys),
        diastolic: Math.round(dia),
        pulse: typeof pulse === 'number' && pulse >= 25 && pulse <= 240 ? Math.round(pulse) : null,
        map: typeof map === 'number' && map >= 40 && map <= 180 ? Math.round(map) : null,
        unit: 'mmHg',
      };
    }
  }

  for (let i = 0; i + 2 < u8.length; i++) {
    const a = u8[i] & 0xff;
    const b = u8[i + 1] & 0xff;
    const c = u8[i + 2] & 0xff;
    const d = i + 3 < u8.length ? u8[i + 3] & 0xff : null;

    if (
      a >= 70 &&
      a <= 250 &&
      b >= 40 &&
      b <= 150 &&
      a > b + 5 &&
      c >= 25 &&
      c <= 240
    ) {
      return {
        systolic: a,
        diastolic: b,
        pulse: c,
        map: d != null && d >= 40 && d <= 180 ? d : null,
        unit: 'mmHg',
      };
    }
  }

  return null;
}

export function parseLinktopVendorBp(dv: DataView): VendorBpParsed | null {
  for (const view of candidateViews(dv)) {
    const parsed = tryParseVendorBpFromView(view);
    if (parsed) return parsed;
  }
  return null;
}

// ---------- ECG/PPG waveform helpers ----------

function signExtend12(n: number): number {
  return (n & 0x800) ? (n - 0x1000) : n;
}

function unpack12BitSigned_LE(u8: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i + 2 < u8.length; i += 3) {
    const b0 = u8[i];
    const b1 = u8[i + 1];
    const b2 = u8[i + 2];
    const s0 = signExtend12(b0 | ((b1 & 0x0f) << 8));
    const s1 = signExtend12((b1 >> 4) | (b2 << 4));
    out.push(s0, s1);
  }
  return out;
}

function unpack12BitUnsigned_LE(u8: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i + 2 < u8.length; i += 3) {
    const b0 = u8[i];
    const b1 = u8[i + 1];
    const b2 = u8[i + 2];
    const s0 = (b0 | ((b1 & 0x0f) << 8)) & 0x0fff;
    const s1 = ((b1 >> 4) | (b2 << 4)) & 0x0fff;
    out.push(s0, s1);
  }
  return out;
}

// Native ECG task config uses NeuroSky ECG sample rate mapping type=6, rate=3 => 512Hz.
export function parseECGWave_int16LE(dv: DataView, sampleHz = 512): ECGChunk | null {
  if (!dv || dv.byteLength < 2 || dv.byteLength % 2 !== 0) return null;

  const arr: number[] = [];
  for (let o = 0; o + 1 < dv.byteLength; o += 2) {
    arr.push(readInt16LE(dv, o));
  }

  return { samples: arr, sampleHz };
}

// Native SPO2 task defaults to 125Hz in the standard OxTask path.
export function parsePPGWave_uint16LE(dv: DataView, sampleHz = 125): PPGChunk | null {
  if (!dv || dv.byteLength < 2 || dv.byteLength % 2 !== 0) return null;

  const arr: number[] = [];
  for (let o = 0; o + 1 < dv.byteLength; o += 2) {
    arr.push(readUint16LE(dv, o));
  }

  return { samples: arr, sampleHz };
}

export function autodetectECGorPPG(
  payload: DataView,
): { kind: 'ecg' | 'ppg'; chunk: ECGChunk | PPGChunk } | null {
  if (!payload || payload.byteLength < 2) return null;

  const u8v = toU8(payload);

  if ((u8v.length % 2) === 0) {
    const ecg16 = parseECGWave_int16LE(payload, 512);
    const ppg16 = parsePPGWave_uint16LE(payload, 125);

    const ecgNegs = ecg16?.samples?.filter((s) => s < 0).length ?? 0;
    const ppgMean = ppg16?.samples?.reduce((a, b) => a + b, 0) ?? 0;
    const ppgAvg = ppg16?.samples?.length ? ppgMean / ppg16.samples.length : 0;

    if (ecg16 && ecgNegs > ecg16.samples.length * 0.1) {
      return { kind: 'ecg', chunk: ecg16 };
    }

    if (ppg16 && ppgAvg > 50) {
      return { kind: 'ppg', chunk: ppg16 };
    }

    if (ecg16) return { kind: 'ecg', chunk: ecg16 };
    if (ppg16) return { kind: 'ppg', chunk: ppg16 };
    return null;
  }

  if ((u8v.length % 3) === 0) {
    const signed = unpack12BitSigned_LE(u8v);
    const unsigned = unpack12BitUnsigned_LE(u8v);
    const negs = signed.filter((v) => v < 0).length;

    if (negs > signed.length * 0.1) {
      return { kind: 'ecg', chunk: { samples: signed, sampleHz: 512 } };
    }

    return { kind: 'ppg', chunk: { samples: unsigned, sampleHz: 125 } };
  }

  return null;
}

export function parseECGWave(dv: DataView): ECGChunk | null {
  const res = autodetectECGorPPG(dv);
  return res && res.kind === 'ecg' ? (res.chunk as ECGChunk) : null;
}

export function parsePPGWave(dv: DataView): PPGChunk | null {
  const res = autodetectECGorPPG(dv);
  return res && res.kind === 'ppg' ? (res.chunk as PPGChunk) : null;
}