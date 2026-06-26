// apps/patient-app/src/devices/healthMonitorBridge.ts
'use client';

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { connectDevice } from './connect';
import {
  buildLinktopCtrl,
  extractLinktopFrames,
  parseLinktopFrame,
  type LinktopControlOp,
  LINKTOP_MODULE_BP,
  LINKTOP_MODULE_BT,
  LINKTOP_MODULE_TEST_PAPER,
  LINKTOP_MODULE_STATUS,
} from './linktop/protocol';
import { routeAndDecodeLinktop } from './linktop/router';
import type { LinktopMeasurementMode } from './linktop/types';

type VitalEmitter = (opts: {
  type: string;
  payload: any;
  deviceId?: string;
  recorded_at?: string;
  meta?: any;
  dedupeKey?: string;
}) => Promise<void>;

type BridgeStatus = {
  connected: boolean;
  batteryPct?: number | null;
  rssi?: number | null;
};

type BpCycleReason =
  | 'silence_after_pressure'
  | 'bp_result_received'
  | 'manual_stop'
  | 'device_disconnect';

type GenericCycleReason =
  | 'result_received'
  | 'timeout'
  | 'manual_stop'
  | 'device_disconnect'
  | 'signal_detected_no_result';

type BridgeDeviceEvent =
  | {
      type: 'bp_cycle_complete';
      reason: BpCycleReason;
      pressureFrames: number;
      pressureSamplesSeen: number;
      latestPressure: number | null;
      peakPressure: number | null;
    }
  | {
      type: 'bp_result';
      systolic: number;
      diastolic: number;
      pulse?: number | null;
      map?: number | null;
    }
  | {
      type: 'bp_error';
      reason: string;
    }
  | {
      type: 'spo2_result';
      spo2: number | null;
      pulse?: number | null;
      pi?: number | null;
    }
  | {
      type: 'spo2_cycle_complete';
      reason: GenericCycleReason;
      ppgFrames: number;
      spo2: number | null;
      pulse: number | null;
    }
  | {
      type: 'temp_result';
      celsius: number;
      fahrenheit?: number | null;
    }
  | {
      type: 'temp_cycle_complete';
      reason: GenericCycleReason;
      celsius: number | null;
      fahrenheit: number | null;
    }
  | {
      type: 'glucose_result';
      glucose: number;
      unit: 'mg/dL' | 'mmol/L';
    }
  | {
      type: 'glucose_cycle_complete';
      reason: GenericCycleReason;
      glucose: number | null;
      unit: 'mg/dL' | 'mmol/L' | null;
    }
  | {
      type: 'ecg_cycle_complete';
      reason: GenericCycleReason;
      sampleCount: number;
      signalQuality: number | null;
      sampleHz: number | null;
      durationSec: number | null;
      heartRate: number | null;
      conclusion: string;
      waveformPreview: number[];
    };

type BridgeOpts = {
  patientId: string;
  emitVital: VitalEmitter;
  onStatus?: (s: BridgeStatus) => void;
  onDeviceEvent?: (evt: BridgeDeviceEvent) => void;
};

type NativeHealthMonitorPlugin = {
  askPermissions(): Promise<void>;
  startScan(): Promise<void>;
  stopScan(): Promise<void>;
  connect(opts: { mac: string }): Promise<void>;
  disconnect(): Promise<void>;
  setMeasurePosition(opts: { wrist: boolean }): Promise<void>;
  startMeasurements(): Promise<void>;
  stopMeasurements(): Promise<void>;
  addListener(
    eventName: string,
    listenerFunc: (data: any) => void,
  ): Promise<PluginListenerHandle>;
};

const NativeHealthMonitor = registerPlugin<NativeHealthMonitorPlugin>('HealthMonitor');

type ConnLike = Awaited<ReturnType<typeof connectDevice>>;

const DEVICE_ID = 'duecare.health-monitor';

const BP_SILENCE_COMPLETE_MS = 2600;
const BP_MIN_PRESSURE_FRAMES_FOR_COMPLETE = 8;
const BP_MIN_PRESSURE_SAMPLES_FOR_COMPLETE = 40;
const BP_POST_CYCLE_RESULT_WAIT_MS = 1000; // native posts delayed finalize after stop()

const BP_MOVING_AVG_WINDOW = 9;
const BP_ENVELOPE_SMOOTH_WINDOW = 11;
const BP_MIN_BEAT_GAP_SAMPLES = 40;
const BP_MIN_BEATS_FOR_RESULT = 5;
const BP_MAX_REASONABLE_PRESSURE = 320;
const BP_MIN_REASONABLE_PRESSURE = 20;
const BP_MIN_ENVELOPE_AMPLITUDE = 2.5;
const BP_MIN_ENVELOPE_RELATIVE = 0.18;
const BP_PEAK_SEARCH_EDGE_GUARD = 6;

const SPO2_TIMEOUT_MS = 25000;
const TEMP_TIMEOUT_MS = 12000;
const GLUCOSE_TIMEOUT_MS = 45000;
const ECG_TIMEOUT_MS = 30000;
const ECG_IDLE_STOP_MS = 6000;

const MODE_HANDOFF_SETTLE_MS = 180;
const STOP_COMMAND_COOLDOWN_MS = 300;

type BpBootstrapStage =
  | 'idle'
  | 'read_calibration'
  | 'temp_compensate'
  | 'pressure_zero'
  | 'pressure_stream'
  | 'pressure_test'
  | 'pump_started';

type GenericMeasureState = {
  timeoutTimer: ReturnType<typeof setTimeout> | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
  startedAt: number;
  lastSignalAt: number;
  completionEmitted: boolean;
};

type TempBtAlgoState = {
  ambientRaw: number[];
  bodyRaw: number[];
  finalEmitted: boolean;
};

type BpCalibrationParams = {
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  c5: number;
};

type BpComputedResult = {
  systolic: number;
  diastolic: number;
  pulse: number | null;
  map: number | null;
  beatCount: number;
  peakAmplitude: number;
  mapPressure: number;
  confidence: 'threshold' | 'partial_threshold_fallback';
  algorithm: 'bp-js-native-shaped' | 'bp-js-native-shaped-partial-threshold';
  fallbackReason?: string | null;
};

type BpAlgorithmState = {
  calibration: BpCalibrationParams | null;
  tempCompRaw: number | null;
  rawSamples: number[];
  scaledPressures: number[];
  beatIndices: number[];
  beatPressures: number[];
  beatAmplitudes: number[];
  finalized: boolean;
};

export class HealthMonitorBridge {
  private readonly bpRuntimeSignature = 'BP_PATCH_SIG_2026_04_02_A';

  private conn: ConnLike | null = null;
  private unsub: Array<() => void> = [];
  private opts!: BridgeOpts;
  private mode: LinktopMeasurementMode = 'idle';

  private nativeMode = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  private nativeListeners: PluginListenerHandle[] = [];
  private nativeConnected = false;
  private nativeScanStarted = false;
  private nativeConnectIssued = false;
  private nativeSeenMacs = new Set<string>();

  private controlCharKey: string | null = null;
  private notifyCharKeys: string[] = [];
  private batteryCharKey: string | null = null;

  private bpStage: BpBootstrapStage = 'idle';
  private bpPressureFrames = 0;
  private bpPressureSamplesSeen = 0;
  private bpPressureTestStarted = false;
  private bpPumpStartIssued = false;

  private bpFallbackTimers: Array<ReturnType<typeof setTimeout>> = [];
  private bpSilenceTimer: ReturnType<typeof setTimeout> | null = null;
  private bpPostCycleTimer: ReturnType<typeof setTimeout> | null = null;
  private bpLastPressureAt = 0;
  private bpLatestPressure: number | null = null;
  private bpPeakPressure: number | null = null;
  private bpCompletionEmitted = false;

  private bpMeasureWrist = false;
  private bpAlgo: BpAlgorithmState = {
    calibration: null,
    tempCompRaw: null,
    rawSamples: [],
    scaledPressures: [],
    beatIndices: [],
    beatPressures: [],
    beatAmplitudes: [],
    finalized: false,
  };

  // Native BpTask keeps a raw baseline h and converts raw sensor values into cuff pressure.
  // We do not have exact JNI parity here, so we track a native-shaped baseline and a dynamic
  // raw-to-pressure normalization for web finalization.
  private bpRawBaseline = 32016;
  private bpBaselineAccumulator = 0;
  private bpRawSampleIndex = 0;
  private bpRawDeltaPeak = 1;

  private spo2State: GenericMeasureState = this.makeGenericState();
  private spo2PpgFrames = 0;
  private spo2LastPulse: number | null = null;
  private spo2LastSpo2: number | null = null;
  private spo2OxRemainder: number[] = [];
  private spo2IrSamples: number[] = [];
  private spo2SampleIndex = 0;
  private spo2PeakIndices: number[] = [];
  private spo2AcSign = 0;
  private spo2PositiveRun: Array<{ index: number; value: number }> = [];
  private spo2PulseLastEmittedAt = 0;

  private tempState: GenericMeasureState = this.makeGenericState();
  private tempLastCelsius: number | null = null;
  private tempLastFahrenheit: number | null = null;
  private tempBtAlgo: TempBtAlgoState = {
    ambientRaw: [],
    bodyRaw: [],
    finalEmitted: false,
  };

  private glucoseState: GenericMeasureState = this.makeGenericState();
  private glucoseLastValue: number | null = null;
  private glucoseLastUnit: 'mg/dL' | 'mmol/L' | null = null;

  private ecgState: GenericMeasureState = this.makeGenericState();
  private ecgSampleCount = 0;
  private ecgSignalQuality: number | null = null;
  private ecgSampleHz: number | null = null;
  private ecgLastSampleAt = 0;
  private ecgSamples: number[] = [];

  private lastStopCommandAt: Partial<Record<LinktopControlOp, number>> = {};

  private makeGenericState(): GenericMeasureState {
    return {
      timeoutTimer: null,
      idleTimer: null,
      startedAt: 0,
      lastSignalAt: 0,
      completionEmitted: false,
    };
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private assertNativeSupports(mode: 'bp' | 'spo2' | 'temp' | 'glucose' | 'ecg') {
    if (!this.nativeMode) return;
    if (mode === 'bp') return;

    throw new Error(
      `Native Android HealthMonitor plugin currently supports blood pressure only. ${mode.toUpperCase()} must use the BLE bridge path until native lifecycle support is implemented.`,
    );
  }

  private async clearNativeListeners() {
    for (const h of this.nativeListeners.splice(0)) {
      try {
        await h.remove();
      } catch {}
    }
  }

  private unwrapNativeData(payload: any) {
    return payload?.data ?? payload ?? {};
  }

  private resetGenericState(state: GenericMeasureState) {
    if (state.timeoutTimer) clearTimeout(state.timeoutTimer);
    if (state.idleTimer) clearTimeout(state.idleTimer);
    state.timeoutTimer = null;
    state.idleTimer = null;
    state.startedAt = 0;
    state.lastSignalAt = 0;
    state.completionEmitted = false;
  }

  private resetSpo2State() {
    this.resetGenericState(this.spo2State);
    this.spo2PpgFrames = 0;
    this.spo2LastPulse = null;
    this.spo2LastSpo2 = null;
    this.spo2OxRemainder = [];
    this.spo2IrSamples = [];
    this.spo2SampleIndex = 0;
    this.spo2PeakIndices = [];
    this.spo2AcSign = 0;
    this.spo2PositiveRun = [];
    this.spo2PulseLastEmittedAt = 0;
  }

  private resetTempState() {
    this.resetGenericState(this.tempState);
    this.tempLastCelsius = null;
    this.tempLastFahrenheit = null;
    this.tempBtAlgo = {
      ambientRaw: [],
      bodyRaw: [],
      finalEmitted: false,
    };
  }

  private resetGlucoseState() {
    this.resetGenericState(this.glucoseState);
    this.glucoseLastValue = null;
    this.glucoseLastUnit = null;
  }

  private resetEcgState() {
    this.resetGenericState(this.ecgState);
    this.ecgSampleCount = 0;
    this.ecgSignalQuality = null;
    this.ecgSampleHz = null;
    this.ecgLastSampleAt = 0;
    this.ecgSamples = [];
  }

  private resetBpAlgo() {
    this.bpAlgo = {
      calibration: null,
      tempCompRaw: null,
      rawSamples: [],
      scaledPressures: [],
      beatIndices: [],
      beatPressures: [],
      beatAmplitudes: [],
      finalized: false,
    };

    this.bpRawBaseline = 32016;
    this.bpBaselineAccumulator = 0;
    this.bpRawSampleIndex = 0;
    this.bpRawDeltaPeak = 1;
  }

  private parseBpCalibrationParams(payload: Uint8Array): BpCalibrationParams | null {
    if (!payload || payload.length < 7) return null;
    if ((payload[0] & 0xff) !== 0x01) return null;

    const c1 = ((payload[1] & 0xff) << 6) + ((payload[2] & 0xff) >> 2);
    const c2 = ((payload[2] & 0x03) << 4) + ((payload[3] & 0xff) >> 4);
    const c3 = ((payload[3] & 0x0f) << 9) + ((payload[4] & 0xff) << 1) + ((payload[5] & 0xff) >> 7);
    const c4 = ((payload[5] & 0x7f) << 2) + ((payload[6] & 0xff) >> 6);
    const c5 = payload[6] & 0x3f;

    return { c1, c2, c3, c4, c5 };
  }

  private parseBpTempCompRaw(payload: Uint8Array): number | null {
    if (!payload || payload.length < 3) return null;
    if ((payload[0] & 0xff) !== 0x02) return null;
    return (payload[1] & 0xff) + ((payload[2] & 0xff) << 8);
  }

  private convertRawBpSamplesToPseudoMmHg(rawSamples: number[]): number[] {
    const out: number[] = [];

    for (const raw of rawSamples) {
      const idx = this.bpRawSampleIndex;

      // Native BpTask behavior:
      // - first 30 samples establish baseline
      // - samples 10..29 contribute to p
      // - when idx == 30, h = p / 20
      if (idx < 30) {
        if (idx > 9) {
          this.bpBaselineAccumulator += raw;
        }
        this.bpRawBaseline = raw;
      } else if (idx === 30) {
        this.bpRawBaseline = Math.round(this.bpBaselineAccumulator / 20);
      }

      const delta = Math.abs(raw - this.bpRawBaseline);

      // Dynamic normalization:
      // native uses this.i * abs(raw - h) / 2^16 to emit cuff pressure.
      // We do not have exact JNI parity, so normalize deltas into 0..260 mmHg.
      if (idx >= 30 && delta > this.bpRawDeltaPeak) {
        this.bpRawDeltaPeak = delta;
      }

      const pseudoMmHg =
        idx < 30
          ? 0
          : Math.max(
              0,
              Math.min(300, Math.round((delta / Math.max(this.bpRawDeltaPeak, 1)) * 260)),
            );

      out.push(pseudoMmHg);
      this.bpRawSampleIndex += 1;
    }

    return out;
  }

  private buildBpDeflationAxis(rawSamples: number[]): number[] {
    if (rawSamples.length === 0) return [];

    const usableStart = Math.min(
      Math.max(30, Math.floor(rawSamples.length * 0.05)),
      rawSamples.length - 1,
    );
    const usableEnd = rawSamples.length - 1;
    const count = Math.max(1, usableEnd - usableStart + 1);

    const out = new Array<number>(rawSamples.length).fill(0);

    // Broad descending cuff-pressure axis across the whole usable measurement window.
    for (let i = usableStart; i <= usableEnd; i++) {
      const t = (i - usableStart) / Math.max(1, count - 1);
      out[i] = 180 - t * 140; // 180 -> 40 mmHg
    }

    for (let i = 0; i < usableStart; i++) {
      out[i] = 180;
    }

    return out;
  }

  private buildBpOscillationEnvelope(rawSamples: number[]): number[] {
    if (rawSamples.length === 0) return [];

    // Remove slow trend from raw sensor values, then smooth absolute residual.
    const baseline = this.smoothSeries(rawSamples, 21);
    const residual = rawSamples.map((v, i) => Math.abs(v - baseline[i]));
    return this.smoothSeries(residual, BP_ENVELOPE_SMOOTH_WINDOW);
  }

  private smoothSeries(values: number[], window: number): number[] {
    if (values.length === 0) return [];
    const out = new Array<number>(values.length);
    const half = Math.max(1, Math.floor(window / 2));

    for (let i = 0; i < values.length; i++) {
      let sum = 0;
      let count = 0;
      const start = Math.max(0, i - half);
      const end = Math.min(values.length - 1, i + half);
      for (let j = start; j <= end; j++) {
        sum += values[j];
        count += 1;
      }
      out[i] = count > 0 ? sum / count : values[i];
    }

    return out;
  }

  private systolicRatioForPressure(pressureMmHg: number, wrist: boolean): number {
    const p = Math.round(pressureMmHg * 100);

    if (wrist) {
      const i = Math.floor(p / 100);
      if (i > 200) return 0.8;
      if (i > 150) return 0.82;
      if (i > 135) return 0.85;
      if (i > 120) return 0.88;
      if (i > 110) return 0.94;
      if (i > 90) return 0.96;
      if (i > 70) return 0.9;
      return 0.85;
    }

    const i = Math.floor(p / 100);
    if (i > 200) return 0.54;
    if (i > 150) return 0.55;
    if (i > 135) return 0.58;
    if (i > 120) return 0.6;
    if (i > 110) return 0.7;
    if (i > 90) return 0.74;
    if (i > 70) return 0.72;
    return 0.65;
  }

  private diastolicRatioForPressure(pressureMmHg: number, wrist: boolean): number {
    const p = Math.round(pressureMmHg * 100);
    const i = Math.floor(p / 100);

    if (wrist) {
      if (i > 180) return 0.4;
      if (i > 140) return 0.45;
      if (i > 120) return 0.5;
      if (i > 100) return 0.48;
      if (i > 90) return ((100 - (i - 90)) * 0.6) / 100.0;
      if (i > 60) return 0.55;
      if (i <= 50) return 0.38;
      return 0.45;
    }

    if (i > 180) return 0.6;
    if (i > 140) return 0.65;
    if (i > 120) return 0.65;
    if (i > 100) return 0.6160000000000001;
    if (i > 90) return ((100 - (i - 90)) * 0.77) / 100.0;
    if (i > 60) return 0.7;
    if (i <= 50) return 0.5;
    return 0.6;
  }

  private deriveBpBeats(rawSamples: number[], pressureAxis: number[]) {
    const envelope = this.buildBpOscillationEnvelope(rawSamples);

    const beatIndices: number[] = [];
    const beatPressures: number[] = [];
    const beatAmplitudes: number[] = [];

    if (envelope.length < 3) {
      return { beatIndices, beatPressures, beatAmplitudes };
    }

    let maxAmp = 0;
    for (const v of envelope) {
      if (v > maxAmp) maxAmp = v;
    }

    const ampFloor = Math.max(
      BP_MIN_ENVELOPE_AMPLITUDE,
      maxAmp * BP_MIN_ENVELOPE_RELATIVE,
    );

    let lastAccepted = -BP_MIN_BEAT_GAP_SAMPLES;

    for (let i = 1; i < envelope.length - 1; i++) {
      const amp = envelope[i];
      if (amp < ampFloor) continue;
      if (i - lastAccepted < BP_MIN_BEAT_GAP_SAMPLES) continue;

      const isLocalPeak = envelope[i] >= envelope[i - 1] && envelope[i] > envelope[i + 1];
      if (!isLocalPeak) continue;

      const pressure = pressureAxis[i];
      if (
        !Number.isFinite(pressure) ||
        pressure < BP_MIN_REASONABLE_PRESSURE ||
        pressure > BP_MAX_REASONABLE_PRESSURE
      ) {
        continue;
      }

      beatIndices.push(i);
      beatPressures.push(pressure);
      beatAmplitudes.push(amp);
      lastAccepted = i;
    }

    console.info('[HealthMonitorBridge] deriveBpBeats_stats', {
      envelopeLength: envelope.length,
      maxAmp,
      ampFloor,
      acceptedBeats: beatIndices.length,
      minGap: BP_MIN_BEAT_GAP_SAMPLES,
    });

    return { beatIndices, beatPressures, beatAmplitudes };
  }

  private computePulseFromBeatIndices(indices: number[]): number | null {
    if (indices.length < 3) return null;

    const diffs: number[] = [];
    for (let i = 1; i < indices.length; i++) {
      const d = indices[i] - indices[i - 1];
      if (d > 0) diffs.push(d);
    }

    if (diffs.length === 0) return null;

    diffs.sort((a, b) => a - b);
    const median = diffs[Math.floor(diffs.length / 2)];
    if (!Number.isFinite(median) || median <= 0) return null;

    const bpm = Math.round(5860 / median);
    if (bpm < 25 || bpm > 180) return null;
    return bpm;
  }

  private isFiniteBpPressure(value: number | null | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  }

  private clampBpValue(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  private estimateBpFromPartialThresholds(opts: {
    mapPressure: number;
    sbpPressure: number | null;
    dbpPressure: number | null;
    beatPressures: number[];
    peakIdx: number;
  }): { systolic: number; diastolic: number; fallbackReason: string } | null {
    const mapPressure = opts.mapPressure;
    if (!Number.isFinite(mapPressure) || mapPressure < 45 || mapPressure > 180) {
      return null;
    }

    const prePeakPressures = opts.beatPressures
      .slice(0, Math.max(0, opts.peakIdx))
      .filter((value) => this.isFiniteBpPressure(value));

    const postPeakPressures = opts.beatPressures
      .slice(opts.peakIdx + 1)
      .filter((value) => this.isFiniteBpPressure(value));

    const observedHigh = prePeakPressures.length ? Math.max(...prePeakPressures) : null;
    const observedLow = postPeakPressures.length ? Math.min(...postPeakPressures) : null;

    let systolic = this.isFiniteBpPressure(opts.sbpPressure) ? opts.sbpPressure : null;
    let diastolic = this.isFiniteBpPressure(opts.dbpPressure) ? opts.dbpPressure : null;

    const reasons: string[] = [];

    if (systolic == null) {
      if (observedHigh != null && observedHigh > mapPressure + 8) {
        systolic = observedHigh;
        reasons.push('systolic_from_pre_peak_pressure');
      } else {
        reasons.push('systolic_from_map_pressure');
      }
    }

    if (diastolic == null) {
      if (observedLow != null && observedLow < mapPressure - 8) {
        diastolic = observedLow;
        reasons.push('diastolic_from_post_peak_pressure');
      } else {
        reasons.push('diastolic_from_map_pressure');
      }
    }

    if (systolic == null && diastolic == null) {
      const pulsePressure = this.clampBpValue(mapPressure * 0.5, 30, 80);
      systolic = mapPressure + (2 * pulsePressure) / 3;
      diastolic = mapPressure - pulsePressure / 3;
    } else if (systolic != null && diastolic == null) {
      diastolic = (3 * mapPressure - systolic) / 2;
    } else if (systolic == null && diastolic != null) {
      systolic = 3 * mapPressure - 2 * diastolic;
    }

    if (systolic == null || diastolic == null) {
      return null;
    }

    systolic = Math.round(this.clampBpValue(systolic, 70, 240));
    diastolic = Math.round(this.clampBpValue(diastolic, 35, 150));

    const pulsePressure = systolic - diastolic;

    if (pulsePressure > 95) {
      diastolic = Math.round(this.clampBpValue(systolic - 95, 35, 150));
    }

    if (systolic <= diastolic || systolic - diastolic < 10) {
      const pulsePressureFromMap = this.clampBpValue(mapPressure * 0.45, 30, 80);
      systolic = Math.round(this.clampBpValue(mapPressure + (2 * pulsePressureFromMap) / 3, 70, 240));
      diastolic = Math.round(this.clampBpValue(mapPressure - pulsePressureFromMap / 3, 35, 150));
    }

    if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) return null;
    if (systolic <= diastolic || systolic - diastolic < 10) return null;

    return {
      systolic,
      diastolic,
      fallbackReason: reasons.join('+') || 'partial_threshold_fallback',
    };
  }

  private decodeOx24(b0: number, b1: number, b2: number): number {
    return ((b0 & 0xff) << 16) | ((b1 & 0xff) << 8) | (b2 & 0xff);
  }

  private extractSdkOxPayload(rawLike: ArrayLike<number> | null | undefined): number[] | null {
    if (!rawLike) return null;

    const raw = Array.from(rawLike, (v) => Number(v) & 0xff);
    if (raw.length !== 20) return null;

    // Android SDK Communicate routes Linktop Ox packets before normal module routing:
    //   0x84 / 0x87 head packets -> bytes 6..19, length 14
    //   continuation/tail packets -> bytes 0..15, length 16
    if (raw[0] === 2 && raw[3] === 4 && (raw[4] === 0x84 || raw[4] === 0x87)) {
      return raw.slice(6, 20);
    }

    if (raw[16] === 0 && (raw[19] === 0xff || (raw[18] === 0xff && raw[19] === 0))) {
      return raw.slice(0, 16);
    }

    return null;
  }

  private consumeSdkOxPayload(payload: number[], recordedAt: string): number {
    if (!payload.length) return 0;

    this.spo2OxRemainder.push(...payload.map((v) => Number(v) & 0xff));

    let samples = 0;
    while (this.spo2OxRemainder.length >= 6) {
      const chunk = this.spo2OxRemainder.splice(0, 6);
      const red = this.decodeOx24(chunk[0], chunk[1], chunk[2]);
      const ir = this.decodeOx24(chunk[3], chunk[4], chunk[5]);

      this.ingestSpo2IrSample(ir, recordedAt);
      samples += 1;

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('iomt:ppg-sample', {
            detail: {
              deviceId: DEVICE_ID,
              timestamp: recordedAt,
              sampleHz: 125,
              red,
              ir,
            },
          }),
        );
      }
    }

    if (this.spo2OxRemainder.length > 5) {
      this.spo2OxRemainder = this.spo2OxRemainder.slice(-5);
    }

    return samples;
  }

  private consumeSdkOxFrame(rawLike: ArrayLike<number> | null | undefined, recordedAt: string): number {
    const payload = this.extractSdkOxPayload(rawLike);
    if (!payload) return 0;
    return this.consumeSdkOxPayload(payload, recordedAt);
  }

  private consumeFallbackPpgSamples(samples: ArrayLike<number> | null | undefined, recordedAt: string): number {
    if (!samples) return 0;

    let count = 0;
    for (const value of Array.from(samples)) {
      const sample = Number(value);
      if (!Number.isFinite(sample)) continue;
      this.ingestSpo2IrSample(Math.round(sample), recordedAt);
      count += 1;
    }

    return count;
  }

  private ingestSpo2IrSample(ir: number, recordedAt: string) {
    if (!Number.isFinite(ir)) return;

    this.spo2IrSamples.push(ir);
    this.spo2SampleIndex += 1;

    // Keep enough history for the SDK-shaped 81-sample moving baseline while bounding memory.
    if (this.spo2IrSamples.length > 750) {
      this.spo2IrSamples.shift();
    }

    if (this.spo2IrSamples.length < 81) return;

    const tail = this.spo2IrSamples.slice(-81);
    const mean = tail.reduce((sum, value) => sum + value, 0) / tail.length;
    const centre = tail[40];
    const ac = centre - mean;
    const acIndex = this.spo2SampleIndex - 41;

    const sign = ac > 0 ? 1 : ac < 0 ? -1 : this.spo2AcSign;

    if (this.spo2AcSign !== 0 && sign !== this.spo2AcSign) {
      if (this.spo2AcSign === 1 && sign === -1 && this.spo2PositiveRun.length > 22) {
        let peak = this.spo2PositiveRun[0];
        for (const point of this.spo2PositiveRun) {
          if (point.value > peak.value) peak = point;
        }
        this.acceptSpo2Peak(peak.index, recordedAt);
      }

      this.spo2PositiveRun = [];
    }

    if (sign === 1) {
      this.spo2PositiveRun.push({ index: acIndex, value: ac });
    }

    this.spo2AcSign = sign;
  }

  private acceptSpo2Peak(index: number, recordedAt: string) {
    const last = this.spo2PeakIndices[this.spo2PeakIndices.length - 1];

    if (last != null) {
      const interval = index - last;

      if (interval < 38) {
        return;
      }

      if (interval > 260) {
        this.spo2PeakIndices = [index];
        return;
      }
    }

    this.spo2PeakIndices.push(index);
    if (this.spo2PeakIndices.length > 8) {
      this.spo2PeakIndices = this.spo2PeakIndices.slice(-8);
    }

    if (this.spo2PeakIndices.length < 3) return;

    const intervals: number[] = [];
    for (let i = 1; i < this.spo2PeakIndices.length; i++) {
      const interval = this.spo2PeakIndices[i] - this.spo2PeakIndices[i - 1];
      if (interval >= 38 && interval <= 260) intervals.push(interval);
    }

    if (intervals.length < 2) return;

    intervals.sort((a, b) => a - b);
    const median = intervals[Math.floor(intervals.length / 2)];
    const pulse = Math.round((60 * 125) / median);

    if (!Number.isFinite(pulse) || pulse < 30 || pulse > 220) return;

    const nowMs = Date.now();
    const changed = this.spo2LastPulse == null || Math.abs(this.spo2LastPulse - pulse) >= 2;
    const elapsed = nowMs - this.spo2PulseLastEmittedAt;

    this.spo2LastPulse = pulse;

    if (changed || elapsed > 2000) {
      this.spo2PulseLastEmittedAt = nowMs;
      this.opts?.onDeviceEvent?.({
        type: 'spo2_result',
        spo2: this.spo2LastSpo2,
        pulse,
        pi: null,
        recordedAt,
        estimatedFrom: 'ppg_wave',
      } as any);
    }
  }

  private convertBtRawToCelsius(raw: number): number {
    return raw * 0.02 - 273.15;
  }

  private reduceBtRawWindow(values: number[]): number | null {
    if (values.length < 6) return null;

    const tail = values.slice(2).sort((a, b) => a - b);
    if (tail.length === 0) return null;

    const idx = Math.floor((tail.length - 1) / 2);
    return tail[idx] ?? null;
  }

  private parseBtRawPairFrame(payload: Uint8Array): {
    bodyCandidateA: number;
    ambientCandidateA: number;
    bodyCandidateB: number;
    ambientCandidateB: number;
  } | null {
    if (!payload || payload.length < 8) return null;

    const v1 = ((payload[1] & 0xff) << 8) | (payload[0] & 0xff);
    const v2 = ((payload[3] & 0xff) << 8) | (payload[2] & 0xff);
    const v3 = ((payload[5] & 0xff) << 8) | (payload[4] & 0xff);
    const v4 = ((payload[7] & 0xff) << 8) | (payload[6] & 0xff);

    return {
      bodyCandidateA: v1,
      ambientCandidateA: v2,
      bodyCandidateB: v3,
      ambientCandidateB: v4,
    };
  }

  private estimateBodyTempFromSdkInputs(ambientC: number, objectC: number): number {
    // Conservative placeholder, not native-parity.
    // Keeps result bounded and avoids fake extreme jumps.
    const raw = objectC + 0.35 * (objectC - ambientC);
    return Math.round(raw * 10) / 10;
  }

  private async handleTempBtPayload(payload: Uint8Array): Promise<boolean> {
    const frame = this.parseBtRawPairFrame(payload);
    if (!frame) return false;
    if (this.mode !== 'temp') return true;

    this.noteGenericSignal(this.tempState);

    this.tempBtAlgo.ambientRaw.push(frame.ambientCandidateA, frame.ambientCandidateB);
    this.tempBtAlgo.bodyRaw.push(frame.bodyCandidateA, frame.bodyCandidateB);

    const ambientRaw = this.reduceBtRawWindow(this.tempBtAlgo.ambientRaw);
    const bodyRaw = this.reduceBtRawWindow(this.tempBtAlgo.bodyRaw);

    if (ambientRaw == null || bodyRaw == null || this.tempBtAlgo.finalEmitted) {
      return true;
    }

    const ambientC = this.convertBtRawToCelsius(ambientRaw);
    const objectC = this.convertBtRawToCelsius(bodyRaw);

    // Placeholder until native TempTranslate parity is available.
    // Keep this conservative and explicit.
    const estimatedBodyC = this.estimateBodyTempFromSdkInputs(ambientC, objectC);

    this.tempBtAlgo.finalEmitted = true;
    this.tempLastCelsius = estimatedBodyC;
    this.tempLastFahrenheit = (estimatedBodyC * 9) / 5 + 32;

    const recordedAt = new Date().toISOString();

    await this.opts.emitVital({
      type: 'temperature',
      recorded_at: recordedAt,
      deviceId: DEVICE_ID,
      payload: {
        celsius: this.tempLastCelsius,
        fahrenheit: this.tempLastFahrenheit,
        unit: 'C',
      },
      meta: {
        source: 'ble',
        route: 'bt-task-shaped',
        authoritative: false,
        algorithm: 'bt-js-shaped',
        ambientC,
        objectC,
      },
    });

    this.opts?.onDeviceEvent?.({
      type: 'temp_result',
      celsius: this.tempLastCelsius,
      fahrenheit: this.tempLastFahrenheit,
    });

    await this.finishTempCycle('result_received');
    return true;
  }

  private computeBpFromPressureSeries(_: number[]): BpComputedResult | null {
    const raw = this.bpAlgo.rawSamples;
    if (raw.length < BP_MIN_PRESSURE_SAMPLES_FOR_COMPLETE) return null;

    const axis = this.buildBpDeflationAxis(raw);

    const usableStart = Math.min(
      Math.max(30, Math.floor(raw.length * 0.05)),
      raw.length - 1,
    );

    const rawWorking = raw.slice(usableStart);
    const axisWorking = axis.slice(usableStart);

    const { beatIndices, beatPressures, beatAmplitudes } =
      this.deriveBpBeats(rawWorking, axisWorking);

    this.bpAlgo.beatIndices = beatIndices.map((i) => i + usableStart);
    this.bpAlgo.beatPressures = beatPressures;
    this.bpAlgo.beatAmplitudes = beatAmplitudes;

    if (beatIndices.length < BP_MIN_BEATS_FOR_RESULT) return null;

    // Avoid choosing a peak too close to either edge.
    let peakIdx = -1;
    let peakAmplitude = -Infinity;

    for (
      let i = BP_PEAK_SEARCH_EDGE_GUARD;
      i < beatAmplitudes.length - BP_PEAK_SEARCH_EDGE_GUARD;
      i++
    ) {
      if (beatAmplitudes[i] > peakAmplitude) {
        peakAmplitude = beatAmplitudes[i];
        peakIdx = i;
      }
    }

    if (peakIdx < 0) {
      for (let i = 0; i < beatAmplitudes.length; i++) {
        if (beatAmplitudes[i] > peakAmplitude) {
          peakAmplitude = beatAmplitudes[i];
          peakIdx = i;
        }
      }
    }

    if (peakIdx < 0) return null;

    const mapPressure = beatPressures[peakIdx];
    if (!Number.isFinite(mapPressure) || mapPressure <= 0) return null;

    const sysRatio = this.systolicRatioForPressure(mapPressure, this.bpMeasureWrist);
    const diaRatio = this.diastolicRatioForPressure(mapPressure, this.bpMeasureWrist);

    const sysTarget = peakAmplitude * sysRatio;
    const diaTarget = peakAmplitude * diaRatio;

    let sbpPressure: number | null = null;
    for (let i = 0; i < peakIdx; i++) {
      if (beatAmplitudes[i] >= sysTarget) {
        sbpPressure = beatPressures[i];
        break;
      }
    }

    let dbpPressure: number | null = null;
    for (let i = peakIdx + 1; i < beatAmplitudes.length; i++) {
      if (beatAmplitudes[i] <= diaTarget) {
        dbpPressure = beatPressures[i];
        break;
      }
    }

    let confidence: BpComputedResult['confidence'] = 'threshold';
    let algorithm: BpComputedResult['algorithm'] = 'bp-js-native-shaped';
    let fallbackReason: string | null = null;

    if (sbpPressure == null || dbpPressure == null) {
      const fallback = this.estimateBpFromPartialThresholds({
        mapPressure,
        sbpPressure,
        dbpPressure,
        beatPressures,
        peakIdx,
      });

      console.warn('[HealthMonitorBridge] bp_threshold_crossing_failed', {
        peakIdx,
        peakAmplitude,
        mapPressure,
        sysTarget,
        diaTarget,
        prePeakCount: peakIdx,
        postPeakCount: beatAmplitudes.length - peakIdx - 1,
        prePeakPressures: beatPressures.slice(Math.max(0, peakIdx - 10), peakIdx),
        prePeakAmplitudes: beatAmplitudes.slice(Math.max(0, peakIdx - 10), peakIdx),
        postPeakPressures: beatPressures.slice(peakIdx + 1, Math.min(beatPressures.length, peakIdx + 11)),
        postPeakAmplitudes: beatAmplitudes.slice(peakIdx + 1, Math.min(beatAmplitudes.length, peakIdx + 11)),
        fallback,
      });

      if (!fallback) return null;

      sbpPressure = fallback.systolic;
      dbpPressure = fallback.diastolic;
      confidence = 'partial_threshold_fallback';
      algorithm = 'bp-js-native-shaped-partial-threshold';
      fallbackReason = fallback.fallbackReason;
    }

    const systolic = Math.round(sbpPressure);
    const diastolic = Math.round(dbpPressure);

    if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) return null;
    if (systolic <= diastolic || systolic - diastolic < 10) return null;

    const pulse = this.computePulseFromBeatIndices(beatIndices);

    return {
      systolic,
      diastolic,
      pulse,
      map: Math.round(mapPressure),
      beatCount: beatIndices.length,
      peakAmplitude,
      mapPressure,
      confidence,
      algorithm,
      fallbackReason,
    };
  }

  private async finalizeBpAndEmit(reason: BpCycleReason) {
    if (this.bpAlgo.finalized) return;
    this.bpAlgo.finalized = true;

    const result = this.computeBpFromPressureSeries(this.bpAlgo.scaledPressures);

    if (result) {
      const recordedAt = new Date().toISOString();

      await this.opts.emitVital({
        type: 'blood_pressure',
        recorded_at: recordedAt,
        deviceId: DEVICE_ID,
        payload: {
          systolic: result.systolic,
          diastolic: result.diastolic,
          pulse: result.pulse,
          map: result.map,
          unit: 'mmHg',
        },
        meta: {
          source: 'ble',
          route: 'vendor_notify',
          authoritative: false,
          algorithm: result.algorithm,
          confidence: result.confidence,
          fallbackReason: result.fallbackReason ?? null,
          beatCount: result.beatCount,
          mapPressure: result.mapPressure,
          peakAmplitude: result.peakAmplitude,
        },
      });

      if (typeof result.pulse === 'number') {
        await this.opts.emitVital({
          type: 'heart_rate',
          recorded_at: recordedAt,
          deviceId: DEVICE_ID,
          payload: {
            hr: result.pulse,
            unit: 'bpm',
          },
          meta: {
            source: 'ble',
            parent: 'blood_pressure',
            authoritative: false,
            algorithm: result.algorithm,
            parentConfidence: result.confidence,
          },
          dedupeKey: 'hr',
        });
      }

      this.opts?.onDeviceEvent?.({
        type: 'bp_result',
        systolic: result.systolic,
        diastolic: result.diastolic,
        pulse: result.pulse,
        map: result.map,
      });

      await this.finishBpCycle('bp_result_received');
      return;
    }

    console.warn('[HealthMonitorBridge] bp_finalize_failed', {
      rawCount: this.bpAlgo.rawSamples.length,
      scaledCount: this.bpAlgo.scaledPressures.length,
      peakRaw: this.bpAlgo.rawSamples.length ? Math.max(...this.bpAlgo.rawSamples) : null,
      minRaw: this.bpAlgo.rawSamples.length ? Math.min(...this.bpAlgo.rawSamples) : null,
      peakScaled: this.bpAlgo.scaledPressures.length ? Math.max(...this.bpAlgo.scaledPressures) : null,
      minScaled: this.bpAlgo.scaledPressures.length ? Math.min(...this.bpAlgo.scaledPressures) : null,
      usableStart: Math.min(Math.max(30, Math.floor(this.bpAlgo.rawSamples.length * 0.05)), this.bpAlgo.rawSamples.length - 1),
      beatCount: this.bpAlgo.beatIndices.length,
      beatPressures: this.bpAlgo.beatPressures.slice(0, 20),
      beatAmplitudes: this.bpAlgo.beatAmplitudes.slice(0, 20),
      rawHead: this.bpAlgo.rawSamples.slice(0, 20),
      rawTail: this.bpAlgo.rawSamples.slice(-20),
    });

    this.opts?.onDeviceEvent?.({
      type: 'bp_error',
      reason: 'bp_finalize_failed',
    });

    await this.finishBpCycle(reason);
  }

  private noteGenericSignal(state: GenericMeasureState, idleMs?: number, onIdle?: () => void) {
    state.lastSignalAt = Date.now();
    if (state.idleTimer) clearTimeout(state.idleTimer);
    if (idleMs && onIdle) {
      state.idleTimer = setTimeout(onIdle, idleMs);
    }
  }

  private startGenericTimeout(state: GenericMeasureState, ms: number, onTimeout: () => void) {
    this.resetGenericState(state);
    state.startedAt = Date.now();
    state.lastSignalAt = state.startedAt;
    state.timeoutTimer = setTimeout(onTimeout, ms);
  }

  private shouldAcceptDecodedKind(
    kind:
      | 'bp_result'
      | 'spo2_result'
      | 'temperature_result'
      | 'glucose_result'
      | 'battery'
      | 'ecg_wave'
      | 'ppg_wave'
      | 'ack'
      | 'unknown',
  ): boolean {
    switch (this.mode) {
      case 'bp':
        return kind === 'bp_result' || kind === 'battery' || kind === 'ack' || kind === 'unknown';
      case 'spo2':
        return kind === 'spo2_result' || kind === 'ppg_wave' || kind === 'battery' || kind === 'ack' || kind === 'unknown';
      case 'temp':
        return kind === 'temperature_result' || kind === 'battery' || kind === 'ack' || kind === 'unknown';
      case 'glucose':
        return kind === 'glucose_result' || kind === 'battery' || kind === 'ack' || kind === 'unknown';
      case 'ecg':
        return kind === 'ecg_wave' || kind === 'battery' || kind === 'ack' || kind === 'unknown';
      case 'idle':
      default:
        return true;
    }
  }

  private stopOpForMode(mode: LinktopMeasurementMode): LinktopControlOp | null {
    switch (mode) {
      case 'bp':
        return 'stop_bp';
      case 'spo2':
        return 'stop_spo2';
      case 'temp':
        return 'stop_temp';
      case 'glucose':
        return 'stop_glucose';
      case 'ecg':
        return 'stop_ecg';
      case 'idle':
      default:
        return null;
    }
  }

  private async sendStopCommandForMode(
    mode: LinktopMeasurementMode,
    context: string,
    opts?: { respectCooldown?: boolean },
  ) {
    if (this.nativeMode) return;
    if (!this.conn || !this.controlCharKey) return;

    const op = this.stopOpForMode(mode);
    if (!op) return;

    const respectCooldown = opts?.respectCooldown ?? false;
    const now = Date.now();
    const last = this.lastStopCommandAt[op] ?? 0;

    if (respectCooldown && now - last < STOP_COMMAND_COOLDOWN_MS) {
      return;
    }

    try {
      this.lastStopCommandAt[op] = now;
      await this.sendControl(op);
    } catch (err) {
      console.warn(`[HealthMonitorBridge] ${op} during ${context} failed`, err);
    }
  }

  private async stopActiveMeasurementForHandoff(nextMode: Exclude<LinktopMeasurementMode, 'idle'>) {
    if (this.nativeMode) return;
    if (this.mode === 'idle') return;
    if (this.mode === nextMode) {
      await this.sendStopCommandForMode(this.mode, `restart-handoff:${nextMode}`, {
        respectCooldown: false,
      });
      this.resetModeState(this.mode);
      this.mode = 'idle';
      await this.sleep(MODE_HANDOFF_SETTLE_MS);
      return;
    }

    const previousMode = this.mode;
    await this.sendStopCommandForMode(previousMode, `mode-handoff:${previousMode}->${nextMode}`, {
      respectCooldown: false,
    });
    this.resetModeState(previousMode);
    this.mode = 'idle';
    await this.sleep(MODE_HANDOFF_SETTLE_MS);
  }

  private async prepareForModeStart(nextMode: Exclude<LinktopMeasurementMode, 'idle'>) {
    if (!this.nativeMode) {
      await this.stopActiveMeasurementForHandoff(nextMode);
    }
  }

  private resetModeState(mode: LinktopMeasurementMode) {
    switch (mode) {
      case 'bp':
        this.resetBpBootstrap();
        break;
      case 'spo2':
        this.resetSpo2State();
        break;
      case 'temp':
        this.resetTempState();
        break;
      case 'glucose':
        this.resetGlucoseState();
        break;
      case 'ecg':
        this.resetEcgState();
        break;
      case 'idle':
      default:
        break;
    }
  }

  private async bindNativeAndroid() {
    await this.clearNativeListeners();

    const on = async (event: string, fn: (payload: any) => void) => {
      const handle = await NativeHealthMonitor.addListener(event, fn);
      this.nativeListeners.push(handle);
    };

    await on('sdkError', (payload) => {
      const data = this.unwrapNativeData(payload);
      console.warn('[HealthMonitorBridge/native] sdkError', data);
      this.opts?.onDeviceEvent?.({
        type: 'bp_error',
        reason: data?.message || 'native_sdk_error',
      });
    });

    await on('bleState', (payload) => {
      const data = this.unwrapNativeData(payload);
      console.info('[HealthMonitorBridge/native] bleState', data);
    });

    await on('scanResult', async (payload) => {
      const data = this.unwrapNativeData(payload);
      const mac = String(data?.mac || '').trim();
      if (!mac) return;

      this.nativeSeenMacs.add(mac);

      if (!this.nativeConnectIssued) {
        this.nativeConnectIssued = true;
        try {
          await NativeHealthMonitor.stopScan();
        } catch {}
        try {
          await NativeHealthMonitor.connect({ mac });
        } catch (err) {
          console.warn('[HealthMonitorBridge/native] connect failed', err);
          this.nativeConnectIssued = false;
        }
      }
    });

    await on('connected', (payload) => {
      const data = this.unwrapNativeData(payload);
      this.nativeConnected = true;
      this.telemetry({ connected: true });
      console.info('[HealthMonitorBridge/native] connected', data);
    });

    await on('disconnected', (payload) => {
      const data = this.unwrapNativeData(payload);
      this.nativeConnected = false;
      this.telemetry({ connected: false });
      console.info('[HealthMonitorBridge/native] disconnected', data);
    });

    await on('bpPressure', (payload) => {
      const data = this.unwrapNativeData(payload);
      const pressure = Number(data?.pressure);
      if (!Number.isFinite(pressure)) return;

      this.bpLatestPressure = pressure;
      if (this.bpPeakPressure == null || pressure > this.bpPeakPressure) {
        this.bpPeakPressure = pressure;
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('iomt:bp_pressure', {
            detail: {
              deviceId: DEVICE_ID,
              timestamp: new Date().toISOString(),
              latestPressure: pressure,
              peakPressure: this.bpPeakPressure,
              samples: [pressure],
              raw: [],
              pressureFrames: this.bpPressureFrames,
              pressureSamplesSeen: this.bpPressureSamplesSeen + 1,
              stage: 'native-android',
            },
          }),
        );
      }

      this.bpPressureFrames += 1;
      this.bpPressureSamplesSeen += 1;
    });

    await on('bpResult', async (payload) => {
      const data = this.unwrapNativeData(payload);
      const systolic = Number(data?.systolic);
      const diastolic = Number(data?.diastolic);
      const pulse = Number(data?.pulse);

      if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) return;

      const recordedAt = new Date().toISOString();

      await this.opts.emitVital({
        type: 'blood_pressure',
        recorded_at: recordedAt,
        deviceId: DEVICE_ID,
        payload: {
          systolic,
          diastolic,
          pulse: Number.isFinite(pulse) ? pulse : null,
          map: null,
          unit: 'mmHg',
        },
        meta: {
          source: 'native-android',
          authoritative: true,
        },
      });

      if (Number.isFinite(pulse)) {
        await this.opts.emitVital({
          type: 'heart_rate',
          recorded_at: recordedAt,
          deviceId: DEVICE_ID,
          payload: {
            hr: pulse,
            unit: 'bpm',
          },
          meta: {
            source: 'native-android',
            parent: 'blood_pressure',
            authoritative: false,
          },
          dedupeKey: 'hr',
        });
      }

      this.opts?.onDeviceEvent?.({
        type: 'bp_result',
        systolic,
        diastolic,
        pulse: Number.isFinite(pulse) ? pulse : null,
        map: null,
      });
    });

    await on('bpResultError', () => {
      this.opts?.onDeviceEvent?.({
        type: 'bp_error',
        reason: 'bp_result_error',
      });
    });

    await on('bpLeakError', (payload) => {
      const data = this.unwrapNativeData(payload);
      const errorType = Number(data?.errorType);
      this.opts?.onDeviceEvent?.({
        type: 'bp_error',
        reason:
          errorType === 0
            ? 'cuff_leak_or_air_path_issue'
            : errorType === 1
              ? 'motion_or_noisy_measurement'
              : 'bp_leak_error',
      });
    });
  }

  async connect(opts: BridgeOpts) {
    this.opts = opts;

    if (this.nativeMode) {
      this.nativeSeenMacs.clear();
      this.nativeConnectIssued = false;
      this.nativeConnected = false;
      this.nativeScanStarted = false;
      this.resetBpBootstrap();
      this.resetSpo2State();
      this.resetTempState();
      this.resetGlucoseState();
      this.resetEcgState();

      await this.bindNativeAndroid();
      await NativeHealthMonitor.askPermissions();
      await NativeHealthMonitor.setMeasurePosition({ wrist: false });
      await NativeHealthMonitor.startScan();
      this.nativeScanStarted = true;
      this.telemetry({ connected: false, batteryPct: null, rssi: null });
      return;
    }

    this.conn = await connectDevice(DEVICE_ID);
    this.resolveAvailableCharacteristics();
    await this.bindBattery();
    await this.bindDataChannels();
    this.telemetry({ connected: true });
  }

  private resolveAvailableCharacteristics() {
    if (!this.conn) return;

    const chars = this.conn.chars;
    const has = (k: string) => !!chars?.get?.(k);

    const controlCandidates = [
      'vendor_ctrl',
      'ctrl',
      'write',
      'command',
      'tx',
      'uart_tx',
    ];

    const notifyCandidates = [
      'vendor_notify',
      'temp',
      'glucose',
      'therm_confirm',
      'notify',
      'rx',
      'uart_rx',
      'vendor_rx',
    ];

    const batteryCandidates = ['batt', 'battery'];

    this.controlCharKey = controlCandidates.find(has) ?? null;
    this.notifyCharKeys = notifyCandidates.filter(has);
    this.batteryCharKey = batteryCandidates.find(has) ?? null;

    if (typeof window !== 'undefined') {
      const available = Array.from(chars?.keys?.() ?? []);
      console.info('[HealthMonitorBridge] available chars:', available);
      console.info('[HealthMonitorBridge] controlCharKey:', this.controlCharKey);
      console.info('[HealthMonitorBridge] notifyCharKeys:', this.notifyCharKeys);
      console.info('[HealthMonitorBridge] batteryCharKey:', this.batteryCharKey);
    }
  }

  private async bindBattery() {
    if (!this.conn || !this.batteryCharKey) {
      this.telemetry({ connected: true, batteryPct: null, rssi: null });
      return;
    }

    try {
      const battChar = this.conn.chars?.get?.(this.batteryCharKey);
      if (battChar && 'readValue' in battChar && typeof battChar.readValue === 'function') {
        const v = await battChar.readValue();
        const pct = v.getUint8(0);
        if (pct >= 0 && pct <= 100) {
          this.telemetry({ connected: true, batteryPct: pct, rssi: null });
          return;
        }
      }
    } catch {}

    this.telemetry({ connected: true, batteryPct: null, rssi: null });
  }

  private async bindDataChannels() {
    if (!this.conn) return;

    const subscribe = this.conn.subscribe?.bind(this.conn);
    if (!subscribe) {
      throw new Error('HealthMonitorBridge requires a connection object with subscribe(charKey, cb)');
    }

    const uniqueKeys = Array.from(new Set(this.notifyCharKeys));

    for (const charKey of uniqueKeys) {
      try {
        const off = await subscribe(charKey, async (dv: DataView) => {
          await this.handleIncoming(charKey, dv);
        });
        this.unsub.push(off);
      } catch (err) {
        console.warn(`[HealthMonitorBridge] subscribe failed for ${charKey}`, err);
      }
    }
  }

  private dvToU8(dv: DataView): Uint8Array {
    return new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
  }

  private u8ToDv(u8: Uint8Array): DataView {
    return new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  }

  private clearBpSilenceTimer() {
    if (this.bpSilenceTimer) {
      clearTimeout(this.bpSilenceTimer);
      this.bpSilenceTimer = null;
    }
  }

  private clearBpPostCycleTimer() {
    if (this.bpPostCycleTimer) {
      clearTimeout(this.bpPostCycleTimer);
      this.bpPostCycleTimer = null;
    }
  }

  private clearBpTimers() {
    for (const t of this.bpFallbackTimers.splice(0)) {
      clearTimeout(t);
    }
    this.clearBpSilenceTimer();
    this.clearBpPostCycleTimer();
  }

  private resetBpBootstrap() {
    this.clearBpTimers();
    this.bpStage = 'idle';
    this.bpPressureFrames = 0;
    this.bpPressureSamplesSeen = 0;
    this.bpPressureTestStarted = false;
    this.bpPumpStartIssued = false;
    this.bpLastPressureAt = 0;
    this.bpLatestPressure = null;
    this.bpPeakPressure = null;
    this.bpCompletionEmitted = false;
    this.resetBpAlgo();
  }

  private scheduleBpFallbackChain() {
    this.clearBpTimers();

    this.bpFallbackTimers.push(
      setTimeout(() => {
        if (this.mode !== 'bp') return;
        if (this.bpStage === 'read_calibration') {
          this.bpStage = 'temp_compensate';
          void this.sendControl('bp_temp_compensate').catch((err) => {
            console.warn('[HealthMonitorBridge] fallback bp_temp_compensate failed', err);
          });
        }
      }, 300),
    );

    this.bpFallbackTimers.push(
      setTimeout(() => {
        if (this.mode !== 'bp') return;
        if (this.bpStage === 'temp_compensate' || this.bpStage === 'read_calibration') {
          this.bpStage = 'pressure_zero';
          void this.sendControl('bp_get_pressure_zero').catch((err) => {
            console.warn('[HealthMonitorBridge] fallback bp_get_pressure_zero failed', err);
          });
        }
      }, 650),
    );

    this.bpFallbackTimers.push(
      setTimeout(() => {
        if (this.mode !== 'bp') return;
        if (
          this.bpStage === 'pressure_zero' ||
          this.bpStage === 'pressure_stream' ||
          this.bpStage === 'temp_compensate'
        ) {
          this.bpStage = 'pressure_test';
          this.bpPressureTestStarted = true;
          void this.sendControl('bp_start_pressure_test').catch((err) => {
            console.warn('[HealthMonitorBridge] fallback bp_start_pressure_test failed', err);
          });
        }
      }, 1100),
    );

    this.bpFallbackTimers.push(
      setTimeout(() => {
        if (this.mode !== 'bp') return;
        if (!this.bpPumpStartIssued) {
          this.bpPumpStartIssued = true;
          this.bpStage = 'pump_started';
          void this.sendControl('bp_start_pwm_arm').catch((err) => {
            console.warn('[HealthMonitorBridge] fallback bp_start_pwm_arm failed', err);
          });
        }
      }, 1450),
    );
  }

  private parseBpPressureSamples(payload: Uint8Array): number[] {
    if (!payload || payload.length < 11) return [];
    if ((payload[0] & 0xff) !== 0x03) return [];

    const out: number[] = [];
    for (let i = 0; i < 5; i++) {
      const byteIndex = 1 + i * 2;
      const v = ((payload[byteIndex] & 0xff) << 8) | (payload[byteIndex + 1] & 0xff);
      out.push(v);
    }
    return out;
  }

  private dispatchBpPressure(samples: number[], payload: Uint8Array) {
    if (typeof window === 'undefined' || samples.length === 0) return;

    window.dispatchEvent(
      new CustomEvent('iomt:bp_pressure', {
        detail: {
          deviceId: DEVICE_ID,
          timestamp: new Date().toISOString(),
          latestPressure: samples[samples.length - 1] ?? null,
          peakPressure: this.bpPeakPressure,
          samples,
          raw: Array.from(payload),
          pressureFrames: this.bpPressureFrames,
          pressureSamplesSeen: this.bpPressureSamplesSeen,
          stage: this.bpStage,
          beatCount: this.bpAlgo.beatIndices.length,
        },
      }),
    );
  }

  private noteBpPressureActivity(samples: number[]) {
    if (samples.length === 0) return;

    this.bpLastPressureAt = Date.now();
    this.bpLatestPressure = samples[samples.length - 1] ?? null;

    for (const v of samples) {
      if (this.bpPeakPressure == null || v > this.bpPeakPressure) {
        this.bpPeakPressure = v;
      }
    }

    this.clearBpSilenceTimer();
    this.bpSilenceTimer = setTimeout(() => {
      void this.handleBpSilenceCompletion();
    }, BP_SILENCE_COMPLETE_MS);
  }

  private async handleBpSilenceCompletion() {
    if (this.mode !== 'bp') return;
    if (this.bpCompletionEmitted) return;

    const now = Date.now();
    const quietFor = now - this.bpLastPressureAt;

    if (quietFor < BP_SILENCE_COMPLETE_MS - 100) return;

    const enoughSignal =
      this.bpPressureFrames >= BP_MIN_PRESSURE_FRAMES_FOR_COMPLETE ||
      this.bpPressureSamplesSeen >= BP_MIN_PRESSURE_SAMPLES_FOR_COMPLETE;

    if (!enoughSignal) return;

    console.info('[HealthMonitorBridge] BP cycle silence-complete (native-like finalize)', {
      pressureFrames: this.bpPressureFrames,
      pressureSamplesSeen: this.bpPressureSamplesSeen,
      latestPressure: this.bpLatestPressure,
      peakPressure: this.bpPeakPressure,
      quietFor,
      waitMs: BP_POST_CYCLE_RESULT_WAIT_MS,
      algoSamples: this.bpAlgo.scaledPressures.length,
    });

    this.clearBpPostCycleTimer();
    this.bpPostCycleTimer = setTimeout(() => {
      void this.finalizeBpAndEmit('silence_after_pressure');
    }, BP_POST_CYCLE_RESULT_WAIT_MS);
  }

  private async finishBpCycle(reason: BpCycleReason) {
    if (this.bpCompletionEmitted) return;
    this.bpCompletionEmitted = true;

    this.clearBpTimers();

    if (!this.nativeMode && this.controlCharKey && this.mode === 'bp') {
      await this.sendStopCommandForMode('bp', `finishBpCycle:${reason}`, {
        respectCooldown: reason === 'manual_stop',
      });
    }

    this.opts?.onDeviceEvent?.({
      type: 'bp_cycle_complete',
      reason,
      pressureFrames: this.bpPressureFrames,
      pressureSamplesSeen: this.bpPressureSamplesSeen,
      latestPressure: this.bpLatestPressure,
      peakPressure: this.bpPeakPressure,
    });

    this.resetBpBootstrap();
    this.mode = 'idle';
  }

  private async finishSpo2Cycle(reason: GenericCycleReason) {
    if (this.spo2State.completionEmitted) return;
    this.spo2State.completionEmitted = true;

    if (!this.nativeMode && this.mode === 'spo2') {
      await this.sendStopCommandForMode('spo2', `finishSpo2Cycle:${reason}`, {
        respectCooldown: reason === 'manual_stop',
      });
    }

    this.opts?.onDeviceEvent?.({
      type: 'spo2_cycle_complete',
      reason,
      ppgFrames: this.spo2PpgFrames,
      spo2: this.spo2LastSpo2,
      pulse: this.spo2LastPulse,
    });

    this.resetSpo2State();
    this.mode = 'idle';
  }

  private async finishTempCycle(reason: GenericCycleReason) {
    if (this.tempState.completionEmitted) return;
    this.tempState.completionEmitted = true;

    if (!this.nativeMode && this.mode === 'temp') {
      await this.sendStopCommandForMode('temp', `finishTempCycle:${reason}`, {
        respectCooldown: reason === 'manual_stop',
      });
    }

    this.opts?.onDeviceEvent?.({
      type: 'temp_cycle_complete',
      reason,
      celsius: this.tempLastCelsius,
      fahrenheit: this.tempLastFahrenheit,
    });

    this.resetTempState();
    this.mode = 'idle';
  }

  private async finishGlucoseCycle(reason: GenericCycleReason) {
    if (this.glucoseState.completionEmitted) return;
    this.glucoseState.completionEmitted = true;

    if (!this.nativeMode && this.mode === 'glucose') {
      await this.sendStopCommandForMode('glucose', `finishGlucoseCycle:${reason}`, {
        respectCooldown: reason === 'manual_stop',
      });
    }

    this.opts?.onDeviceEvent?.({
      type: 'glucose_cycle_complete',
      reason,
      glucose: this.glucoseLastValue,
      unit: this.glucoseLastUnit,
    });

    this.resetGlucoseState();
    this.mode = 'idle';
  }

  private estimateEcgSignalQuality(samples: number[]) {
    if (samples.length < 32) return null;

    const tail = samples.slice(-2048);
    const min = Math.min(...tail);
    const max = Math.max(...tail);
    const span = max - min;

    if (!Number.isFinite(span) || span <= 0) return 0;

    const mean = tail.reduce((sum, value) => sum + value, 0) / tail.length;
    const variance =
      tail.reduce((sum, value) => {
        const delta = value - mean;
        return sum + delta * delta;
      }, 0) / tail.length;

    const sd = Math.sqrt(Math.max(0, variance));
    const nonFlatRatio =
      tail.filter((value) => Math.abs(value - mean) > Math.max(1, sd * 0.15)).length /
      Math.max(1, tail.length);

    const spanScore = Math.min(45, Math.max(0, (span / 800) * 45));
    const densityScore = Math.min(35, Math.max(0, nonFlatRatio * 35));
    const sampleScore = Math.min(20, Math.max(0, (samples.length / 1024) * 20));

    return Math.round(Math.min(100, spanScore + densityScore + sampleScore));
  }

  private estimateEcgHeartRate(samples: number[], sampleHz: number | null) {
    const hz = sampleHz && Number.isFinite(sampleHz) && sampleHz > 0 ? sampleHz : 512;
    if (samples.length < hz * 2) return null;

    const tail = samples.slice(-Math.min(samples.length, Math.round(hz * 12)));
    const mean = tail.reduce((sum, value) => sum + value, 0) / tail.length;
    const variance =
      tail.reduce((sum, value) => {
        const delta = value - mean;
        return sum + delta * delta;
      }, 0) / tail.length;

    const sd = Math.sqrt(Math.max(0, variance));
    if (!Number.isFinite(sd) || sd <= 0) return null;

    const threshold = mean + sd * 0.85;
    const minGap = Math.max(1, Math.round(hz * 0.32));
    const peakIndices: number[] = [];
    let lastPeak = -minGap;

    for (let i = 1; i < tail.length - 1; i++) {
      const value = tail[i];

      if (value < threshold) continue;
      if (value < tail[i - 1] || value <= tail[i + 1]) continue;
      if (i - lastPeak < minGap) continue;

      peakIndices.push(i);
      lastPeak = i;
    }

    if (peakIndices.length < 3) return null;

    const intervals: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
      const interval = peakIndices[i] - peakIndices[i - 1];
      if (interval > 0) intervals.push(interval);
    }

    if (intervals.length < 2) return null;

    intervals.sort((a, b) => a - b);
    const median = intervals[Math.floor(intervals.length / 2)];
    if (!Number.isFinite(median) || median <= 0) return null;

    const bpm = Math.round((60 * hz) / median);
    if (bpm < 30 || bpm > 220) return null;

    return bpm;
  }

  private summarizeEcg(reason: GenericCycleReason) {
    const samples = this.ecgSamples.slice();
    const sampleHz = this.ecgSampleHz;
    const signalQuality = this.estimateEcgSignalQuality(samples);
    const heartRate = this.estimateEcgHeartRate(samples, sampleHz);
    const durationSec =
      sampleHz && sampleHz > 0
        ? Math.round((this.ecgSampleCount / sampleHz) * 10) / 10
        : this.ecgState.startedAt > 0 && this.ecgLastSampleAt > 0
          ? Math.round(((this.ecgLastSampleAt - this.ecgState.startedAt) / 1000) * 10) / 10
          : null;

    const waveformPreview =
      samples.length > 0
        ? samples.slice(-160).map((value) => Math.round(Number(value) || 0))
        : [];

    const conclusion =
      this.ecgSampleCount <= 0
        ? reason === 'timeout'
          ? 'No ECG signal captured before timeout.'
          : 'No ECG signal captured.'
        : signalQuality != null && signalQuality < 25
          ? 'ECG signal captured, but waveform quality is limited.'
          : heartRate != null
            ? `ECG captured. Estimated heart rate ${heartRate} bpm.`
            : 'ECG captured. Rhythm interpretation not generated.';

    return {
      sampleCount: this.ecgSampleCount,
      signalQuality,
      sampleHz,
      durationSec,
      heartRate,
      conclusion,
      waveformPreview,
    };
  }

  private async finishEcgCycle(reason: GenericCycleReason) {
    if (this.ecgState.completionEmitted) return;
    this.ecgState.completionEmitted = true;

    if (!this.nativeMode && this.mode === 'ecg') {
      await this.sendStopCommandForMode('ecg', `finishEcgCycle:${reason}`, {
        respectCooldown: reason === 'manual_stop',
      });
    }

    const normalizedReason: GenericCycleReason =
      reason === 'manual_stop' && this.ecgSampleCount > 0 ? 'result_received' : reason;

    const summary = this.summarizeEcg(normalizedReason);

    this.opts?.onDeviceEvent?.({
      type: 'ecg_cycle_complete',
      reason: normalizedReason,
      sampleCount: summary.sampleCount,
      signalQuality: summary.signalQuality,
      sampleHz: summary.sampleHz,
      durationSec: summary.durationSec,
      heartRate: summary.heartRate,
      conclusion: summary.conclusion,
      waveformPreview: summary.waveformPreview,
    });

    this.resetEcgState();
    this.mode = 'idle';
  }

  private async handleBpBootstrapPayload(payload: Uint8Array) {
    if (payload.length < 1) return;

    const code = payload[0] & 0xff;

    console.info('[HealthMonitorBridge] BP bootstrap payload', {
      code,
      stage: this.bpStage,
      payload: Array.from(payload),
    });

    if (code === 1) {
      this.bpAlgo.calibration = this.parseBpCalibrationParams(payload);

      if (this.bpStage === 'read_calibration' || this.bpStage === 'idle') {
        this.bpStage = 'temp_compensate';
        await this.sendControl('bp_temp_compensate');
      }
      return;
    }

    if (code === 2) {
      this.bpAlgo.tempCompRaw = this.parseBpTempCompRaw(payload);

      if (
        this.bpStage === 'temp_compensate' ||
        this.bpStage === 'read_calibration' ||
        this.bpStage === 'idle'
      ) {
        this.bpStage = 'pressure_zero';
        this.bpPressureFrames = 0;
        this.bpPressureSamplesSeen = 0;
        await this.sendControl('bp_get_pressure_zero');
      }
      return;
    }

    if (code !== 3) {
      return;
    }

    const rawSamples = this.parseBpPressureSamples(payload);
    const samplesInFrame = rawSamples.length;

    if (samplesInFrame > 0) {
      const scaledSamples = this.convertRawBpSamplesToPseudoMmHg(rawSamples);

      this.bpAlgo.rawSamples.push(...rawSamples);
      this.bpAlgo.scaledPressures.push(...scaledSamples);

      this.bpPressureFrames += 1;
      this.bpPressureSamplesSeen += samplesInFrame;
      this.noteBpPressureActivity(scaledSamples);
      this.dispatchBpPressure(scaledSamples, payload);
    }

    if (this.bpStage === 'pressure_zero') {
      this.bpStage = 'pressure_stream';
    }

    if (!this.bpPressureTestStarted && this.bpPressureSamplesSeen >= 30) {
      this.bpPressureTestStarted = true;
      this.bpStage = 'pressure_test';
      await this.sendControl('bp_start_pressure_test');
      return;
    }

    if (this.bpPressureTestStarted && !this.bpPumpStartIssued) {
      this.bpPumpStartIssued = true;
      this.bpStage = 'pump_started';
      await this.sendControl('bp_start_pwm_arm');
    }
  }

  private async routeOnePayload(
    sourceChar: string,
    payloadU8: Uint8Array,
    moduleId?: number,
  ) {
    if (typeof moduleId === 'number' && moduleId === LINKTOP_MODULE_STATUS) {
      console.info('[HealthMonitorBridge] status frame', {
        sourceChar,
        payload: Array.from(payloadU8),
        mode: this.mode,
      });
      return;
    }

    if (typeof moduleId === 'number' && moduleId === LINKTOP_MODULE_BP) {
      const code = payloadU8[0] & 0xff;
      if (code === 1 || code === 2 || code === 3) {
        if (this.mode === 'bp') {
          await this.handleBpBootstrapPayload(payloadU8);
        }
        return;
      }
    }

    if (
      typeof moduleId !== 'number' &&
      this.mode === 'bp' &&
      sourceChar === 'vendor_notify' &&
      payloadU8.length > 0
    ) {
      const code = payloadU8[0] & 0xff;
      if (code === 1 || code === 2 || code === 3) {
        await this.handleBpBootstrapPayload(payloadU8);
        return;
      }
    }

    if (this.mode === 'temp' && typeof moduleId === 'number') {
      const handled = await this.handleTempBtPayload(payloadU8);
      if (handled) return;
    }

    if (this.mode === 'temp' && sourceChar === 'temp' && payloadU8.length >= 8) {
      const handled = await this.handleTempBtPayload(payloadU8);
      if (handled) return;
    }

    const routedDv = this.u8ToDv(payloadU8);
    let routedCharKey = sourceChar;

    if (typeof moduleId === 'number') {
      if (moduleId === LINKTOP_MODULE_BT) routedCharKey = 'temp';
      else if (moduleId === LINKTOP_MODULE_TEST_PAPER) routedCharKey = 'glucose';
      else routedCharKey = 'vendor_notify';
    }

    const { route, result } = routeAndDecodeLinktop(routedDv, {
      sourceChar: routedCharKey,
      mode: this.mode,
    });

    if (!this.shouldAcceptDecodedKind(result.kind)) {
      console.info('[HealthMonitorBridge] ignored decoded payload for current mode', {
        mode: this.mode,
        sourceChar,
        routedCharKey,
        kind: result.kind,
        payload: Array.from(payloadU8),
      });
      return;
    }

    const recordedAt = new Date().toISOString();

    switch (result.kind) {
      case 'bp_result': {
        await this.opts.emitVital({
          type: 'blood_pressure',
          recorded_at: recordedAt,
          deviceId: DEVICE_ID,
          payload: {
            systolic: result.systolic,
            diastolic: result.diastolic,
            pulse: result.pulse ?? null,
            map: result.map ?? null,
            unit: 'mmHg',
          },
          meta: {
            source: 'ble',
            route: route.channel,
            irregular: result.irregular ?? false,
          },
        });

        if (typeof result.pulse === 'number') {
          await this.opts.emitVital({
            type: 'heart_rate',
            recorded_at: recordedAt,
            deviceId: DEVICE_ID,
            payload: {
              hr: result.pulse,
              unit: 'bpm',
            },
            meta: {
              source: 'ble',
              parent: 'blood_pressure',
              authoritative: false,
              route: route.channel,
            },
            dedupeKey: 'hr',
          });
        }

        this.opts?.onDeviceEvent?.({
          type: 'bp_result',
          systolic: result.systolic,
          diastolic: result.diastolic,
          pulse: result.pulse ?? null,
          map: result.map ?? null,
        });

        if (this.mode === 'bp') {
          await this.finishBpCycle('bp_result_received');
        }
        break;
      }

      case 'spo2_result': {
        this.noteGenericSignal(this.spo2State);

        const validSpo2 = typeof result.spo2 === 'number' && result.spo2 > 0;

const pulseValue =
  typeof result.pulse === 'number' && result.pulse > 0
    ? result.pulse
    : null;

const validPulse = pulseValue !== null;

this.spo2LastSpo2 = validSpo2 ? result.spo2 : null;
this.spo2LastPulse = validPulse ? pulseValue : this.spo2LastPulse;

        await this.opts.emitVital({
          type: 'spo2',
          recorded_at: recordedAt,
          deviceId: DEVICE_ID,
          payload: {
            spo2: result.spo2,
            pulse: result.pulse ?? null,
            unit: '%',
          },
          meta: {
            source: 'ble',
            route: route.channel,
          },
        });

        if (validPulse) {
          await this.opts.emitVital({
            type: 'heart_rate',
            recorded_at: recordedAt,
            deviceId: DEVICE_ID,
            payload: {
              hr: result.pulse,
              unit: 'bpm',
            },
            meta: {
              source: 'ble',
              parent: 'spo2',
              authoritative: false,
              route: route.channel,
            },
            dedupeKey: 'hr',
          });
        }

        this.opts?.onDeviceEvent?.({
          type: 'spo2_result',
          spo2: validSpo2 ? result.spo2 : null,
          pulse: validPulse ? result.pulse : null,
          pi: result.pi ?? null,
        });

        if (validSpo2) {
          await this.finishSpo2Cycle('result_received');
        }
        break;
      }

      case 'temperature_result': {
        this.noteGenericSignal(this.tempState);
        this.tempLastCelsius = result.celsius;
        this.tempLastFahrenheit = result.fahrenheit ?? null;

        await this.opts.emitVital({
          type: 'temperature',
          recorded_at: recordedAt,
          deviceId: DEVICE_ID,
          payload: {
            celsius: result.celsius,
            fahrenheit: result.fahrenheit ?? null,
            unit: 'C',
          },
          meta: {
            source: 'ble',
            route: route.channel,
          },
        });

        this.opts?.onDeviceEvent?.({
          type: 'temp_result',
          celsius: result.celsius,
          fahrenheit: result.fahrenheit ?? null,
        });

        await this.finishTempCycle('result_received');
        break;
      }

      case 'glucose_result': {
        this.noteGenericSignal(this.glucoseState);
        this.glucoseLastValue = result.glucose;
        this.glucoseLastUnit = result.unit;

        await this.opts.emitVital({
          type: 'blood_glucose',
          recorded_at: recordedAt,
          deviceId: DEVICE_ID,
          payload: {
            glucose: result.glucose,
            unit: result.unit,
          },
          meta: {
            source: 'ble',
            route: route.channel,
          },
        });

        this.opts?.onDeviceEvent?.({
          type: 'glucose_result',
          glucose: result.glucose,
          unit: result.unit,
        });

        await this.finishGlucoseCycle('result_received');
        break;
      }

      case 'battery': {
        if (sourceChar === 'batt' || sourceChar === 'battery') {
          this.telemetry({
            connected: true,
            batteryPct: result.percent,
            rssi: null,
          });
        }
        break;
      }

      case 'ecg_wave': {
        const samples = Array.isArray(result.samples) ? result.samples : [];
        this.ecgSampleCount += samples.length;
        this.ecgSampleHz =
          typeof result.sampleHz === 'number' && Number.isFinite(result.sampleHz)
            ? result.sampleHz
            : this.ecgSampleHz;
        this.ecgLastSampleAt = Date.now();

        if (samples.length > 0) {
          this.ecgSamples.push(...samples.map((value) => Math.round(Number(value) || 0)));
          if (this.ecgSamples.length > 4096) {
            this.ecgSamples = this.ecgSamples.slice(-4096);
          }
          this.ecgSignalQuality = this.estimateEcgSignalQuality(this.ecgSamples);
        }

        this.noteGenericSignal(this.ecgState, ECG_IDLE_STOP_MS, () => {
          void this.finishEcgCycle(
            this.ecgSampleCount > 0 ? 'result_received' : 'signal_detected_no_result',
          );
        });

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('iomt:ecg', {
              detail: {
                deviceId: DEVICE_ID,
                timestamp: recordedAt,
                sampleHz: result.sampleHz,
                samples: result.samples,
                raw: Array.from(result.raw),
              },
            }),
          );
        }
        break;
      }

      case 'ppg_wave': {
        this.noteGenericSignal(this.spo2State);
        this.spo2PpgFrames += 1;

        const sdkSamples = this.consumeSdkOxFrame(result.raw, recordedAt);
        if (sdkSamples === 0) {
          this.consumeFallbackPpgSamples(result.samples, recordedAt);
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('iomt:ppg', {
              detail: {
                deviceId: DEVICE_ID,
                timestamp: recordedAt,
                sampleHz: result.sampleHz,
                samples: result.samples,
                raw: Array.from(result.raw),
                sdkOxSamples: sdkSamples,
                pulse: this.spo2LastPulse,
              },
            }),
          );
        }
        break;
      }

      case 'ack':
      case 'unknown':
      default:
        break;
    }
  }

  private async handleIncoming(charKey: string, dv: DataView) {
    const raw = this.dvToU8(dv);

    console.info('[HealthMonitorBridge] notify', {
      charKey,
      len: raw.length,
      raw: Array.from(raw),
    });

    // Linktop Ox/SpO2 packets must be consumed before generic frame parsing.
    // The Android SDK routes these 20-byte packets into OxTask before normal
    // module dispatch; otherwise the 14/16-byte Ox payload is separated from
    // the raw wrapper and pulse derivation never sees the complete stream.
    if (this.mode === 'spo2' && charKey === 'vendor_notify') {
      const recordedAt = new Date().toISOString();
      const sdkOxSamples = this.consumeSdkOxFrame(raw, recordedAt);

      if (sdkOxSamples > 0) {
        this.noteGenericSignal(this.spo2State);
        this.spo2PpgFrames += 1;

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('iomt:ppg', {
              detail: {
                deviceId: DEVICE_ID,
                timestamp: recordedAt,
                sampleHz: 125,
                samples: [],
                raw: Array.from(raw),
                sdkOxSamples,
                pulse: this.spo2LastPulse,
                route: 'sdk_ox_raw',
              },
            }),
          );
        }

        return;
      }
    }

    const exact = parseLinktopFrame(raw);
    if (exact) {
      console.info('[HealthMonitorBridge] parsed exact frame', {
        charKey,
        offset: exact.offset,
        frameStart: exact.frameStart,
        rawModuleId: exact.rawModuleId,
        moduleId: exact.moduleId,
        payload: Array.from(exact.payload),
      });
      await this.routeOnePayload(charKey, exact.payload, exact.moduleId);
      return;
    }

    const scanned = extractLinktopFrames(raw);
    if (scanned.length > 0) {
      console.info(
        '[HealthMonitorBridge] scanned frames',
        scanned.map((frame) => ({
          charKey,
          offset: frame.offset,
          frameStart: frame.frameStart,
          rawModuleId: frame.rawModuleId,
          moduleId: frame.moduleId,
          payload: Array.from(frame.payload),
        })),
      );

      for (const frame of scanned) {
        await this.routeOnePayload(charKey, frame.payload, frame.moduleId);
      }
      return;
    }

    await this.routeOnePayload(charKey, raw);
  }

  private async sendControl(op: LinktopControlOp) {
    if (!this.conn) throw new Error('Health monitor not connected');

    if (!this.controlCharKey) {
      throw new Error(
        `No writable control characteristic found. Available chars: ${Array.from(
          this.conn.chars?.keys?.() ?? [],
        ).join(', ')}`,
      );
    }

    const bytes = buildLinktopCtrl(op);

    console.info('[HealthMonitorBridge] sendControl', {
      op,
      controlCharKey: this.controlCharKey,
      mode: this.mode,
      bytes: Array.from(bytes),
    });

    await this.conn.write(this.controlCharKey, bytes);
  }

  async startBloodPressure() {
    console.info('[HealthMonitorBridge] bp_runtime_signature', this.bpRuntimeSignature, {
      BP_MIN_BEAT_GAP_SAMPLES,
      BP_ENVELOPE_SMOOTH_WINDOW,
      BP_MIN_ENVELOPE_AMPLITUDE,
      BP_MIN_ENVELOPE_RELATIVE,
    });

    if (this.nativeMode) {
      this.mode = 'bp';
      this.resetBpBootstrap();
      await NativeHealthMonitor.setMeasurePosition({ wrist: this.bpMeasureWrist });
      await NativeHealthMonitor.startMeasurements();
      return;
    }

    await this.prepareForModeStart('bp');

    this.mode = 'bp';
    this.resetBpBootstrap();
    this.bpStage = 'read_calibration';
    await this.sendControl('start_bp');
    this.scheduleBpFallbackChain();
  }

  async stopBloodPressure() {
    if (this.nativeMode) {
      await NativeHealthMonitor.stopMeasurements();
      this.mode = 'idle';
      return;
    }

    await this.finishBpCycle('manual_stop');
  }

  async startSpo2() {
    this.assertNativeSupports('spo2');

    await this.prepareForModeStart('spo2');

    this.mode = 'spo2';
    this.resetSpo2State();
    this.startGenericTimeout(this.spo2State, SPO2_TIMEOUT_MS, () => {
      void this.finishSpo2Cycle(
        this.spo2LastPulse != null || this.spo2LastSpo2 != null
          ? 'result_received'
          : this.spo2PpgFrames > 0
            ? 'signal_detected_no_result'
            : 'timeout',
      );
    });
    await this.sendControl('start_spo2');
  }

  async stopSpo2() {
    await this.finishSpo2Cycle('manual_stop');
  }

  async startEcg() {
    this.assertNativeSupports('ecg');

    await this.prepareForModeStart('ecg');

    this.mode = 'ecg';
    this.resetEcgState();
    this.startGenericTimeout(this.ecgState, ECG_TIMEOUT_MS, () => {
      void this.finishEcgCycle(this.ecgSampleCount > 0 ? 'signal_detected_no_result' : 'timeout');
    });
    await this.sendControl('start_ecg');
  }

  async stopEcg() {
    await this.finishEcgCycle('manual_stop');
  }

  async startTemperature() {
    this.assertNativeSupports('temp');

    await this.prepareForModeStart('temp');

    this.mode = 'temp';
    this.resetTempState();
    this.startGenericTimeout(this.tempState, TEMP_TIMEOUT_MS, () => {
      void this.finishTempCycle(this.tempLastCelsius != null ? 'signal_detected_no_result' : 'timeout');
    });
    await this.sendControl('start_temp');
  }

  async stopTemperature() {
    await this.finishTempCycle('manual_stop');
  }

  async startGlucose() {
    this.assertNativeSupports('glucose');

    await this.prepareForModeStart('glucose');

    this.mode = 'glucose';
    this.resetGlucoseState();
    this.startGenericTimeout(this.glucoseState, GLUCOSE_TIMEOUT_MS, () => {
      void this.finishGlucoseCycle(this.glucoseLastValue != null ? 'signal_detected_no_result' : 'timeout');
    });
    await this.sendControl('start_glucose');
  }

  async stopGlucose() {
    await this.finishGlucoseCycle('manual_stop');
  }

  async startStreaming() {
    switch (this.mode) {
      case 'ecg':
        await this.startEcg();
        return;
      case 'spo2':
        await this.startSpo2();
        return;
      case 'bp':
        await this.startBloodPressure();
        return;
      case 'temp':
        await this.startTemperature();
        return;
      case 'glucose':
        await this.startGlucose();
        return;
      case 'idle':
      default:
        if (!this.controlCharKey) {
          throw new Error(
            `Health monitor connected, but no control characteristic is available. Available chars: ${Array.from(
              this.conn?.chars?.keys?.() ?? [],
            ).join(', ')}`,
          );
        }
        await this.sendControl('noop');
        return;
    }
  }

  async stopStreaming() {
    switch (this.mode) {
      case 'ecg':
        await this.stopEcg();
        break;
      case 'spo2':
        await this.stopSpo2();
        break;
      case 'bp':
        await this.stopBloodPressure();
        break;
      case 'temp':
        await this.stopTemperature();
        break;
      case 'glucose':
        await this.stopGlucose();
        break;
      default:
        this.mode = 'idle';
        break;
    }
  }

  setMode(mode: LinktopMeasurementMode) {
    this.mode = mode;
    if (mode !== 'bp') {
      this.resetBpBootstrap();
    }
  }

  setBpMeasurePosition(isWrist: boolean) {
    this.bpMeasureWrist = isWrist;
  }

  getMode() {
    return this.mode;
  }

  async disconnect() {
    if (this.nativeMode) {
      if (this.mode === 'bp' && !this.bpCompletionEmitted) {
        try {
          await this.finishBpCycle('device_disconnect');
        } catch {}
      }

      try {
        await NativeHealthMonitor.stopMeasurements();
      } catch {}
      try {
        await NativeHealthMonitor.stopScan();
      } catch {}
      try {
        await NativeHealthMonitor.disconnect();
      } catch {}
      await this.clearNativeListeners();

      this.nativeConnected = false;
      this.nativeScanStarted = false;
      this.nativeConnectIssued = false;
      this.nativeSeenMacs.clear();
      this.mode = 'idle';
      this.resetBpBootstrap();
      this.resetSpo2State();
      this.resetTempState();
      this.resetGlucoseState();
      this.resetEcgState();
      this.telemetry({ connected: false });
      return;
    }

    if (this.mode === 'bp' && !this.bpCompletionEmitted) {
      try {
        await this.finishBpCycle('device_disconnect');
      } catch {}
    } else if (this.mode === 'spo2' && !this.spo2State.completionEmitted) {
      try {
        await this.finishSpo2Cycle('device_disconnect');
      } catch {}
    } else if (this.mode === 'temp' && !this.tempState.completionEmitted) {
      try {
        await this.finishTempCycle('device_disconnect');
      } catch {}
    } else if (this.mode === 'glucose' && !this.glucoseState.completionEmitted) {
      try {
        await this.finishGlucoseCycle('device_disconnect');
      } catch {}
    } else if (this.mode === 'ecg' && !this.ecgState.completionEmitted) {
      try {
        await this.finishEcgCycle('device_disconnect');
      } catch {}
    } else {
      this.clearBpTimers();
      this.resetSpo2State();
      this.resetTempState();
      this.resetGlucoseState();
      this.resetEcgState();
    }

    for (const u of this.unsub.splice(0)) {
      try {
        u();
      } catch {}
    }

    try {
      await this.conn?.stopAll?.();
    } catch {}

    this.conn = null;
    this.mode = 'idle';
    this.controlCharKey = null;
    this.notifyCharKeys = [];
    this.batteryCharKey = null;
    this.resetBpBootstrap();
    this.resetSpo2State();
    this.resetTempState();
    this.resetGlucoseState();
    this.resetEcgState();

    this.telemetry({ connected: false });
  }

  private telemetry(patch: BridgeStatus) {
    const detail = {
      id: 'duecare-health-monitor',
      name: 'HealthMonitor-001',
      transport: 'ble' as const,
      connected: patch.connected ?? true,
      batteryPct: patch.batteryPct ?? null,
      rssi: patch.rssi ?? null,
    };

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('iomt:telemetry', { detail }));
    }

    this.opts?.onStatus?.(detail);
  }
}