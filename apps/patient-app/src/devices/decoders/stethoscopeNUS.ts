// ============================================================================
// apps/patient-app/src/devices/decoders/stethoscopeNUS.ts
// NUS RX -> PCM16LE, PCM16->Float32 conversion, simple HPF + gain, speaker playback,
// emits CustomEvent 'stethoscope:chunk', and preserves InsightCore upload/onChunk hook.
// ============================================================================

import { API } from '@/src/lib/config';
import type { PcmChunk } from './wav';
import { pcm16ToFloat32 } from './audio';

const NUS_SVC = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_TX  = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_RX  = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

type Options = {
  sampleRate?: number;      // 8000 or 16000 (we default to 8000)
  playToSpeaker?: boolean;  // default true
  roomId?: string;
  onChunk?: (c: PcmChunk) => void;
  gain?: number;            // scaling applied after HPF (0..1 recommended, default 0.6)
  hpAlpha?: number;         // alpha for the highpass function (default 0.995)
};

export class StethoscopeNUS {
  private device?: BluetoothDevice;
  private server?: BluetoothRemoteGATTServer;
  private rx?: BluetoothRemoteGATTCharacteristic;
  private tx?: BluetoothRemoteGATTCharacteristic;
  private ac?: AudioContext;
  private opts: Required<Options>;

  constructor(opts: Options = {}) {
    this.opts = {
      sampleRate: opts.sampleRate ?? 8000,
      playToSpeaker: opts.playToSpeaker ?? true,
      roomId: opts.roomId ?? undefined,
      onChunk: opts.onChunk ?? (() => {}),
      gain: opts.gain ?? 0.6,
      hpAlpha: opts.hpAlpha ?? 0.995,
    };
  }

  async requestAndConnect() {
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [NUS_SVC] }, { namePrefix: 'HC-21' }, { namePrefix: 'HC21' }],
      optionalServices: [NUS_SVC, 0x180F, 0x180A],
    });
    this.device.addEventListener('gattserverdisconnected', () => this.teardown());
    this.server = await this.device.gatt!.connect();

    const svc = await this.server.getPrimaryService(NUS_SVC);
    this.tx = await svc.getCharacteristic(NUS_TX);
    this.rx = await svc.getCharacteristic(NUS_RX);

    await this.rx.startNotifications();
    this.rx.addEventListener('characteristicvaluechanged', this.onRx);

    if (this.opts.playToSpeaker) this.ac = new AudioContext({ sampleRate: this.opts.sampleRate });
    try { await this.tx.writeValue(Uint8Array.of(0x01)); } catch {} // start stream if required
  }

  private onRx = (ev: Event) => {
    const dv = (ev.target as BluetoothRemoteGATTCharacteristic).value!;
    // Characteristic provides raw PCM16LE frames (confirmed in serviceMap notes)
    const u8 = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
    const len = u8.length & ~1;
    const s16 = new Int16Array(len / 2);
    for (let i = 0; i < len; i += 2) s16[i >> 1] = u8[i] | (u8[i + 1] << 8);
    const ts = Date.now();
    const chunk: PcmChunk = { ts, sampleRate: this.opts.sampleRate, samples: s16 };

    // keep original hook for backwards compatibility
    try { this.opts.onChunk(chunk); } catch (err) { console.warn('onChunk error', err); }

    // Upload to InsightCore if configured
    if (this.opts.roomId) {
      const b64 = btoa(String.fromCharCode(...new Uint8Array(s16.buffer)));
      fetch(`${API}/api/insight/frame`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'stethoscope_pcm16', ts, sampleRate: this.opts.sampleRate, roomId: this.opts.roomId, payloadB64: b64 }),
      }).catch(() => {});
    }

    // Centralized conversion + noise reduction + event emission + playback
    this.handleChunkForPlaybackAndUI(chunk);
  };

  // The exact highpass function you specified (returns new Float32Array)
  private highpass(samples: Float32Array, alpha = 0.995): Float32Array {
    let last = 0, lastOut = 0;
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

  // convert PCM16 -> Float32, apply highpass (per your function) BEFORE play,
  // then apply gain, emit event and optionally play the filtered buffer.
  private handleChunkForPlaybackAndUI(chunk: PcmChunk) {
    // pcm16ToFloat32 expects an ArrayBuffer of Int16 PCM; returns Float32Array [-1..1]
    const float32 = pcm16ToFloat32(chunk.samples.buffer);

    // Apply highpass using the provided function and configured alpha
    const hp = this.highpass(float32, this.opts.hpAlpha);

    // Apply conservative gain scaling to avoid harsh clipping / noisy bursts
    const gain = Math.min(1, Math.max(0, this.opts.gain)); // clamp 0..1
    if (gain !== 1) {
      for (let i = 0; i < hp.length; i++) hp[i] *= gain;
    }

    // Emit CustomEvent so UI consumers can draw waveform without passing onChunk
    try {
      const ev = new CustomEvent('stethoscope:chunk', {
        detail: { float32: hp, ts: chunk.ts, sampleRate: chunk.sampleRate },
      });
      // dispatch globally; consumers can addEventListener on window
      window.dispatchEvent(ev);
    } catch (err) {
      console.warn('stethoscope:chunk dispatch failed', err);
    }

    // Play the filtered/high-passed buffer (per your request: apply highpass before play)
    if (this.opts.playToSpeaker) {
      this.playChunk(hp);
    }
  }

  // Helper to play Float32Array to the AudioContext
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
      // swallow audio playback errors to avoid breaking the stream
      console.warn('StethoscopeNUS playChunk error', err);
    }
  }

  async stop() {
    try { await this.tx?.writeValue(Uint8Array.of(0x02)); } catch {}
    try { await this.rx?.stopNotifications(); } catch {}
    this.teardown();
  }

  private teardown() {
    this.rx?.removeEventListener('characteristicvaluechanged', this.onRx);
    try { this.server?.disconnect(); } catch {}
    if (this.ac) { this.ac.close(); this.ac = undefined; }
  }
}
