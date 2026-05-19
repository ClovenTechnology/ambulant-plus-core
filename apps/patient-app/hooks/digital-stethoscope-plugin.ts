// apps/patient-app/hooks/digital-stethoscope-plugin.ts

import { registerPlugin } from '@capacitor/core';
import type {
  StethEchoMode,
  StethStreamKind,
} from '@/src/lib/stethoscope-types';

export type StethStatusEvent = {
  type: 'status';
  connected: boolean;
  batteryPct?: number | null;
  volumeLevel?: number | null;
  echoMode?: number | null;
  agcGain?: number | null;
  deviceName?: string | null;
  deviceId?: string | null;
};

export type StethScanResultEvent = {
  type?: 'scanResult';
  name?: string | null;
  mac?: string | null;
  rssi?: number | null;
};

export type StethAudioFrameEvent = {
  type: 'audioFrame' | 'rawAudioFrame' | 'filteredAudioFrame';
  pcm16Base64: string;
  sampleRate: number;
  channels: number;
  ts: number;
};

export type StethNoteEvent = {
  type: 'note';
  text: string;
  ts?: number;
};

export type StethResultEvent = {
  type: 'result';
  heartRate?: number | null;
  ts: number;
};

export type StethExceptionEvent = {
  type: 'exception';
  code?: number | null;
  message?: string | null;
  ts: number;
};

export type StethSyncEvent = {
  type: 'sync';
  inProgress: boolean;
  ts: number;
};

export type StethEvent =
  | StethStatusEvent
  | StethScanResultEvent
  | StethAudioFrameEvent
  | StethNoteEvent
  | StethResultEvent
  | StethExceptionEvent
  | StethSyncEvent;

export type DigitalStethoscopeStartAuscultationOptions = {
  site?: string;
  sampleRate?: number;
  echoMode?: StethEchoMode;
  agcGain?: number;
  streamKind?: StethStreamKind;
};

export type DigitalStethoscopePluginListenerHandle = {
  remove: () => Promise<void>;
};

export type DigitalStethoscopePlugin = {
  askPermissions(): Promise<{ ok: true }>;

  startScan(): Promise<{ ok: true }>;
  stopScan(): Promise<{ ok: true }>;

  connect(options: { mac: string }): Promise<{ ok: true }>;
  disconnect(): Promise<{ ok: true }>;

  startAuscultation(
    options: DigitalStethoscopeStartAuscultationOptions
  ): Promise<{ ok: true }>;

  stopAuscultation(): Promise<{ ok: true }>;

  setEchoMode?(options: { echoMode: StethEchoMode }): Promise<{ ok: true }>;
  setAgcGain?(options: { gain: number }): Promise<{ ok: true }>;

  addListener(
    eventName:
      | 'status'
      | 'scanResult'
      | 'audioFrame'
      | 'rawAudioFrame'
      | 'filteredAudioFrame'
      | 'note'
      | 'result'
      | 'exception'
      | 'sync',
    listenerFunc: (data: StethEvent) => void
  ): Promise<DigitalStethoscopePluginListenerHandle>;
};

export const DigitalStethoscope =
  registerPlugin<DigitalStethoscopePlugin>('DigitalStethoscope');