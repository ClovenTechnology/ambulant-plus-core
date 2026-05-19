// apps/patient-app/hooks/nexring-plugin.ts

import { registerPlugin } from '@capacitor/core';

export type NexRingScanResult = {
  id?: string;
  mac?: string;
  name?: string;
  rssi?: number;
  isConnectable?: boolean;
  advBase64?: string;
};

export type NexRingConnectionStateEvent = {
  state:
    | 'idle'
    | 'scanning'
    | 'scan_stopped'
    | 'connecting'
    | 'connected'
    | 'ready'
    | 'disconnecting'
    | 'disconnected'
    | 'error'
    | string;
  id?: string;
  mac?: string;
  name?: string;
  message?: string;
};

export type NexRingMtuEvent = {
  mtu?: number | null;
};

export type NexRingNotifyEvent = {
  base64: string;
  hex?: string;
  length?: number;
  serviceUuid?: string;
  characteristicUuid?: string;
};

export type NexRingErrorEvent = {
  code: string;
  message: string;
};

export type NexRingLegacyEvent =
  | { type: 'hr'; hr: number }
  | { type: 'spo2'; spo2: number }
  | { type: 'temp'; celsius: number }
  | { type: 'hrv'; rmssd: number }
  | { type: 'battery'; pct: number }
  | { type: 'telemetry'; rssi?: number | null };

export type NexRingPluginListenerHandle = {
  remove: () => Promise<void> | void;
};

export type NexRingPlugin = {
  askPermissions(): Promise<void | { ok?: boolean; message?: string }>;

  startScan(): Promise<void | { ok?: boolean; message?: string }>;
  stopScan(): Promise<void | { ok?: boolean; message?: string }>;

  connect(options: {
    id?: string;
    mac?: string;
    name?: string;
    patientId?: string;
  }): Promise<{ ok: true } | { ok: false; message?: string } | void>;

  requestMtu?(options?: {
    mtu?: number;
  }): Promise<{ ok?: boolean; mtu?: number; message?: string } | void>;

  startStreaming(): Promise<{ ok: true } | { ok: false; message?: string } | void>;
  stopStreaming(): Promise<{ ok: true } | { ok: false; message?: string } | void>;

  write(options: {
    bytes?: number[];
    base64?: string;
  }): Promise<{ ok?: boolean; message?: string } | void>;

  disconnect(): Promise<{ ok: true } | { ok: false; message?: string } | void>;

  addListener(
    event: 'scanResult',
    cb: (event: NexRingScanResult) => void
  ): Promise<NexRingPluginListenerHandle>;

  addListener(
    event: 'connectionState',
    cb: (event: NexRingConnectionStateEvent) => void
  ): Promise<NexRingPluginListenerHandle>;

  addListener(
    event: 'ready',
    cb: () => void
  ): Promise<NexRingPluginListenerHandle>;

  addListener(
    event: 'mtu',
    cb: (event: NexRingMtuEvent) => void
  ): Promise<NexRingPluginListenerHandle>;

  addListener(
    event: 'notify',
    cb: (event: NexRingNotifyEvent) => void
  ): Promise<NexRingPluginListenerHandle>;

  addListener(
    event: 'error',
    cb: (event: NexRingErrorEvent) => void
  ): Promise<NexRingPluginListenerHandle>;

  addListener(
    event: 'hr' | 'spo2' | 'temp' | 'hrv' | 'battery' | 'telemetry',
    cb: (event: NexRingLegacyEvent) => void
  ): Promise<NexRingPluginListenerHandle>;
};

export const NexRing = registerPlugin<NexRingPlugin>('NexRing');