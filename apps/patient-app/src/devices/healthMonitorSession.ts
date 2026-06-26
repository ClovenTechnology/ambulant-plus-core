// apps/patient-app/src/devices/healthMonitorSession.ts
'use client';

import { HealthMonitorBridge } from '@/src/devices/healthMonitorBridge';
import type { EmitVitalInput } from '@/src/lib/vitals';
import { emitVital as postVital } from '@/src/lib/vitals';

export type HealthMonitorMode =
  | 'idle'
  | 'bp'
  | 'spo2'
  | 'temp'
  | 'glucose'
  | 'ecg'
  | 'hr';

export type HealthMonitorLiveEvent =
  | { type: 'ecg' | 'ppg'; detail: any }
  | { type: 'bp_pressure'; detail: any }
  | {
      type: 'bp_result';
      detail: {
        systolic: number;
        diastolic: number;
        pulse?: number | null;
        map?: number | null;
        recordedAt: string;
      };
    }
  | {
      type: 'bp_cycle_complete';
      detail: {
        reason:
          | 'silence_after_pressure'
          | 'bp_result_received'
          | 'manual_stop'
          | 'device_disconnect';
        pressureFrames: number;
        pressureSamplesSeen: number;
        latestPressure: number | null;
        peakPressure: number | null;
        recordedAt: string;
      };
    }
  | {
      type: 'spo2_result';
      detail: {
        spo2: number | null;
        pulse?: number | null;
        pi?: number | null;
        recordedAt: string;
      };
    }
  | {
      type: 'spo2_cycle_complete';
      detail: {
        reason:
          | 'result_received'
          | 'timeout'
          | 'manual_stop'
          | 'device_disconnect'
          | 'signal_detected_no_result';
        ppgFrames: number;
        spo2: number | null;
        pulse: number | null;
        recordedAt: string;
      };
    }
  | {
      type: 'temp_result';
      detail: {
        celsius: number;
        fahrenheit?: number | null;
        recordedAt: string;
      };
    }
  | {
      type: 'temp_cycle_complete';
      detail: {
        reason:
          | 'result_received'
          | 'timeout'
          | 'manual_stop'
          | 'device_disconnect'
          | 'signal_detected_no_result';
        celsius: number | null;
        fahrenheit: number | null;
        recordedAt: string;
      };
    }
  | {
      type: 'glucose_result';
      detail: {
        glucose: number;
        unit: 'mg/dL' | 'mmol/L';
        recordedAt: string;
      };
    }
  | {
      type: 'glucose_cycle_complete';
      detail: {
        reason:
          | 'result_received'
          | 'timeout'
          | 'manual_stop'
          | 'device_disconnect'
          | 'signal_detected_no_result';
        glucose: number | null;
        unit: 'mg/dL' | 'mmol/L' | null;
        recordedAt: string;
      };
    }
  | {
      type: 'ecg_cycle_complete';
      detail: {
        reason:
          | 'result_received'
          | 'timeout'
          | 'manual_stop'
          | 'device_disconnect'
          | 'signal_detected_no_result';
        sampleCount: number;
        signalQuality: number | null;
        sampleHz?: number | null;
        durationSec?: number | null;
        heartRate?: number | null;
        conclusion?: string | null;
        waveformPreview?: number[];
        recordedAt: string;
      };
    };

export type HealthMonitorSessionState = {
  connected: boolean;
  connecting: boolean;
  streaming: boolean;
  batteryPct: number | null;
  rssi: number | null;
  error: string | null;
  mode: HealthMonitorMode;

  lastBpPressure: number | null;
  bpPeakPressure: number | null;
  bpPressureFrames: number;
  bpPressureSamplesSeen: number;

  lastBpResult: {
    systolic: number;
    diastolic: number;
    pulse?: number | null;
    map?: number | null;
    recordedAt: string;
  } | null;

  lastBpCycleComplete: {
    reason:
      | 'silence_after_pressure'
      | 'bp_result_received'
      | 'manual_stop'
      | 'device_disconnect';
    pressureFrames: number;
    pressureSamplesSeen: number;
    latestPressure: number | null;
    peakPressure: number | null;
    recordedAt: string;
  } | null;

  lastSpo2Result: {
    spo2: number | null;
    pulse?: number | null;
    pi?: number | null;
    recordedAt: string;
  } | null;

  lastSpo2CycleComplete: {
    reason:
      | 'result_received'
      | 'timeout'
      | 'manual_stop'
      | 'device_disconnect'
      | 'signal_detected_no_result';
    ppgFrames: number;
    spo2: number | null;
    pulse: number | null;
    recordedAt: string;
  } | null;

  lastTempResult: {
    celsius: number;
    fahrenheit?: number | null;
    recordedAt: string;
  } | null;

  lastTempCycleComplete: {
    reason:
      | 'result_received'
      | 'timeout'
      | 'manual_stop'
      | 'device_disconnect'
      | 'signal_detected_no_result';
    celsius: number | null;
    fahrenheit: number | null;
    recordedAt: string;
  } | null;

  lastGlucoseResult: {
    glucose: number;
    unit: 'mg/dL' | 'mmol/L';
    recordedAt: string;
  } | null;

  lastGlucoseCycleComplete: {
    reason:
      | 'result_received'
      | 'timeout'
      | 'manual_stop'
      | 'device_disconnect'
      | 'signal_detected_no_result';
    glucose: number | null;
    unit: 'mg/dL' | 'mmol/L' | null;
    recordedAt: string;
  } | null;

  ecgSampleCount: number;
  lastEcgCycleComplete: {
    reason:
      | 'result_received'
      | 'timeout'
      | 'manual_stop'
      | 'device_disconnect'
      | 'signal_detected_no_result';
    sampleCount: number;
    signalQuality: number | null;
    sampleHz?: number | null;
    durationSec?: number | null;
    heartRate?: number | null;
    conclusion?: string | null;
    waveformPreview?: number[];
    recordedAt: string;
  } | null;
};

export type HealthMonitorSession = {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  startStreaming: () => Promise<void>;
  stopStreaming: () => Promise<void>;
  startMeasurement: (mode: Exclude<HealthMonitorMode, 'idle'>) => Promise<void>;
  stopMeasurement: () => Promise<void>;
  setMode: (mode: HealthMonitorMode) => void;
  getMode: () => HealthMonitorMode;
  getState: () => HealthMonitorSessionState;
};

export function createHealthMonitorSession(opts: {
  patientId: string;
  onState?: (s: HealthMonitorSessionState) => void;
  onLiveEvent?: (evt: HealthMonitorLiveEvent) => void;
}): HealthMonitorSession {
  const bridge = new HealthMonitorBridge();

  let state: HealthMonitorSessionState = {
    connected: false,
    connecting: false,
    streaming: false,
    batteryPct: null,
    rssi: null,
    error: null,
    mode: 'idle',

    lastBpPressure: null,
    bpPeakPressure: null,
    bpPressureFrames: 0,
    bpPressureSamplesSeen: 0,

    lastBpResult: null,
    lastBpCycleComplete: null,

    lastSpo2Result: null,
    lastSpo2CycleComplete: null,

    lastTempResult: null,
    lastTempCycleComplete: null,

    lastGlucoseResult: null,
    lastGlucoseCycleComplete: null,

    ecgSampleCount: 0,
    lastEcgCycleComplete: null,
  };

  const patch = (next: Partial<HealthMonitorSessionState>) => {
    state = { ...state, ...next };
    opts.onState?.(state);
  };

  const emitVital = async (input: Omit<EmitVitalInput, 'patientId'>) => {
    try {
      await postVital({
        patientId: opts.patientId,
        ...input,
      });
    } catch (err) {
      console.warn('[HealthMonitorSession] emitVital failed', {
        type: input.type,
        input,
        err,
      });
    }
  };

  const onEcg = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    const sampleCount =
      Array.isArray(detail?.samples) ? detail.samples.length : 0;

    const nextCount = Math.max(0, (state.ecgSampleCount || 0) + sampleCount);

    patch({
      ecgSampleCount: nextCount,
    });

    opts.onLiveEvent?.({ type: 'ecg', detail });
  };

  const onPpg = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    opts.onLiveEvent?.({ type: 'ppg', detail });
  };

  const onBpPressure = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    patch({
      lastBpPressure:
        typeof detail?.latestPressure === 'number' ? detail.latestPressure : null,
      bpPeakPressure:
        typeof detail?.peakPressure === 'number' ? detail.peakPressure : null,
      bpPressureFrames:
        typeof detail?.pressureFrames === 'number' ? detail.pressureFrames : 0,
      bpPressureSamplesSeen:
        typeof detail?.pressureSamplesSeen === 'number'
          ? detail.pressureSamplesSeen
          : 0,
    });
    opts.onLiveEvent?.({ type: 'bp_pressure', detail });
  };

  const setMode = (mode: HealthMonitorMode) => {
    bridge.setMode(mode === 'hr' ? 'spo2' : mode);
    patch({ mode });
  };

  const connect = async () => {
    if (state.connecting || state.connected) return;
    patch({ connecting: true, error: null });

    try {
      window.addEventListener('iomt:ecg', onEcg as EventListener);
      window.addEventListener('iomt:ppg', onPpg as EventListener);
      window.addEventListener('iomt:bp_pressure', onBpPressure as EventListener);

      await bridge.connect({
        patientId: opts.patientId,
        emitVital: async ({ type, payload, deviceId, recorded_at, meta }) => {
          await emitVital({
            type: type as any,
            payload,
            deviceId,
            recorded_at,
            meta,
          });
        },
        onStatus: (s) => {
          patch({
            connected: !!s.connected,
            batteryPct: s.batteryPct ?? null,
            rssi: s.rssi ?? null,
          });
        },
        onDeviceEvent: (evt) => {
          switch (evt.type) {
            case 'bp_cycle_complete': {
              const detail = {
                reason: evt.reason,
                pressureFrames: evt.pressureFrames,
                pressureSamplesSeen: evt.pressureSamplesSeen,
                latestPressure: evt.latestPressure,
                peakPressure: evt.peakPressure,
                recordedAt: new Date().toISOString(),
              };

              patch({
                streaming: false,
                mode: 'idle',
                error: null,
                lastBpCycleComplete: detail,
                lastBpPressure: evt.latestPressure ?? state.lastBpPressure,
                bpPeakPressure: evt.peakPressure ?? state.bpPeakPressure,
                bpPressureFrames: evt.pressureFrames,
                bpPressureSamplesSeen: evt.pressureSamplesSeen,
              });

              opts.onLiveEvent?.({
                type: 'bp_cycle_complete',
                detail,
              });
              break;
            }

            case 'bp_result': {
              const detail = {
                systolic: evt.systolic,
                diastolic: evt.diastolic,
                pulse: evt.pulse ?? null,
                map: evt.map ?? null,
                recordedAt: new Date().toISOString(),
              };

              patch({
                streaming: false,
                mode: 'idle',
                error: null,
                lastBpResult: detail,
              });

              opts.onLiveEvent?.({
                type: 'bp_result',
                detail,
              });
              break;
            }

            case 'bp_error':
              patch({
                streaming: false,
                mode: 'idle',
                error: evt.reason || 'Blood pressure measurement failed',
              });
              break;

            case 'spo2_result': {
              const detail = {
                spo2: evt.spo2,
                pulse: evt.pulse ?? null,
                pi: evt.pi ?? null,
                recordedAt: new Date().toISOString(),
              };

              patch({
                lastSpo2Result: detail,
                lastSpo2CycleComplete: null,
                error: null,
              });

              opts.onLiveEvent?.({
                type: 'spo2_result',
                detail,
              });
              break;
            }

            case 'spo2_cycle_complete': {
              const detail = {
                reason: evt.reason,
                ppgFrames: evt.ppgFrames,
                spo2: evt.spo2,
                pulse: evt.pulse,
                recordedAt: new Date().toISOString(),
              };

              patch({
                streaming: false,
                mode: 'idle',
                error:
                  evt.reason === 'timeout'
                    ? 'SpO₂ measurement timed out'
                    : evt.reason === 'signal_detected_no_result'
                      ? 'Signal detected but no final SpO₂ result decoded'
                      : null,
                lastSpo2CycleComplete: detail,
              });

              opts.onLiveEvent?.({
                type: 'spo2_cycle_complete',
                detail,
              });
              break;
            }

            case 'temp_result': {
              const detail = {
                celsius: evt.celsius,
                fahrenheit: evt.fahrenheit ?? null,
                recordedAt: new Date().toISOString(),
              };

              patch({
                lastTempResult: detail,
                lastTempCycleComplete: null,
                error: null,
              });

              opts.onLiveEvent?.({
                type: 'temp_result',
                detail,
              });
              break;
            }

            case 'temp_cycle_complete': {
              const detail = {
                reason: evt.reason,
                celsius: evt.celsius,
                fahrenheit: evt.fahrenheit,
                recordedAt: new Date().toISOString(),
              };

              patch({
                streaming: false,
                mode: 'idle',
                error:
                  evt.reason === 'timeout'
                    ? 'Temperature measurement timed out'
                    : evt.reason === 'signal_detected_no_result'
                      ? 'Temperature signal activity seen but no final result decoded'
                      : null,
                lastTempCycleComplete: detail,
              });

              opts.onLiveEvent?.({
                type: 'temp_cycle_complete',
                detail,
              });
              break;
            }

            case 'glucose_result': {
              const detail = {
                glucose: evt.glucose,
                unit: evt.unit,
                recordedAt: new Date().toISOString(),
              };

              patch({
                lastGlucoseResult: detail,
                lastGlucoseCycleComplete: null,
                error: null,
              });

              opts.onLiveEvent?.({
                type: 'glucose_result',
                detail,
              });
              break;
            }

            case 'glucose_cycle_complete': {
              const detail = {
                reason: evt.reason,
                glucose: evt.glucose,
                unit: evt.unit,
                recordedAt: new Date().toISOString(),
              };

              patch({
                streaming: false,
                mode: 'idle',
                error:
                  evt.reason === 'timeout'
                    ? 'Glucose measurement timed out'
                    : evt.reason === 'signal_detected_no_result'
                      ? 'Strip workflow started but no final glucose result decoded'
                      : null,
                lastGlucoseCycleComplete: detail,
              });

              opts.onLiveEvent?.({
                type: 'glucose_cycle_complete',
                detail,
              });
              break;
            }

            case 'ecg_cycle_complete': {
              const detail = {
                reason: evt.reason,
                sampleCount: evt.sampleCount,
                signalQuality: evt.signalQuality,
                sampleHz: (evt as any).sampleHz ?? null,
                durationSec: (evt as any).durationSec ?? null,
                heartRate: (evt as any).heartRate ?? null,
                conclusion: (evt as any).conclusion ?? null,
                waveformPreview: Array.isArray((evt as any).waveformPreview)
                  ? (evt as any).waveformPreview
                  : [],
                recordedAt: new Date().toISOString(),
              };

              patch({
                streaming: false,
                mode: 'idle',
                error:
                  evt.reason === 'timeout'
                    ? 'ECG session timed out'
                    : evt.reason === 'signal_detected_no_result'
                      ? 'ECG signal activity seen but no finalized session summary was produced'
                      : null,
                lastEcgCycleComplete: detail,
              });

              opts.onLiveEvent?.({
                type: 'ecg_cycle_complete',
                detail,
              });
              break;
            }

            default:
              break;
          }
        },
      });

      patch({ connected: true, connecting: false, error: null });
    } catch (err: any) {
      window.removeEventListener('iomt:ecg', onEcg as EventListener);
      window.removeEventListener('iomt:ppg', onPpg as EventListener);
      window.removeEventListener('iomt:bp_pressure', onBpPressure as EventListener);

      patch({
        connecting: false,
        connected: false,
        streaming: false,
        mode: 'idle',
        error: err?.message || 'Failed to connect health monitor',
      });
      throw err;
    }
  };

  const disconnect = async () => {
    try {
      await bridge.disconnect();
    } finally {
      window.removeEventListener('iomt:ecg', onEcg as EventListener);
      window.removeEventListener('iomt:ppg', onPpg as EventListener);
      window.removeEventListener('iomt:bp_pressure', onBpPressure as EventListener);

      patch({
        connected: false,
        connecting: false,
        streaming: false,
        mode: 'idle',
        error: null,
      });
    }
  };

  const startStreaming = async () => {
    await bridge.startStreaming();
    patch({ streaming: true, error: null });
  };

  const stopStreaming = async () => {
    await bridge.stopStreaming();
    patch({ streaming: false, mode: 'idle' });
  };

  const startMeasurement = async (mode: Exclude<HealthMonitorMode, 'idle'>) => {
    setMode(mode);

    if (mode === 'bp') {
      patch({
        lastBpPressure: null,
        bpPeakPressure: null,
        bpPressureFrames: 0,
        bpPressureSamplesSeen: 0,
        lastBpCycleComplete: null,
        lastBpResult: null,
      });
    }

    if (mode === 'spo2' || mode === 'hr') {
      patch({
        lastSpo2Result: null,
        lastSpo2CycleComplete: null,
      });
    }

    if (mode === 'temp') {
      patch({
        lastTempResult: null,
        lastTempCycleComplete: null,
      });
    }

    if (mode === 'glucose') {
      patch({
        lastGlucoseResult: null,
        lastGlucoseCycleComplete: null,
      });
    }

    if (mode === 'ecg') {
      patch({
        ecgSampleCount: 0,
        lastEcgCycleComplete: null,
      });
    }

    switch (mode) {
      case 'bp':
        await bridge.startBloodPressure();
        break;
      case 'spo2':
      case 'hr':
        await bridge.startSpo2();
        break;
      case 'temp':
        await bridge.startTemperature();
        break;
      case 'glucose':
        await bridge.startGlucose();
        break;
      case 'ecg':
        await bridge.startEcg();
        break;
    }

    patch({ streaming: true, error: null });
  };

  const stopMeasurement = async () => {
    await bridge.stopStreaming();
    patch({
      streaming: false,
      mode: 'idle',
    });
  };

  return {
    connect,
    disconnect,
    startStreaming,
    stopStreaming,
    startMeasurement,
    stopMeasurement,
    setMode,
    getMode: () => state.mode,
    getState: () => state,
  };
}