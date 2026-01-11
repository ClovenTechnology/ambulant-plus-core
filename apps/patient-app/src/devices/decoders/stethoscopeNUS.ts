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
  rms: number; // 0..1
  peak: number; // 0..1
  clipPct: number; // percent of samples near full-scale
  dc: number; // mean (should be near 0)
  zcrPerSec: number; // zero-crossings per second (noise proxy)
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
  sampleRate?: number; // 8000 or 16000 (default 8000)
  playToSpeaker?: boolean; // default true
  roomId?: string;
  onChunk?: (c: PcmChunk) => void;

  gain?: number; // scaling applied after HPF (0..1 recommended, default 0.6)
  hpAlpha?: number; // alpha for the highpass function (default 0.995)

  // Gap detector: if time between rx packets exceeds this, we report a dropout
  gapWarnMs?: number; // default 250

  // Guidance thresholds (technical, non-diagnostic)
  tooQuietRms?: number; // default 0.02
  tooLoudRms?: number; // default 0.25
  clipAbs?: number; // default 0.98
  clipPctWarn?: number; // default 0.5

  // Optional callbacks
  onGap?: (info: { gapMs: number; ts: number }) => void;
  onDisconnected?: (info: { reason: string }) => void;
  onTelemetry?: (t: StethoscopeTelemetry) => void;
};

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

// Safe base64 encoder (no spread)
function u8ToB64(u8: Uint8Array): string {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) {
    const sub = u8.subarray(i, i + CHUNK);
    let part = '';
    for (let j = 0; j < sub.length; j++) part += String.fromCharCode(sub[j]);
    s += part;
  }
  return btoa(s);
}

function decodeUtf8(u8: Uint8Array): string {
  try {
    return new TextDecoder('utf-8').decode(u8).replace(/\0+$/g, '').trim();
  } catch {
    // fallback
    let s = '';
    for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return s.replace(/\0+$/g, '').trim();
  }
}

export class StethoscopeNUS {
  private device?: BluetoothDevice;
  private server?: BluetoothRemoteGATTServer;
  private rx?: BluetoothRemoteGATTCharacteristic;
  private tx?: BluetoothRemoteGATTCharacteristic;
  private ac?: AudioContext;

  private opts: Required<Omit<Options, 'onGap' | 'onDisconnected' | 'onTelemetry'>> & {
    onGap?: Options['onGap'];
    onDisconnected?: Options['onDisconnected'];
    onTelemetry?: Options['onTelemetry'];
  };

  private lastRxAt = 0;
  private lastSign = 0; // for zcr calculation
  private telemetry: StethoscopeTelemetry = { updatedAt: Date.now() };

  private onDisconnectedBound = () => {
    try {
      this.opts.onDisconnected?.({ reason: 'gattserverdisconnected' });
    } catch {}
    this.teardownConnectionOnly();
  };

  constructor(opts: Options = {}) {
    this.opts = {
      sampleRate: opts.sampleRate ?? 8000,
      playToSpeaker: opts.playToSpeaker ?? true,
      roomId: opts.roomId ?? undefined,
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

  async requestAndConnect() {
    if (!('bluetooth' in navigator)) throw new Error('Web Bluetooth not supported in this browser.');

    // IMPORTANT: each filter includes NUS_SVC so we don’t match random HC devices
    this.device = await navigator.bluetooth.requestDevice({
      filters: [
        { services: [NUS_SVC], namePrefix: 'HC-21' },
        { services: [NUS_SVC], namePrefix: 'HC21' },
        { services: [NUS_SVC] },
      ],
      // allow battery + device info reads
      optionalServices: [NUS_SVC, SVC_BATTERY, SVC_DEVICE_INFO],
    });

    // Listener hygiene
    try {
      this.device.removeEventListener('gattserverdisconnected', this.onDisconnectedBound as EventListener);
    } catch {}
    this.device.addEventListener('gattserverdisconnected', this.onDisconnectedBound as EventListener);

    await this.connectGattAndArm();

    this.lastRxAt = 0;
    this.lastSign = 0;

    // Initial telemetry attempt
    try {
      await this.refreshTelemetry();
    } catch {}
  }

  /**
   * Reconnect using the previously selected device (no new picker).
   * Note: Browsers may still require a user gesture; caller should handle errors.
   */
  async reconnect() {
    if (!this.device) throw new Error('No previously selected device to reconnect.');
    // Clean up old connection state but keep device reference
    this.teardownConnectionOnly();

    // Listener hygiene (re-add)
    try {
      this.device.removeEventListener('gattserverdisconnected', this.onDisconnectedBound as EventListener);
    } catch {}
    this.device.addEventListener('gattserverdisconnected', this.onDisconnectedBound as EventListener);

    await this.connectGattAndArm();

    this.lastRxAt = 0;
    this.lastSign = 0;

    try {
      await this.refreshTelemetry();
    } catch {}
  }

  private async connectGattAndArm() {
    if (!this.device?.gatt) throw new Error('Device has no GATT server.');

    this.server = await this.device.gatt.connect();

    const svc = await this.server.getPrimaryService(NUS_SVC);
    this.tx = await svc.getCharacteristic(NUS_TX);
    this.rx = await svc.getCharacteristic(NUS_RX);

    await this.rx.startNotifications();
    try {
      this.rx.removeEventListener('characteristicvaluechanged', this.onRx as EventListener);
    } catch {}
    this.rx.addEventListener('characteristicvaluechanged', this.onRx as EventListener);

    if (this.opts.playToSpeaker) {
      this.ac = new AudioContext({ sampleRate: this.opts.sampleRate });
      try {
        if (this.ac.state === 'suspended') await this.ac.resume();
      } catch {}
    }

    // Some devices require explicit start
    try {
      await this.tx.writeValue(Uint8Array.of(0x01));
    } catch {}
  }

  async refreshTelemetry() {
    const t: StethoscopeTelemetry = {
      updatedAt: Date.now(),
      deviceName: this.device?.name || undefined,
      deviceId: (this.device as any)?.id ? String((this.device as any).id) : undefined,
    };

    // Battery
    try {
      if (this.server) {
        const svc = await this.server.getPrimaryService(SVC_BATTERY as any);
        const ch = await svc.getCharacteristic(CH_BATTERY_LEVEL as any);
        const v = await ch.readValue();
        const pct = v.getUint8(0);
        if (Number.isFinite(pct)) t.batteryPct = pct;
      }
    } catch {
      // ignore
    }

    // Device info
    const readText = async (charUuid: number) => {
      if (!this.server) return undefined;
      try {
        const svc = await this.server.getPrimaryService(SVC_DEVICE_INFO as any);
        const ch = await svc.getCharacteristic(charUuid as any);
        const v = await ch.readValue();
        return decodeUtf8(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
      } catch {
        return undefined;
      }
    };

    t.manufacturer = (await readText(CH_MANUFACTURER)) || undefined;
    t.model = (await readText(CH_MODEL)) || undefined;
    t.firmware = (await readText(CH_FIRMWARE)) || undefined;

    this.telemetry = t;

    try {
      this.opts.onTelemetry?.(t);
    } catch {}

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('stethoscope:telemetry', { detail: t }));
      }
    } catch {}

    return t;
  }

  private onRx = (ev: Event) => {
    const dv = (ev.target as BluetoothRemoteGATTCharacteristic).value!;
    const u8 = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);

    const len = u8.length & ~1; // even length
    if (len <= 0) return;

    // Build Int16 samples explicitly from LE bytes
    const s16 = new Int16Array(len / 2);
    for (let i = 0; i < len; i += 2) s16[i >> 1] = u8[i] | (u8[i + 1] << 8);

    const ts = Date.now();

    // Gap detection
    if (this.lastRxAt > 0) {
      const gapMs = ts - this.lastRxAt;
      if (gapMs > this.opts.gapWarnMs) {
        try {
          this.opts.onGap?.({ gapMs, ts });
        } catch {}
        try {
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('stethoscope:gap', { detail: { gapMs, ts } }));
        } catch {}
      }
    }
    this.lastRxAt = ts;

    const chunk: PcmChunk = { ts, sampleRate: this.opts.sampleRate, samples: s16 };

    // Hook
    try {
      this.opts.onChunk(chunk);
    } catch (err) {
      console.warn('onChunk error', err);
    }

    // Upload to InsightCore (use raw RX bytes, endianness-safe)
    if (this.opts.roomId) {
      const payloadB64 = u8ToB64(u8.subarray(0, len));
      fetch(`${API}/api/insight/frame`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'stethoscope_pcm16',
          ts,
          sampleRate: this.opts.sampleRate,
          roomId: this.opts.roomId,
          payloadB64,
        }),
      }).catch(() => {});
    }

    this.handleChunkForPlaybackAndUI(chunk);
  };

  // HPF
  private highpass(samples: Float32Array, alpha = 0.995): Float32Array {
    let last = 0,
      lastOut = 0;
    const out = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const x = samples[i];
      const hp = alpha * (lastOut + x - last);
      out[i] = hp;
      last = x;
      lastOut = hp;
    }
    return out;
  }

  private computeMetrics(samples: Float32Array, sampleRate: number): StethoscopeChunkMetrics {
    let sumSq = 0;
    let maxAbs = 0;
    let clip = 0;
    let dcSum = 0;
    let zc = 0;
    let lastSign = this.lastSign;

    const clipAbs = this.opts.clipAbs;

    for (let i = 0; i < samples.length; i++) {
      const x = samples[i] || 0;
      const ax = Math.abs(x);
      if (ax > maxAbs) maxAbs = ax;
      if (ax >= clipAbs) clip += 1;
      sumSq += x * x;
      dcSum += x;

      const sign = x >= 0 ? 1 : -1;
      if (lastSign !== 0 && sign !== lastSign) zc += 1;
      lastSign = sign;
    }

    this.lastSign = lastSign;

    const n = Math.max(1, samples.length);
    const rms = Math.sqrt(sumSq / n);
    const dc = dcSum / n;
    const clipPct = (clip / n) * 100;
    const durationSec = n / Math.max(1, sampleRate);
    const zcrPerSec = durationSec > 0 ? zc / durationSec : 0;

    let levelHint: StethoscopeChunkMetrics['levelHint'] = 'ok';
    if (clipPct >= this.opts.clipPctWarn || maxAbs >= 0.999) levelHint = 'clipping';
    else if (rms < this.opts.tooQuietRms) levelHint = 'too_quiet';
    else if (rms > this.opts.tooLoudRms) levelHint = 'too_loud';

    return {
      rms: clamp01(rms),
      peak: clamp01(maxAbs),
      clipPct,
      dc,
      zcrPerSec,
      levelHint,
    };
  }

  private handleChunkForPlaybackAndUI(chunk: PcmChunk) {
    const float32 = pcm16ToFloat32(chunk.samples);
    const hp = this.highpass(float32, this.opts.hpAlpha);

    const gain = Math.min(1, Math.max(0, this.opts.gain));
    if (gain !== 1) {
      for (let i = 0; i < hp.length; i++) hp[i] *= gain;
    }

    const metrics = this.computeMetrics(hp, chunk.sampleRate);

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('stethoscope:chunk', {
            detail: { float32: hp, ts: chunk.ts, sampleRate: chunk.sampleRate, metrics },
          })
        );
      }
    } catch (err) {
      console.warn('stethoscope:chunk dispatch failed', err);
    }

    if (this.opts.playToSpeaker) this.playChunk(hp);
  }

  private playChunk(float32: Float32Array) {
    try {
      if (!this.ac) this.ac = new AudioContext({ sampleRate: this.opts.sampleRate });
      const buf = this.ac.createBuffer(1, float32.length, this.opts.sampleRate);
      buf.getChannelData(0).set(float32);
      const src = this.ac.createBufferSource();
      src.buffer = buf;
      src.connect(this.ac.destination);
      src.start();
    } catch (err) {
      console.warn('StethoscopeNUS playChunk error', err);
    }
  }

  async stop() {
    try {
      await this.tx?.writeValue(Uint8Array.of(0x02));
    } catch {}
    try {
      await this.rx?.stopNotifications();
    } catch {}
    this.teardownConnectionOnly();
  }

  private teardownConnectionOnly() {
    try {
      this.rx?.removeEventListener('characteristicvaluechanged', this.onRx as EventListener);
    } catch {}

    try {
      this.device?.removeEventListener('gattserverdisconnected', this.onDisconnectedBound as EventListener);
    } catch {}

    try {
      this.server?.disconnect();
    } catch {}

    if (this.ac) {
      try {
        this.ac.close();
      } catch {}
      this.ac = undefined;
    }

    this.rx = undefined;
    this.tx = undefined;
    this.server = undefined;
    // keep this.device for reconnect()
  }
}
