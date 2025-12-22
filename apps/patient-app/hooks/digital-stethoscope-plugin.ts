import { registerPlugin } from '@capacitor/core';

export type StethEvent =
  | { type: 'status'; connected: boolean; batteryPct?: number | null }
  | { type: 'audioFrame'; pcm16Base64: string; sampleRate: number; channels: number; ts: number }
  | { type: 'note'; text: string; ts?: number };

export type DigitalStethoscopePlugin = {
  askPermissions(): Promise<{ ok: true }>;
  startScan(): Promise<{ ok: true }>;
  stopScan(): Promise<{ ok: true }>;
  connect(options: { mac: string }): Promise<{ ok: true }>;
  disconnect(): Promise<{ ok: true }>;
  startAuscultation(options: { site?: string; sampleRate?: number }): Promise<{ ok: true }>;
  stopAuscultation(): Promise<{ ok: true }>;
  addListener(
    eventName: 'status' | 'audioFrame' | 'note',
    listenerFunc: (data: StethEvent) => void
  ): Promise<{ remove: () => void }>;
};

export const DigitalStethoscope = registerPlugin<DigitalStethoscopePlugin>('DigitalStethoscope');
