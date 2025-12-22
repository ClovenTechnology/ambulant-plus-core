import type { PluginListenerHandle } from '@capacitor/core';

export type TelemetryEvent = { connected: boolean; batteryPct?: number | null; rssi?: number | null };
export type ECGEvent = { samples: number[]; sampleHz: number };
export type PPGEvent = { samples: number[]; sampleHz: number };
export type HREvent = { hr: number; unit?: 'bpm' };
export type BPEvent = { systolic: number; diastolic: number; unit?: 'mmHg' | 'kPa' };
export type TempEvent = { celsius: number; fahrenheit?: number };
export type GlucoseEvent = { glucose: number; unit: 'mg/dL' | 'mmol/L' };
export type GenericVitalEvent = { type: 'spo2'; payload: { spo2: number; pulse?: number; unit?: '%' } };

export interface HealthMonitorPlugin {
  connect(opts: { patientId: string; ctrlStart?: number[]; ctrlStop?: number[] }): Promise<{ ok: true }>;
  startStreaming(): Promise<{ ok: true }>;
  stopStreaming(): Promise<{ ok: true }>;
  disconnect(): Promise<{ ok: true }>;

  addListener(eventName: 'telemetry', listener: (e: TelemetryEvent) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'ecg', listener: (e: ECGEvent) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'ppg', listener: (e: PPGEvent) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'heart_rate', listener: (e: HREvent) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'blood_pressure', listener: (e: BPEvent) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'temperature', listener: (e: TempEvent) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'blood_glucose', listener: (e: GlucoseEvent) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'vitals', listener: (e: GenericVitalEvent) => void): Promise<PluginListenerHandle>;
}
