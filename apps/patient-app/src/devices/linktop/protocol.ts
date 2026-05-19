// apps/patient-app/src/devices/linktop/protocol.ts

import type { LinktopMeasurementMode } from './types';

export type LinktopControlOp =
  | 'start_bp'
  | 'stop_bp'
  | 'bp_read_calibration'
  | 'bp_temp_compensate'
  | 'bp_get_pressure_zero'
  | 'bp_start_pressure_test'
  | 'bp_start_pwm_arm'
  | 'bp_start_pwm_wrist'
  | 'bp_adjust_negative_pwm'
  | 'start_spo2'
  | 'stop_spo2'
  | 'start_ecg'
  | 'stop_ecg'
  | 'start_temp'
  | 'stop_temp'
  | 'start_glucose'
  | 'stop_glucose'
  | 'noop';

export const LINKTOP_FRAME_START = 0x01;
export const LINKTOP_NOTIFY_FRAME_START = 0x02;
export const LINKTOP_FRAME_KIND_COMMAND = 0x04;
export const LINKTOP_FRAME_END = 0xff;

export const LINKTOP_MODULE_BP = 0x01;
export const LINKTOP_MODULE_BT = 0x02;
export const LINKTOP_MODULE_TEST_PAPER = 0x03;
export const LINKTOP_MODULE_SPO2 = 0x04;
export const LINKTOP_MODULE_ECG = 0x05;
export const LINKTOP_MODULE_STATUS = 0x10;

export type LinktopModuleId =
  | typeof LINKTOP_MODULE_BP
  | typeof LINKTOP_MODULE_BT
  | typeof LINKTOP_MODULE_TEST_PAPER
  | typeof LINKTOP_MODULE_SPO2
  | typeof LINKTOP_MODULE_ECG
  | typeof LINKTOP_MODULE_STATUS;

export type ParsedLinktopFrame = {
  moduleId: number;
  rawModuleId: number;
  payload: Uint8Array;
  raw: Uint8Array;
  offset: number;
  frameStart: number;
};

function u8(n: number): number {
  return n & 0xff;
}

function asUnsignedByte(n: number): number {
  return n & 0xff;
}

function normalizeModuleId(moduleId: number): number {
  const id = moduleId & 0xff;
  if (id >= 0x81 && id <= 0x85) return id - 0x80;
  return id;
}

function protocolHeaderXor(bytes: Uint8Array, length: number): number {
  let out = 0;
  for (let i = 0; i < length; i++) {
    out = (out ^ asUnsignedByte(bytes[i])) & 0xffff;
  }
  return out & 0xff;
}

function protocolCrc(bytes: Uint8Array, length: number, seed = 0xffff): number {
  let crc = seed === 0 ? 0xffff : seed & 0xffff;

  for (let i = 0; i < length; i++) {
    const translated = asUnsignedByte(bytes[i]);
    const mixed = ((((crc >> 8) & 0xff) | (crc << 8)) & 0xffff) ^ translated;
    const folded = ((mixed ^ ((mixed & 0xff) >> 4)) & 0xffff) >>> 0;
    const spread = (folded ^ (folded << 12)) & 0xffff;
    crc = ((spread ^ ((spread & 0xff) << 5)) & 0xffff) >>> 0;
  }

  return crc & 0xffff;
}

export function buildLinktopFrame(
  moduleId: number,
  payload: number[] | Uint8Array,
): Uint8Array {
  const body = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const len = body.length;
  const out = new Uint8Array(len + 9);

  out[0] = LINKTOP_FRAME_START;
  out[1] = u8(len);
  out[2] = u8(len >> 8);
  out[3] = LINKTOP_FRAME_KIND_COMMAND;
  out[4] = u8(moduleId);
  out[5] = protocolHeaderXor(out, 5);

  if (len > 0) {
    out.set(body, 6);
  }

  const crc = protocolCrc(out, len + 6, 0);
  out[len + 6] = u8(crc);
  out[len + 7] = u8(crc >> 8);
  out[len + 8] = LINKTOP_FRAME_END;

  return out;
}

function isValidFrameStart(byte0: number): boolean {
  return byte0 === LINKTOP_FRAME_START || byte0 === LINKTOP_NOTIFY_FRAME_START;
}

function tryParseFrameAt(raw: Uint8Array, offset: number): ParsedLinktopFrame | null {
  if (!raw || raw.length - offset < 9) return null;
  if (!isValidFrameStart(raw[offset])) return null;
  if (raw[offset + 3] !== LINKTOP_FRAME_KIND_COMMAND) return null;

  const payloadLen = raw[offset + 1] | (raw[offset + 2] << 8);
  const frameLen = payloadLen + 9;

  if (raw.length - offset < frameLen) return null;
  if (raw[offset + frameLen - 1] !== LINKTOP_FRAME_END) return null;

  const frame = raw.slice(offset, offset + frameLen);

  const expectedHeaderXor = protocolHeaderXor(frame, 5);
  if ((frame[5] & 0xff) !== expectedHeaderXor) return null;

  const crc = protocolCrc(frame, payloadLen + 6, 0);
  const crcLo = u8(crc);
  const crcHi = u8(crc >> 8);

  if (frame[payloadLen + 6] !== crcLo || frame[payloadLen + 7] !== crcHi) {
    return null;
  }

  const rawModuleId = frame[4] & 0xff;

  return {
    moduleId: normalizeModuleId(rawModuleId),
    rawModuleId,
    payload: frame.slice(6, 6 + payloadLen),
    raw: frame,
    offset,
    frameStart: frame[0] & 0xff,
  };
}

export function parseLinktopFrame(raw: Uint8Array): ParsedLinktopFrame | null {
  return tryParseFrameAt(raw, 0);
}

export function extractLinktopFrames(raw: Uint8Array): ParsedLinktopFrame[] {
  const frames: ParsedLinktopFrame[] = [];
  if (!raw || raw.length < 9) return frames;

  let i = 0;
  while (i <= raw.length - 9) {
    const frame = tryParseFrameAt(raw, i);
    if (frame) {
      frames.push(frame);
      i += frame.raw.length;
      continue;
    }
    i += 1;
  }

  return frames;
}

export function linktopHex(u8v: Uint8Array): string {
  return Array.from(u8v)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}

export function linktopModuleName(moduleId: number | null | undefined): string {
  switch (moduleId) {
    case LINKTOP_MODULE_BP:
      return 'bp';
    case LINKTOP_MODULE_BT:
      return 'bt';
    case LINKTOP_MODULE_TEST_PAPER:
      return 'test_paper';
    case LINKTOP_MODULE_SPO2:
      return 'spo2';
    case LINKTOP_MODULE_ECG:
      return 'ecg';
    case LINKTOP_MODULE_STATUS:
      return 'status';
    default:
      return `unknown(${moduleId ?? 'n/a'})`;
  }
}

export function buildLinktopCtrl(
  op: LinktopControlOp,
  opts?: {
    wristPwm?: number;
    negativePwm?: number;
  },
): Uint8Array {
  switch (op) {
    case 'start_bp':
    case 'bp_read_calibration':
      return buildLinktopFrame(LINKTOP_MODULE_BP, [0x01]);

    case 'bp_temp_compensate':
      return buildLinktopFrame(LINKTOP_MODULE_BP, [0x02]);

    case 'bp_get_pressure_zero':
      return buildLinktopFrame(LINKTOP_MODULE_BP, [0x03]);

    case 'bp_start_pressure_test':
      return buildLinktopFrame(LINKTOP_MODULE_BP, [0x04]);

    case 'bp_start_pwm_arm':
      return buildLinktopFrame(LINKTOP_MODULE_BP, [0x05, 0x55]);

    case 'bp_start_pwm_wrist':
      return buildLinktopFrame(LINKTOP_MODULE_BP, [0x06, u8(opts?.wristPwm ?? 170)]);

    case 'stop_bp':
      return buildLinktopFrame(LINKTOP_MODULE_BP, [0x07]);

    case 'bp_adjust_negative_pwm':
      return buildLinktopFrame(
        LINKTOP_MODULE_BP,
        [0x08, u8(opts?.negativePwm ?? 0xff)],
      );

    case 'start_spo2':
      return buildLinktopFrame(LINKTOP_MODULE_SPO2, [0x00]);

    case 'stop_spo2':
      return buildLinktopFrame(LINKTOP_MODULE_SPO2, [0x01]);

    case 'start_ecg':
      return buildLinktopFrame(LINKTOP_MODULE_ECG, [0x01]);

    case 'stop_ecg':
      return buildLinktopFrame(LINKTOP_MODULE_ECG, [0x02]);

    case 'start_temp':
      return buildLinktopFrame(LINKTOP_MODULE_BT, [0x00]);

    case 'stop_temp':
      // Native BT task effectively self-terminates when result is produced.
      // Keep API compatibility by sending a noop/status frame.
      return buildLinktopFrame(LINKTOP_MODULE_STATUS, [0x00]);

    case 'start_glucose':
      return buildLinktopFrame(LINKTOP_MODULE_TEST_PAPER, [0x01]);

    case 'stop_glucose':
      return buildLinktopFrame(LINKTOP_MODULE_TEST_PAPER, [0x00]);

    case 'noop':
    default:
      return buildLinktopFrame(LINKTOP_MODULE_STATUS, [0x00]);
  }
}

export function modeToStartOp(mode: LinktopMeasurementMode): LinktopControlOp {
  switch (mode) {
    case 'bp':
      return 'start_bp';
    case 'spo2':
      return 'start_spo2';
    case 'ecg':
      return 'start_ecg';
    case 'temp':
      return 'start_temp';
    case 'glucose':
      return 'start_glucose';
    case 'idle':
    default:
      return 'noop';
  }
}

export function modeToStopOp(mode: LinktopMeasurementMode): LinktopControlOp {
  switch (mode) {
    case 'bp':
      return 'stop_bp';
    case 'spo2':
      return 'stop_spo2';
    case 'ecg':
      return 'stop_ecg';
    case 'temp':
      return 'stop_temp';
    case 'glucose':
      return 'stop_glucose';
    case 'idle':
    default:
      return 'noop';
  }
}