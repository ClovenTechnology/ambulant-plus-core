import { registerPlugin } from '@capacitor/core';

type RingEvent =
  | { type: 'hr'; hr: number }
  | { type: 'spo2'; spo2: number }
  | { type: 'temp'; celsius: number }
  | { type: 'hrv'; rmssd: number }
  | { type: 'battery'; pct: number }
  | { type: 'telemetry'; rssi?: number | null };

export type NexRingPlugin = {
  askPermissions(): Promise<void>;
  startScan(): Promise<void>;
  stopScan(): Promise<void>;
  connect(options: { mac?: string; name?: string; patientId?: string }): Promise<{ ok: true }>;
  startStreaming(): Promise<{ ok: true }>;
  stopStreaming(): Promise<{ ok: true }>;
  disconnect(): Promise<{ ok: true }>;
  addListener(event: 'hr'|'spo2'|'temp'|'hrv'|'battery'|'telemetry', cb: (e: RingEvent) => void): Promise<{ remove: () => void }>;
};

export const NexRing = registerPlugin<NexRingPlugin>('NexRing');
