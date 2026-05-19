'use client';

import type { NexRingSdkAny } from './nexring-sdk';
import type {
  RingCommandResult,
  RingDeviceInfo,
  RingMetric,
} from './nexring-types';

export type NexRingPacketFamily =
  | 'live_stream'
  | 'device_info'
  | 'history_count'
  | 'history_data'
  | 'active_data'
  | 'active_data_2'
  | 'sleep_history'
  | 'daily_activity_history'
  | 'ppg_measurement'
  | 'temperature_history'
  | 'activity_intensity_history'
  | 'daily_activity_summary_2'
  | 'algorithm_history'
  | 'history_error'
  | 'battery'
  | 'control'
  | 'unknown';

export type NexRingPacket = {
  raw: Uint8Array;
  hex: string;
  length: number;
  header: number | null;
  cmd: number | null;
  family: NexRingPacketFamily;
  checksum: number | null;
  meta: Record<string, number | string | boolean | null | undefined>;
};

type PushRawResult =
  | { ok: true }
  | { ok: false; error: string };

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}

function asU8(input: unknown): Uint8Array | null {
  if (!input) return null;

  if (input instanceof Uint8Array) return input;

  if (Array.isArray(input) && input.every((v) => typeof v === 'number')) {
    return Uint8Array.from(input.map((v) => Number(v) & 0xff));
  }

  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }

  if (ArrayBuffer.isView(input)) {
    const view = input as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }

  if (typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    for (const key of [
      'bytes',
      'data',
      'value',
      'packet',
      'payload',
      'buffer',
      'cmdData',
      'sendData',
      'result',
      'raw',
    ]) {
      const nested = asU8(obj[key]);
      if (nested) return nested;
    }
  }

  return null;
}

function tryCallNoArgs(fn: unknown, ctx: unknown): unknown {
  if (typeof fn !== 'function') return undefined;

  try {
    return Reflect.apply(fn, ctx, []);
  } catch {
    try {
      return (fn as () => unknown)();
    } catch {
      return undefined;
    }
  }
}

function coerceCommandOutput(
  value: unknown,
  seen = new Set<unknown>(),
  depth = 0,
): Uint8Array | null {
  if (depth > 5 || value == null) return null;

  const direct = asU8(value);
  if (direct) return direct;

  if (typeof value === 'object') {
    if (seen.has(value)) return null;
    seen.add(value);

    const obj = value as Record<string, unknown>;

    for (const methodName of [
      'execute',
      'build',
      'toBytes',
      'getBytes',
      'toByteArray',
      'toUint8Array',
      'toData',
      'getData',
      'valueOf',
    ]) {
      const next = tryCallNoArgs(obj[methodName], obj);
      const out = coerceCommandOutput(next, seen, depth + 1);
      if (out) return out;
    }

    for (const key of [
      'bytes',
      'data',
      'value',
      'packet',
      'payload',
      'buffer',
      'cmdData',
      'sendData',
      'result',
      'raw',
      'command',
      'request',
    ]) {
      const out = coerceCommandOutput(obj[key], seen, depth + 1);
      if (out) return out;
    }
  }

  return null;
}

function describeUnsupported(value: unknown): string {
  if (value == null) return 'null_or_undefined';
  if (value instanceof Uint8Array) return 'uint8array';
  if (Array.isArray(value)) return 'array';
  if (value instanceof ArrayBuffer) return 'arraybuffer';
  if (ArrayBuffer.isView(value)) return 'typed_array_view';

  if (typeof value === 'object') {
    const ctor =
      (value as { constructor?: { name?: string } })?.constructor?.name || 'object';
    const keys = Object.keys(value as Record<string, unknown>).slice(0, 12);
    return `${ctor}{${keys.join(',')}}`;
  }

  return typeof value;
}

function signed8(v: number): number {
  return v > 127 ? v - 256 : v;
}

function nearestTo(values: number[], target: number): number {
  return values.reduce((best, current) =>
    Math.abs(current - target) < Math.abs(best - target) ? current : best,
  );
}

function mostStable(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  const sorted = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return Math.abs(a[0] - 60) - Math.abs(b[0] - 60);
  });
  return sorted[0]?.[0];
}

function inferMeasurementMode(raw: Uint8Array, cmd: number | null): string | null {
  if (cmd === 0x86) return 'battery';

  const b7 = raw.length > 7 ? raw[7] : null;
  const b4 = raw.length > 4 ? raw[4] : null;

  if (cmd === 0x83) {
    if (b7 === 0x20) return 'mindfulness';
    if (b7 === 0x30) return 'oxygen';
    if (b7 === 0x40) return 'temperature';
    if (b7 === 0x50) return 'exercise';
    if (b4 === 0x01) return 'single_health';
    return 'health';
  }

  if (b7 == null) return null;
  return `mode_${b7}`;
}

function chooseBestHrCandidate(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const preferred = values.filter((v) => v >= 45 && v <= 140);
  if (preferred.length > 0) return nearestTo(preferred, 72);
  const plausible = values.filter((v) => v >= 35 && v <= 220);
  if (plausible.length > 0) return nearestTo(plausible, 72);
  return undefined;
}

function chooseSleepHrCandidate(values: number[]): number | undefined {
  const plausible = values.filter((v) => v >= 30 && v <= 110);
  if (plausible.length === 0) return undefined;
  return nearestTo(plausible, 58);
}

function chooseBestSpo2Candidate(values: number[], hr?: number): number | undefined {
  if (values.length === 0) return undefined;
  const plausible = values.filter((v) => v >= 70 && v <= 100);
  const filtered =
    typeof hr === 'number'
      ? plausible.filter((v) => Math.abs(v - hr) > 3)
      : plausible;
  if (filtered.length === 0) return undefined;
  return nearestTo(filtered, 97);
}

function inferTempDeviation(raw: Uint8Array): number | undefined {
  const candidates = [raw[4], raw[5], raw[6], raw[8], raw[9]].filter((v) =>
    Number.isFinite(v),
  ) as number[];

  for (const v of candidates) {
    const normalized = signed8(v) / 10;
    if (normalized >= -3 && normalized <= 3) {
      return normalized;
    }
  }

  return undefined;
}

function chooseBatteryCandidate(raw: Uint8Array): number | undefined {
  const positional = [
    raw[5],
    raw[4],
    raw[6],
    raw[7],
    raw[8],
    raw[9],
  ].filter((v) => Number.isFinite(v) && v >= 0 && v <= 100) as number[];

  if (positional.length === 0) return undefined;

  if (Number.isFinite(raw[5]) && raw[5] >= 0 && raw[5] <= 100) {
    return raw[5];
  }

  const stable = mostStable(positional);
  if (typeof stable === 'number') return stable;

  return nearestTo(positional, 60);
}

function inferCharging(raw: Uint8Array): boolean | undefined {
  const b4 = raw.length > 4 ? raw[4] : undefined;
  const b6 = raw.length > 6 ? raw[6] : undefined;

  if (b4 === 1 && typeof b6 === 'number' && b6 >= 128) return true;
  if (b4 === 0) return false;

  return undefined;
}

function readAscii(raw: Uint8Array, start = 2, end = raw.length - 1): string | undefined {
  const slice = raw.slice(start, Math.max(start, end));
  const chars = Array.from(slice)
    .filter((v) => v >= 32 && v <= 126)
    .map((v) => String.fromCharCode(v))
    .join('')
    .trim();

  return chars || undefined;
}

function unixSecondsFromLittleEndian(raw: Uint8Array, start: number): number | undefined {
  if (raw.length < start + 4) return undefined;
  const v =
    (raw[start] ?? 0) |
    ((raw[start + 1] ?? 0) << 8) |
    ((raw[start + 2] ?? 0) << 16) |
    ((raw[start + 3] ?? 0) << 24);

  if (v < 1_600_000_000 || v > 2_200_000_000) return undefined;
  return v;
}

function decodeHistoryHealthMetric(packet: NexRingPacket): RingMetric | null {
  if (packet.cmd !== 0x91 && packet.cmd !== 0x92) return null;
  if (packet.raw.length < 19) return null;

  const raw = packet.raw;

  const tsSec = unixSecondsFromLittleEndian(raw, 2);
  const ts = typeof tsSec === 'number' ? tsSec * 1000 : Date.now();

  const hrCandidates = [raw[14], raw[15], raw[16], raw[17], raw[18]].filter((v) =>
    Number.isFinite(v),
  ) as number[];

  const sleepHr = chooseSleepHrCandidate(hrCandidates);
  const liveLikeHr = chooseBestHrCandidate(hrCandidates);
  const hr =
    typeof sleepHr === 'number'
      ? sleepHr
      : typeof liveLikeHr === 'number'
        ? liveLikeHr
        : undefined;

  const spo2 = chooseBestSpo2Candidate(hrCandidates, hr);

  const rrCandidate = Number.isFinite(raw[15]) && raw[15] >= 8 && raw[15] <= 40
    ? raw[15]
    : undefined;

  const tempCandidates = [raw[17], raw[18], raw[13]].filter((v) =>
    Number.isFinite(v),
  ) as number[];

  let tempDeviation: number | undefined;
  for (const candidate of tempCandidates) {
    const normalized = signed8(candidate) / 10;
    if (normalized >= -3 && normalized <= 3) {
      tempDeviation = normalized;
      break;
    }
  }

  if (
    typeof hr !== 'number' &&
    typeof spo2 !== 'number' &&
    typeof rrCandidate !== 'number' &&
    typeof tempDeviation !== 'number'
  ) {
    return null;
  }

  return {
    kind: 'health',
    ts,
    hr,
    spo2,
    rr: rrCandidate,
    sourceMode: 'history',
  };
}

export function buildNexRingCommandPacket(
  sdk: NexRingSdkAny,
  cmd: string | number,
  payload: number[] = [],
): Uint8Array {
  const startDetect = sdk?.startDetect ?? sdk?.StartDetect;

  if (typeof startDetect !== 'function') {
    throw new Error('SDK does not expose startDetect');
  }

  let raw: unknown;
  try {
    raw = Reflect.apply(startDetect, sdk, [cmd, payload]);
  } catch {
    raw = startDetect(cmd, payload);
  }

  const packet = coerceCommandOutput(raw);
  if (packet) return packet;

  throw new Error(
    `Unsupported startDetect return type: ${describeUnsupported(raw)}`,
  );
}

export function parseNexRingPacket(bytes: Uint8Array): NexRingPacket {
  const header = bytes.length >= 1 ? bytes[0] : null;
  const cmd = bytes.length >= 2 ? bytes[1] : null;
  const checksum = bytes.length >= 1 ? bytes[bytes.length - 1] : null;

  let family: NexRingPacketFamily = 'unknown';

  if (header === 0xfe && cmd === 0x83) {
    family = 'live_stream';
  } else if (header === 0xfe && (cmd === 0x87 || cmd === 0x88 || cmd === 0x8f)) {
    family = 'device_info';
  } else if (header === 0xfe && cmd === 0x81) {
    family = 'history_count';
  } else if (header === 0xfe && (cmd === 0x82 || cmd === 0x91 || cmd === 0x92)) {
    family = 'history_data';
  } else if (header === 0xfe && cmd === 0xc8) {
    family = 'active_data';
  } else if (header === 0xfe && cmd === 0xd3) {
    family = 'active_data_2';
  } else if (header === 0xfe && cmd === 0xc9) {
    family = 'sleep_history';
  } else if (header === 0xfe && cmd === 0xca) {
    family = 'daily_activity_history';
  } else if (header === 0xfe && cmd === 0xcb) {
    family = 'ppg_measurement';
  } else if (header === 0xfe && cmd === 0xce) {
    family = 'temperature_history';
  } else if (header === 0xfe && cmd === 0xd1) {
    family = 'activity_intensity_history';
  } else if (header === 0xfe && cmd === 0xd4) {
    family = 'daily_activity_summary_2';
  } else if (header === 0xfe && (cmd === 0xc1 || cmd === 0xc2)) {
    family = 'algorithm_history';
  } else if (header === 0xfe && cmd === 0xd5) {
    family = 'history_error';
  } else if (header === 0xfe && cmd === 0x86) {
    family = 'battery';
  } else if (header === 0xfe) {
    family = 'control';
  }

  const measurementMode = inferMeasurementMode(bytes, cmd);
  const tsSec = unixSecondsFromLittleEndian(bytes, 2);

  const meta: NexRingPacket['meta'] = {
    byte2: bytes.length > 2 ? bytes[2] : null,
    byte3: bytes.length > 3 ? bytes[3] : null,
    byte4: bytes.length > 4 ? bytes[4] : null,
    byte5: bytes.length > 5 ? bytes[5] : null,
    byte6: bytes.length > 6 ? bytes[6] : null,
    byte7: bytes.length > 7 ? bytes[7] : null,
    byte8: bytes.length > 8 ? bytes[8] : null,
    byte9: bytes.length > 9 ? bytes[9] : null,
    historyTsSec: tsSec ?? null,
    measurementMode,
    receiveFamily: family,
    opticalHint:
      cmd === 0x83
        ? measurementMode === 'oxygen' || measurementMode === 'mindfulness'
          ? 'red_or_ir_possible'
          : 'green_or_mixed_possible'
        : null,
  };

  return {
    raw: bytes,
    hex: toHex(bytes),
    length: bytes.length,
    header,
    cmd,
    family,
    checksum,
    meta,
  };
}

export function packetFamilyLabel(family: NexRingPacketFamily) {
  switch (family) {
    case 'history_count':
      return 'History count';
    case 'history_data':
      return 'History rows';
    case 'active_data':
      return 'Active data';
    case 'active_data_2':
      return 'Active data 2';
    case 'sleep_history':
      return 'Sleep history';
    case 'daily_activity_history':
      return 'Daily activity history';
    case 'ppg_measurement':
      return 'PPG measurement';
    case 'temperature_history':
      return 'Temperature history';
    case 'activity_intensity_history':
      return 'Activity intensity history';
    case 'daily_activity_summary_2':
      return 'Daily activity summary 2';
    case 'algorithm_history':
      return 'Algorithm history';
    case 'history_error':
      return 'History error';
    case 'live_stream':
      return 'Live stream';
    case 'battery':
      return 'Battery';
    case 'device_info':
      return 'Device info';
    case 'control':
      return 'Control';
    default:
      return 'Unknown';
  }
}

export function expectedFamiliesForLabel(label: string): NexRingPacketFamily[] {
  switch (label) {
    case 'historicalNum':
      return ['history_count'];
    case 'historicalData':
      return ['history_data'];
    case 'sleep_history':
    case 'SLEEP_HISTORY':
      return ['sleep_history'];
    case 'ACTIVE_DATA':
      return ['active_data'];
    case 'ACTIVE_DATA_2':
      return ['active_data_2'];
    case 'NEW_ALGORITHM_HISTORY_NUM':
      return ['algorithm_history', 'history_count'];
    case 'NEW_ALGORITHM_HISTORY':
      return ['algorithm_history'];
    case 'step':
      return ['history_data', 'daily_activity_history', 'daily_activity_summary_2'];
    case 'temperature':
      return ['temperature_history', 'history_data'];
    case 'openHealth':
      return ['live_stream'];
    case 'openSingleHealth':
      return ['live_stream'];
    case 'closeHealth':
    case 'closeSingleHealth':
      return ['control'];
    case 'batteryDataAndState':
      return ['battery'];
    case 'deviceInfo1':
    case 'deviceInfo2':
    case 'deviceInfo5':
      return ['device_info'];
    case 'timeSync':
      return ['control'];
    default:
      return [];
  }
}

export function isHistoryLikeFamily(family: NexRingPacketFamily) {
  return (
    family === 'history_count' ||
    family === 'history_data' ||
    family === 'active_data' ||
    family === 'active_data_2' ||
    family === 'sleep_history' ||
    family === 'daily_activity_history' ||
    family === 'temperature_history' ||
    family === 'activity_intensity_history' ||
    family === 'daily_activity_summary_2' ||
    family === 'algorithm_history' ||
    family === 'history_error'
  );
}

export function inferMetricFromPacket(packet: NexRingPacket): RingMetric | null {
  const { raw, header, cmd, meta } = packet;

  if (header !== 0xfe || raw.length < 8) {
    return null;
  }

  if (cmd === 0x83) {
    const candidates = [raw[4], raw[5], raw[6], raw[8], raw[9]].filter((v) =>
      Number.isFinite(v),
    ) as number[];

    const hr = chooseBestHrCandidate(candidates);
    const spo2 = chooseBestSpo2Candidate(candidates, hr);
    const tempDeviation = inferTempDeviation(raw);

    if (
      typeof hr !== 'number' &&
      typeof spo2 !== 'number' &&
      typeof tempDeviation !== 'number'
    ) {
      return null;
    }

    return {
      kind: 'health',
      ts: Date.now(),
      hr,
      spo2:
        meta.measurementMode === 'oxygen' ||
        meta.measurementMode === 'mindfulness'
          ? spo2
          : undefined,
      sourceMode: 'live',
    };
  }

  if (cmd === 0x86) {
    const pct = chooseBatteryCandidate(raw);
    const charging = inferCharging(raw);

    if (typeof pct !== 'number' && typeof charging !== 'boolean') {
      return null;
    }

    return {
      kind: 'battery',
      ts: Date.now(),
      pct,
      charging,
    };
  }

  const historyMetric = decodeHistoryHealthMetric(packet);
  if (historyMetric) return historyMetric;

  return null;
}

export function inferCommandResultFromPacket(
  packet: NexRingPacket,
): RingCommandResult | null {
  const { cmd, family, hex, meta } = packet;
  const ts = Date.now();

  if (packet.header !== 0xfe || cmd == null) return null;

  if (cmd === 0x80) {
    return {
      ts,
      ok: true,
      code: 'control_ack',
      message: `cmd=0x80 family=${family}`,
      raw: {
        packetHex: hex,
        family,
        meta,
      },
    };
  }

  if (cmd === 0x86) {
    return {
      ts,
      ok: true,
      code: 'battery_packet',
      message: 'battery packet received',
      raw: {
        packetHex: hex,
        family,
        meta,
      },
    };
  }

  if (cmd === 0x87 || cmd === 0x88 || cmd === 0x8f) {
    return {
      ts,
      ok: true,
      code: `device_info_0x${cmd.toString(16)}`,
      message: 'device info packet received',
      raw: {
        packetHex: hex,
        family,
        meta,
        ascii: readAscii(packet.raw),
      },
    };
  }

  if (family === 'history_count') {
    return {
      ts,
      ok: true,
      code: 'history_count_packet',
      message: 'historical count envelope received',
      raw: {
        packetHex: hex,
        family,
        meta,
      },
    };
  }

  if (isHistoryLikeFamily(family)) {
    return {
      ts,
      ok: true,
      code: `${family}_packet`,
      message: `${family.replace(/_/g, ' ')} packet received`,
      raw: {
        packetHex: hex,
        family,
        meta,
      },
    };
  }

  if (family === 'control') {
    return {
      ts,
      ok: true,
      code: `control_0x${cmd.toString(16)}`,
      message: `control packet received for cmd=0x${cmd.toString(16)}`,
      raw: {
        packetHex: hex,
        family,
        meta,
      },
    };
  }

  return null;
}

export function inferDeviceInfoFromPacket(
  packet: NexRingPacket,
): RingDeviceInfo | null {
  const { cmd, raw } = packet;
  if (packet.header !== 0xfe || cmd == null) return null;

  if (cmd !== 0x87 && cmd !== 0x88 && cmd !== 0x8f) {
    return null;
  }

  const ascii = readAscii(raw);
  if (!ascii) return null;

  if (cmd === 0x87) {
    return {
      ts: Date.now(),
      model: ascii,
    };
  }

  if (cmd === 0x88) {
    return {
      ts: Date.now(),
      firmware: ascii,
    };
  }

  if (cmd === 0x8f) {
    return {
      ts: Date.now(),
      software: ascii,
    };
  }

  return null;
}

export function shouldUseVendorParser(packet: NexRingPacket): boolean {
  if (packet.header !== 0xfe) return true;

  switch (packet.cmd) {
    case 0x80:
    case 0x81:
    case 0x83:
    case 0x86:
    case 0x87:
    case 0x88:
    case 0x8f:
    case 0x91:
    case 0x92:
      return false;
    default:
      break;
  }

  return (
    packet.family === 'active_data' ||
    packet.family === 'active_data_2' ||
    packet.family === 'sleep_history' ||
    packet.family === 'daily_activity_history' ||
    packet.family === 'temperature_history' ||
    packet.family === 'activity_intensity_history' ||
    packet.family === 'daily_activity_summary_2' ||
    packet.family === 'algorithm_history' ||
    packet.family === 'history_error' ||
    packet.family === 'unknown'
  );
}

export function safePushRawDataToSdk(
  sdk: NexRingSdkAny,
  bytes: Uint8Array,
): PushRawResult {
  const fn =
    sdk?.pushRawData ??
    sdk?.PushRawData ??
    sdk?.handleRawData ??
    sdk?.onRawData;

  if (typeof fn !== 'function') {
    return { ok: false, error: 'SDK does not expose pushRawData' };
  }

  try {
    Reflect.apply(fn, sdk, [bytes]);
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}