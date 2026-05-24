// ============================================================================
// apps/patient-app/src/devices/decoders/stethoscopeNUS.ts
// NUS RX -> PCM16LE, PCM16->Float32 conversion, HPF + gain, optional playback.
// Emits:
//   - 'stethoscope:chunk' { float32, ts, sampleRate, metrics }
//   - 'stethoscope:gap'   { gapMs, ts }
//   - 'stethoscope:telemetry' { ... }
// ============================================================================

import { API } from '@/src/lib/config';
import type { PcmChunk } from './wav';
import { cleanStethoscopePcmChunk } from './wav';
import { pcm16ToFloat32 } from './audio';

const NUS_SVC = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_TX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_RX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

const SVC_BATTERY = 0x180f;
const CH_BATTERY_LEVEL = 0x2a19;

const SVC_DEVICE_INFO = 0x180a;
const CH_MANUFACTURER = 0x2a29;
const CH_MODEL = 0x2a24;
const CH_FIRMWARE = 0x2a26;

export type StethoscopeChunkMetrics = {
  rms: number;
  peak: number;
  clipPct: number;
  dc: number;
  zcrPerSec: number;
  levelHint: 'too_quiet' | 'ok' | 'too_loud' | 'clipping';
};

export type StethoscopeTelemetry = {
  updatedAt: number;
  deviceName?: string;
  deviceId?: string;
  manufacturer?: string;
  model?: string;
  firmware?: string;
  batteryPct?: number;
};

type Options = {
  sampleRate?: number;
  playToSpeaker?: boolean;
  roomId?: string;
  onChunk?: (chunk: PcmChunk) => void;

  gain?: number;
  hpAlpha?: number;

  gapWarnMs?: number;

  tooQuietRms?: number;
  tooLoudRms?: number;
  clipAbs?: number;
  clipPctWarn?: number;

  onGap?: (info: { gapMs: number; ts: number }) => void;
  onDisconnected?: (info: { reason: string }) => void;
  onTelemetry?: (telemetry: StethoscopeTelemetry) => void;
};

type ResolvedOptions = {
  sampleRate: number;
  playToSpeaker: boolean;
  roomId?: string;
  onChunk: (chunk: PcmChunk) => void;

  gain: number;
  hpAlpha: number;

  gapWarnMs: number;

  tooQuietRms: number;
  tooLoudRms: number;
  clipAbs: number;
  clipPctWarn: number;

  onGap?: Options['onGap'];
  onDisconnected?: Options['onDisconnected'];
  onTelemetry?: Options['onTelemetry'];
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function toStrictArrayBuffer(data: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  return buffer;
}

function getBluetooth(): Bluetooth {
  if (typeof navigator === 'undefined' || !navigator.bluetooth) {
    throw new Error('Web Bluetooth not supported in this browser.');
  }

  return navigator.bluetooth;
}

// Safe base64 encoder without spreading large arrays.
function u8ToB64(u8: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < u8.length; i += chunkSize) {
    const sub = u8.subarray(i, i + chunkSize);
    let part = '';

    for (let j = 0; j < sub.length; j += 1) {
      part += String.fromCharCode(sub[j]);
    }

    binary += part;
  }

  return window.btoa(binary);
}

function decodeUtf8(u8: Uint8Array): string {
  try {
    return new TextDecoder('utf-8').decode(u8).replace(/\0+$/g, '').trim();
  } catch {
    let text = '';

    for (let i = 0; i < u8.length; i += 1) {
      text += String.fromCharCode(u8[i]);
    }

    return text.replace(/\0+$/g, '').trim();
  }
}

export class StethoscopeNUS {
  private device?: BluetoothDevice;
  private server?: BluetoothRemoteGATTServer;
  private rx?: BluetoothRemoteGATTCharacteristic;
  private tx?: BluetoothRemoteGATTCharacteristic;
  private ac?: AudioContext;

  private opts: ResolvedOptions;

  private lastRxAt = 0;
  private lastSign = 0;
  private telemetry: StethoscopeTelemetry = { updatedAt: Date.now() };

  private onDisconnectedBound = (): void => {
    try {
      this.opts.onDisconnected?.({ reason: 'gattserverdisconnected' });
    } catch {
      // Ignore callback failures.
    }

    this.teardownConnectionOnly();
  };

  constructor(opts: Options = {}) {
    this.opts = {
      sampleRate: opts.sampleRate ?? 8000,
      playToSpeaker: opts.playToSpeaker ?? true,
      roomId: opts.roomId,
      onChunk: opts.onChunk ?? (() => {}),

      gain: opts.gain ?? 0.6,
      hpAlpha: opts.hpAlpha ?? 0.995,

      gapWarnMs: opts.gapWarnMs ?? 250,

      tooQuietRms: opts.tooQuietRms ?? 0.02,
      tooLoudRms: opts.tooLoudRms ?? 0.25,
      clipAbs: opts.clipAbs ?? 0.98,
      clipPctWarn: opts.clipPctWarn ?? 0.5,

      onGap: opts.onGap,
      onDisconnected: opts.onDisconnected,
      onTelemetry: opts.onTelemetry,
    };
  }

  async requestAndConnect(): Promise<void> {
    const bluetooth = getBluetooth();

    this.device = await bluetooth.requestDevice({
      filters: [
        { services: [NUS_SVC], namePrefix: 'HC-21' },
        { services: [NUS_SVC], namePrefix: 'HC21' },
        { services: [NUS_SVC] },
      ],
      optionalServices: [NUS_SVC, SVC_BATTERY, SVC_DEVICE_INFO],
    });

    try {
      this.device.removeEventListener(
        'gattserverdisconnected',
        this.onDisconnectedBound as EventListener
      );
    } catch {
      // Ignore.
    }

    this.device.addEventListener(
      'gattserverdisconnected',
      this.onDisconnectedBound as EventListener
    );

    await this.connectGattAndArm();

    this.lastRxAt = 0;
    this.lastSign = 0;

    try {
      await this.refreshTelemetry();
    } catch {
      // Telemetry is best-effort.
    }
  }

  async reconnect(): Promise<void> {
    if (!this.device) {
      throw new Error('No previously selected device to reconnect.');
    }

    this.teardownConnectionOnly();

    try {
      this.device.removeEventListener(
        'gattserverdisconnected',
        this.onDisconnectedBound as EventListener
      );
    } catch {
      // Ignore.
    }

    this.device.addEventListener(
      'gattserverdisconnected',
      this.onDisconnectedBound as EventListener
    );

    await this.connectGattAndArm();

    this.lastRxAt = 0;
    this.lastSign = 0;

    try {
      await this.refreshTelemetry();
    } catch {
      // Telemetry is best-effort.
    }
  }

  private async connectGattAndArm(): Promise<void> {
    if (!this.device?.gatt) {
      throw new Error('Device has no GATT server.');
    }

    this.server = await this.device.gatt.connect();

    const service = await this.server.getPrimaryService(NUS_SVC);
    this.tx = await service.getCharacteristic(NUS_TX);
    this.rx = await service.getCharacteristic(NUS_RX);

    await this.rx.startNotifications();

    try {
      this.rx.removeEventListener(
        'characteristicvaluechanged',
        this.onRx as EventListener
      );
    } catch {
      // Ignore.
    }

    this.rx.addEventListener(
      'characteristicvaluechanged',
      this.onRx as EventListener
    );

    if (this.opts.playToSpeaker) {
      this.ac = new AudioContext({ sampleRate: this.opts.sampleRate });

      try {
        if (this.ac.state === 'suspended') {
          await this.ac.resume();
        }
      } catch {
        // Ignore resume failure.
      }
    }

    try {
      await this.tx.writeValue(toStrictArrayBuffer(Uint8Array.of(0x01)));
    } catch {
      // Some devices may not require an explicit start command.
    }
  }

  async refreshTelemetry(): Promise<StethoscopeTelemetry> {
    const telemetry: StethoscopeTelemetry = {
      updatedAt: Date.now(),
      deviceName: this.device?.name || undefined,
      deviceId: this.device?.id ? String(this.device.id) : undefined,
    };

    try {
      if (this.server) {
        const service = await this.server.getPrimaryService(SVC_BATTERY);
        const characteristic = await service.getCharacteristic(CH_BATTERY_LEVEL);
        const value = await characteristic.readValue();
        const pct = value.getUint8(0);

        if (Number.isFinite(pct)) {
          telemetry.batteryPct = pct;
        }
      }
    } catch {
      // Battery is optional.
    }

    const readText = async (charUuid: number): Promise<string | undefined> => {
      if (!this.server) return undefined;

      try {
        const service = await this.server.getPrimaryService(SVC_DEVICE_INFO);
        const characteristic = await service.getCharacteristic(charUuid);
        const value = await characteristic.readValue();

        return decodeUtf8(
          new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
        );
      } catch {
        return undefined;
      }
    };

    telemetry.manufacturer = (await readText(CH_MANUFACTURER)) || undefined;
    telemetry.model = (await readText(CH_MODEL)) || undefined;
    telemetry.firmware = (await readText(CH_FIRMWARE)) || undefined;

    this.telemetry = telemetry;

    try {
      this.opts.onTelemetry?.(telemetry);
    } catch {
      // Ignore callback failures.
    }

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('stethoscope:telemetry', { detail: telemetry })
        );
      }
    } catch {
      // Ignore event dispatch failures.
    }

    return telemetry;
  }

  private onRx = (event: Event): void => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic | null)?.value;
    if (!value) return;

    const u8 = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    const len = u8.length & ~1;

    if (len <= 0) return;

    const samples = new Int16Array(len / 2);
    const dv = new DataView(u8.buffer, u8.byteOffset, len);

    for (let i = 0; i < len; i += 2) {
      samples[i >> 1] = dv.getInt16(i, true);
    }

    const ts = Date.now();

    if (this.lastRxAt > 0) {
      const gapMs = ts - this.lastRxAt;

      if (gapMs > this.opts.gapWarnMs) {
        try {
          this.opts.onGap?.({ gapMs, ts });
        } catch {
          // Ignore callback failures.
        }

        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('stethoscope:gap', {
                detail: { gapMs, ts },
              })
            );
          }
        } catch {
          // Ignore event dispatch failures.
        }
      }
    }

    this.lastRxAt = ts;

    const rawChunk: PcmChunk = {
      ts,
      sampleRate: this.opts.sampleRate,
      samples,
    };

    const chunk = cleanStethoscopePcmChunk(rawChunk, {
      hpAlpha: this.opts.hpAlpha,
      gain: this.opts.gain,
      limit: 0.92,
    });

    try {
      this.opts.onChunk(chunk);
    } catch (err) {
      console.warn('[StethoscopeNUS] onChunk error', err);
    }

    if (this.opts.roomId) {
      const payloadB64 = u8ToB64(u8.subarray(0, len));

      fetch(`${API}/api/insight/frame`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'stethoscope_pcm16',
          ts,
          sampleRate: this.opts.sampleRate,
          roomId: this.opts.roomId,
          payloadB64,
        }),
      }).catch(() => {
        // Do not interrupt live audio streaming if telemetry upload fails.
      });
    }

    this.handleChunkForPlaybackAndUI(chunk);
  };

  private highpass(samples: Float32Array, alpha = 0.995): Float32Array {
    let last = 0;
    let lastOut = 0;

    const out = new Float32Array(samples.length);

    for (let i = 0; i < samples.length; i += 1) {
      const x = samples[i];
      const hp = alpha * (lastOut + x - last);

      out[i] = hp;
      last = x;
      lastOut = hp;
    }

    return out;
  }

  private computeMetrics(
    samples: Float32Array,
    sampleRate: number
  ): StethoscopeChunkMetrics {
    let sumSq = 0;
    let maxAbs = 0;
    let clip = 0;
    let dcSum = 0;
    let zeroCrossings = 0;
    let lastSign = this.lastSign;

    const clipAbs = this.opts.clipAbs;

    for (let i = 0; i < samples.length; i += 1) {
      const x = samples[i] || 0;
      const absX = Math.abs(x);

      if (absX > maxAbs) maxAbs = absX;
      if (absX >= clipAbs) clip += 1;

      sumSq += x * x;
      dcSum += x;

      const sign = x >= 0 ? 1 : -1;

      if (lastSign !== 0 && sign !== lastSign) {
        zeroCrossings += 1;
      }

      lastSign = sign;
    }

    this.lastSign = lastSign;

    const sampleCount = Math.max(1, samples.length);
    const rms = Math.sqrt(sumSq / sampleCount);
    const dc = dcSum / sampleCount;
    const clipPct = (clip / sampleCount) * 100;
    const durationSec = sampleCount / Math.max(1, sampleRate);
    const zcrPerSec = durationSec > 0 ? zeroCrossings / durationSec : 0;

    let levelHint: StethoscopeChunkMetrics['levelHint'] = 'ok';

    if (clipPct >= this.opts.clipPctWarn || maxAbs >= 0.999) {
      levelHint = 'clipping';
    } else if (rms < this.opts.tooQuietRms) {
      levelHint = 'too_quiet';
    } else if (rms > this.opts.tooLoudRms) {
      levelHint = 'too_loud';
    }

    return {
      rms: clamp01(rms),
      peak: clamp01(maxAbs),
      clipPct,
      dc,
      zcrPerSec,
      levelHint,
    };
  }

  private handleChunkForPlaybackAndUI(chunk: PcmChunk): void {
    const float32 = pcm16ToFloat32(chunk.samples);
    const metrics = this.computeMetrics(float32, chunk.sampleRate);

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('stethoscope:chunk', {
            detail: {
              float32,
              ts: chunk.ts,
              sampleRate: chunk.sampleRate,
              metrics,
            },
          })
        );
      }
    } catch (err) {
      console.warn('[StethoscopeNUS] stethoscope:chunk dispatch failed', err);
    }

    if (this.opts.playToSpeaker) {
      this.playChunk(float32);
    }
  }

  private playCursorSec = 0;

  private playChunk(float32: Float32Array): void {
    try {
      if (!this.ac) {
        this.ac = new AudioContext({ sampleRate: this.opts.sampleRate });
      }

      const buffer = this.ac.createBuffer(
        1,
        float32.length,
        this.opts.sampleRate
      );

      buffer.getChannelData(0).set(float32);

      const source = this.ac.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ac.destination);

      const now = this.ac.currentTime;
      const startAt = Math.max(now + 0.015, this.playCursorSec || 0);
      source.start(startAt);
      this.playCursorSec = startAt + buffer.duration;
    } catch (err) {
      console.warn('[StethoscopeNUS] playChunk error', err);
    }
  }

  async stop(): Promise<void> {
    try {
      await this.tx?.writeValue(toStrictArrayBuffer(Uint8Array.of(0x02)));
    } catch {
      // Ignore stop-command failures.
    }

    try {
      await this.rx?.stopNotifications();
    } catch {
      // Ignore notification shutdown failures.
    }

    this.teardownConnectionOnly();
  }

  private teardownConnectionOnly(): void {
    try {
      this.rx?.removeEventListener(
        'characteristicvaluechanged',
        this.onRx as EventListener
      );
    } catch {
      // Ignore.
    }

    try {
      this.device?.removeEventListener(
        'gattserverdisconnected',
        this.onDisconnectedBound as EventListener
      );
    } catch {
      // Ignore.
    }

    try {
      this.server?.disconnect();
    } catch {
      // Ignore.
    }

    if (this.ac) {
      try {
        void this.ac.close();
      } catch {
        // Ignore.
      }

      this.ac = undefined;
    }

    this.playCursorSec = 0;

    this.rx = undefined;
    this.tx = undefined;
    this.server = undefined;
    // Keep this.device for reconnect().
  }
}