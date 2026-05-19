// apps/patient-app/src/devices/linktop/router.ts

import {
  parseBPMeasurement,
  parseECGWave,
  parseLinktopBtFrame,
  parseLinktopSpo2Scalar,
  parseLinktopVendorBp,
  parsePPGWave,
  parseVendorGlucose,
  parseVendorTemp,
} from '@/src/devices/parsers';
import type {
  LinktopDecoded,
  LinktopMeasurementMode,
  LinktopRoute,
} from './types';

function asU8(dv: DataView): Uint8Array {
  return new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
}

function guessBattery(u8: Uint8Array): number | null {
  if (u8.length === 1 && u8[0] <= 100) return u8[0];
  if (u8.length >= 2 && u8[0] === 0x64 && u8[1] <= 100) return u8[1];
  return null;
}

function ackIfTiny(raw: Uint8Array): LinktopDecoded | null {
  if (raw.length <= 3) {
    return {
      kind: 'ack',
      code: raw[0],
      raw,
    };
  }
  return null;
}

function batteryIfPresent(raw: Uint8Array): LinktopDecoded | null {
  const battery = guessBattery(raw);
  if (battery != null) {
    return { kind: 'battery', percent: battery, raw };
  }
  return null;
}

function strictBpIfPresent(dv: DataView): LinktopDecoded | null {
  const raw = asU8(dv);

  const vendor = parseLinktopVendorBp(dv);
  if (vendor) {
    return {
      kind: 'bp_result',
      systolic: vendor.systolic,
      diastolic: vendor.diastolic,
      map: vendor.map ?? null,
      pulse: vendor.pulse ?? null,
      raw,
    };
  }

  const sig = parseBPMeasurement(dv);
  if (sig) {
    return {
      kind: 'bp_result',
      systolic: Number(sig.systolic.toFixed(1)),
      diastolic: Number(sig.diastolic.toFixed(1)),
      map: sig.map ?? null,
      raw,
    };
  }

  return null;
}

function tempIfPresent(dv: DataView): LinktopDecoded | null {
  const raw = asU8(dv);

  const bt = parseLinktopBtFrame(dv);
  if (bt?.bodyTempC != null) {
    return {
      kind: 'temperature_result',
      celsius: bt.bodyTempC,
      fahrenheit: +(bt.bodyTempC * 9 / 5 + 32).toFixed(1),
      raw,
    };
  }

  const t = parseVendorTemp(dv);
  if (!t) return null;

  return {
    kind: 'temperature_result',
    celsius: t.celsius,
    fahrenheit: t.fahrenheit ?? null,
    raw,
  };
}

function glucoseIfPresent(dv: DataView): LinktopDecoded | null {
  const raw = asU8(dv);
  const g = parseVendorGlucose(dv);
  if (!g) return null;

  return {
    kind: 'glucose_result',
    glucose: g.glucose,
    unit: g.unit,
    raw,
  };
}

function spo2IfPresent(dv: DataView): LinktopDecoded | null {
  const raw = asU8(dv);

  const scalar = parseLinktopSpo2Scalar(dv);
  if (scalar) {
    return {
      kind: 'spo2_result',
      spo2: scalar.spo2,
      pulse: scalar.pulse ?? null,
      pi: scalar.pi ?? null,
      raw,
    };
  }

  return null;
}

function decodeBpOnly(dv: DataView): LinktopDecoded {
  const raw = asU8(dv);

  return (
    ackIfTiny(raw) ??
    batteryIfPresent(raw) ??
    strictBpIfPresent(dv) ?? {
      kind: 'unknown',
      raw,
    }
  );
}

function decodeTempOnly(dv: DataView): LinktopDecoded {
  const raw = asU8(dv);

  return (
    ackIfTiny(raw) ??
    batteryIfPresent(raw) ??
    tempIfPresent(dv) ?? {
      kind: 'unknown',
      raw,
    }
  );
}

function decodeGlucoseOnly(dv: DataView): LinktopDecoded {
  const raw = asU8(dv);

  return (
    ackIfTiny(raw) ??
    batteryIfPresent(raw) ??
    glucoseIfPresent(dv) ?? {
      kind: 'unknown',
      raw,
    }
  );
}

function decodeSpo2Only(dv: DataView): LinktopDecoded {
  const raw = asU8(dv);

  const ack = ackIfTiny(raw);
  if (ack) return ack;

  const battery = batteryIfPresent(raw);
  if (battery) return battery;

  const scalar = spo2IfPresent(dv);
  if (scalar) return scalar;

  const ppg = parsePPGWave(dv);
  if (ppg) {
    return {
      kind: 'ppg_wave',
      sampleHz: ppg.sampleHz,
      samples: ppg.samples,
      raw,
    };
  }

  return {
    kind: 'unknown',
    raw,
  };
}

function decodeEcgOnly(dv: DataView): LinktopDecoded {
  const raw = asU8(dv);

  const ack = ackIfTiny(raw);
  if (ack) return ack;

  const battery = batteryIfPresent(raw);
  if (battery) return battery;

  const ecg = parseECGWave(dv);
  if (ecg) {
    return {
      kind: 'ecg_wave',
      sampleHz: ecg.sampleHz,
      samples: ecg.samples,
      raw,
    };
  }

  return {
    kind: 'unknown',
    raw,
  };
}

function decodeFromMode(dv: DataView, mode: LinktopMeasurementMode): LinktopDecoded {
  switch (mode) {
    case 'bp':
      return decodeBpOnly(dv);
    case 'temp':
      return decodeTempOnly(dv);
    case 'glucose':
      return decodeGlucoseOnly(dv);
    case 'spo2':
      return decodeSpo2Only(dv);
    case 'ecg':
      return decodeEcgOnly(dv);
    case 'idle':
    default:
      return decodeGeneral(dv);
  }
}

function decodeGeneral(dv: DataView): LinktopDecoded {
  const raw = asU8(dv);

  const ack = ackIfTiny(raw);
  if (ack) return ack;

  const battery = batteryIfPresent(raw);
  if (battery) return battery;

  const temp = tempIfPresent(dv);
  if (temp) return temp;

  const glucose = glucoseIfPresent(dv);
  if (glucose) return glucose;

  const spo2 = spo2IfPresent(dv);
  if (spo2) return spo2;

  const ecg = parseECGWave(dv);
  if (ecg) {
    return {
      kind: 'ecg_wave',
      sampleHz: ecg.sampleHz,
      samples: ecg.samples,
      raw,
    };
  }

  const ppg = parsePPGWave(dv);
  if (ppg) {
    return {
      kind: 'ppg_wave',
      sampleHz: ppg.sampleHz,
      samples: ppg.samples,
      raw,
    };
  }

  const bp = strictBpIfPresent(dv);
  if (bp) return bp;

  return {
    kind: 'unknown',
    raw,
  };
}

export function routeAndDecodeLinktop(
  dv: DataView,
  opts: {
    sourceChar: string;
    mode: LinktopMeasurementMode;
  },
): { route: { channel: LinktopRoute }; result: LinktopDecoded } {
  const sourceChar = opts.sourceChar;

  if (sourceChar === 'temp') {
    return {
      route: { channel: 'temp' },
      result: decodeTempOnly(dv),
    };
  }

  if (sourceChar === 'glucose') {
    return {
      route: { channel: 'glucose' },
      result: decodeGlucoseOnly(dv),
    };
  }

  if (sourceChar === 'therm_confirm') {
    const raw = asU8(dv);
    return {
      route: { channel: 'therm_confirm' },
      result: {
        kind: 'ack',
        code: raw[0],
        raw,
      },
    };
  }

  return {
    route: { channel: 'vendor_notify' },
    result: decodeFromMode(dv, opts.mode),
  };
}