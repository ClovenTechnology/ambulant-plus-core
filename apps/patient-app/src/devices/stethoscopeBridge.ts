//apps/patient-app/src/devices/stethoscopeBridge.ts
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { DigitalStethoscope } from '@/hooks/digital-stethoscope-plugin';
import { StethoscopeNUS } from '@/src/devices/decoders/stethoscopeNUS';
import type { PcmChunk } from '@/src/devices/decoders/wav';
import type {
  StethEchoMode,
  StethNativeAudioEvent,
  StethNativeEvent,
  StethStreamKind,
  StethTelemetry,
} from '@/src/lib/stethoscope-types';

type BridgeHandlers = {
  onEvent?: (evt: StethNativeEvent) => void;
  onTelemetry?: (telemetry: StethTelemetry) => void;
  onDisconnect?: () => void;
  onError?: (message: string) => void;
  onScanResult?: (device: StethScanDevice) => void;
};

export type StartAuscultationOptions = {
  site?: string;
  sampleRate?: number;
  echoMode?: StethEchoMode;
  agcGain?: number;
  streamKind?: StethStreamKind;
};

export type StethScanDevice = {
  id: string;
  name?: string | null;
  mac?: string | null;
  rssi?: number | null;
};

function isNativePlatform() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function pcm16Base64ToInt16(base64: string): Int16Array {
  const bin = atob(base64);
  const len = bin.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);

  const sampleCount = Math.floor(u8.length / 2);
  const out = new Int16Array(sampleCount);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  for (let i = 0; i < sampleCount; i++) {
    out[i] = dv.getInt16(i * 2, true);
  }
  return out;
}


function int16ToBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.length * 2);
  const dv = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i += 1) {
    dv.setInt16(i * 2, samples[i], true);
  }

  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    let part = '';
    for (let j = 0; j < sub.length; j += 1) {
      part += String.fromCharCode(sub[j]);
    }
    binary += part;
  }

  return btoa(binary);
}


function mapEchoMode(v?: number | null): StethEchoMode | null {
  if (v == null) return null;
  if (v === 1) return 'lung';
  return 'heart';
}

export class StethoscopeBridge {
  private listeners: PluginListenerHandle[] = [];
  private handlers: BridgeHandlers = {};
  private telemetry: StethTelemetry = { updatedAt: Date.now() };
  private connected = false;
  private webNus: StethoscopeNUS | null = null;
  private webSelectedDeviceName: string | undefined;
  private webSelectedDeviceId: string | undefined;

  get isNative() {
    return isNativePlatform();
  }

  getTelemetry() {
    return this.telemetry;
  }

  getConnected() {
    return this.connected;
  }

  setHandlers(handlers: BridgeHandlers) {
    this.handlers = handlers;
  }

  async askPermissions() {
    if (!this.isNative) return { ok: true as const };
    return DigitalStethoscope.askPermissions();
  }

  async startScan() {
    if (!this.isNative) {
      return { ok: true as const };
    }
    await this.ensureListeners();
    return DigitalStethoscope.startScan();
  }

  async stopScan() {
    if (!this.isNative) return { ok: true as const };
    return DigitalStethoscope.stopScan();
  }

  async connect(mac?: string) {
    await this.ensureListeners();

    if (!this.isNative) {
      this.webNus = new StethoscopeNUS({
        sampleRate: 8000,
        playToSpeaker: false,
        onChunk: (chunk: PcmChunk) => {
          const b64 = int16ToBase64(chunk.samples);
          this.handleEvent({
            type: 'audioFrame',
            pcm16Base64: b64,
            sampleRate: chunk.sampleRate,
            channels: 1,
            ts: chunk.ts,
          });
        },
        onTelemetry: (t) => {
          this.webSelectedDeviceName = t.deviceName;
          this.webSelectedDeviceId = t.deviceId;
          this.connected = true;
          this.telemetry = {
            ...this.telemetry,
            ...t,
            updatedAt: Date.now(),
            connected: true,
          };
          this.handlers.onTelemetry?.(this.telemetry);
        },
        onDisconnected: ({ reason }) => {
          this.connected = false;
          this.telemetry = {
            ...this.telemetry,
            updatedAt: Date.now(),
            connected: false,
          };
          this.handlers.onTelemetry?.(this.telemetry);
          this.handlers.onDisconnect?.();
          this.handlers.onError?.(`Stethoscope disconnected: ${reason}`);
        },
        onGap: ({ gapMs }) => {
          this.handlers.onError?.(`Audio gap detected (${gapMs} ms).`);
        },
      });

      await this.webNus.requestAndConnect();

      this.connected = true;
      this.telemetry = {
        ...this.telemetry,
        updatedAt: Date.now(),
        connected: true,
        deviceName: this.webSelectedDeviceName,
        deviceId: this.webSelectedDeviceId,
      };
      this.handlers.onTelemetry?.(this.telemetry);
      return { ok: true as const };
    }

    if (!mac || !mac.trim()) {
      throw new Error('A device MAC address is required on native scan-connect flow.');
    }

    return DigitalStethoscope.connect({ mac: mac.trim() });
  }

  async disconnect() {
    this.connected = false;

    if (!this.isNative) {
      try {
        await this.webNus?.stop();
      } catch {}
      this.webNus = null;
      this.telemetry = {
        ...this.telemetry,
        updatedAt: Date.now(),
        connected: false,
      };
      this.handlers.onTelemetry?.(this.telemetry);
      return { ok: true as const };
    }

    return DigitalStethoscope.disconnect();
  }

  async startAuscultation(opts: StartAuscultationOptions = {}) {
    if (!this.isNative) {
      return { ok: true as const };
    }

    return DigitalStethoscope.startAuscultation({
      site: opts.site,
      sampleRate: opts.sampleRate ?? 8000,
      echoMode: opts.echoMode ?? 'heart',
      agcGain: opts.agcGain ?? 0,
      streamKind: opts.streamKind ?? 'filtered',
    });
  }

  async stopAuscultation() {
    if (!this.isNative) return { ok: true as const };
    return DigitalStethoscope.stopAuscultation();
  }

  async setEchoMode(echoMode: StethEchoMode) {
    if (!this.isNative || !DigitalStethoscope.setEchoMode) return { ok: true as const };
    return DigitalStethoscope.setEchoMode({ echoMode });
  }

  async setAgcGain(gain: number) {
    if (!this.isNative || !DigitalStethoscope.setAgcGain) return { ok: true as const };
    return DigitalStethoscope.setAgcGain({ gain });
  }

  decodeAudioFrame(evt: StethNativeAudioEvent) {
    return pcm16Base64ToInt16(evt.pcm16Base64);
  }

  async destroy() {
    for (const h of this.listeners) {
      try {
        await h.remove();
      } catch {}
    }
    this.listeners = [];

    try {
      await this.webNus?.stop();
    } catch {}
    this.webNus = null;
  }

  private async ensureListeners() {
    if (!this.isNative || this.listeners.length) return;

    const add = async (
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
    ) => {
      const handle = await DigitalStethoscope.addListener(eventName, (evt: any) => {
        if (eventName === 'scanResult') {
          const device: StethScanDevice = {
            id: String(evt?.mac || evt?.name || crypto.randomUUID()),
            name: evt?.name ?? null,
            mac: evt?.mac ?? null,
            rssi: typeof evt?.rssi === 'number' ? evt.rssi : null,
          };
          this.handlers.onScanResult?.(device);
          return;
        }
        this.handleEvent(evt as StethNativeEvent);
      });
      this.listeners.push(handle);
    };

    await add('status');
    await add('scanResult');
    await add('audioFrame');
    await add('rawAudioFrame');
    await add('filteredAudioFrame');
    await add('note');
    await add('result');
    await add('exception');
    await add('sync');
  }

  private handleEvent(evt: StethNativeEvent) {
    if (evt.type === 'status') {
      this.connected = !!evt.connected;
      this.telemetry = {
        ...this.telemetry,
        updatedAt: Date.now(),
        connected: !!evt.connected,
        batteryPct: evt.batteryPct ?? this.telemetry.batteryPct ?? null,
        volumeLevel: evt.volumeLevel ?? this.telemetry.volumeLevel ?? null,
        echoMode: mapEchoMode(evt.echoMode),
        agcGain: evt.agcGain ?? this.telemetry.agcGain ?? null,
        deviceName: evt.deviceName ?? this.telemetry.deviceName,
        deviceId: evt.deviceId ?? this.telemetry.deviceId,
      };
      this.handlers.onTelemetry?.(this.telemetry);
      if (!evt.connected) this.handlers.onDisconnect?.();
    }

    if (evt.type === 'exception') {
      const msg = evt.message || `Stethoscope exception${evt.code != null ? ` (${evt.code})` : ''}`;
      this.handlers.onError?.(msg);
    }

    this.handlers.onEvent?.(evt);
  }
}