// ============================================================================
// apps/patient-app/src/devices/decoders/wav.ts
// Build WAV from PCM16 chunks (explicit little-endian, mono by default).
// Also provides auscultation-specific PCM conditioning for HC-21/DueCare
// stethoscope streams.
// ============================================================================

export type PcmChunk = {
  ts: number;
  sampleRate: number;
  samples: Int16Array;
};

export type StethoscopeAudioMode = 'heart' | 'lung';

export type StethoscopeAudioProfile = {
  /**
   * Heart mode preserves low-frequency S1/S2 content.
   * Lung mode keeps a wider/higher respiratory band.
   */
  mode?: StethoscopeAudioMode;
  sampleRate?: number;
  /**
   * Conservative post-filter gain. Defaults are mode-aware.
   */
  gain?: number;
  /**
   * Soft limiter threshold expressed as absolute Float32 amplitude.
   */
  limit?: number;
};

function writeU32(view: DataView, off: number, v: number) {
  view.setUint32(off, v, true);
}

function writeU16(view: DataView, off: number, v: number) {
  view.setUint16(off, v, true);
}

export function concatPcm16Chunks(chunks: PcmChunk[], sampleRate?: number): Int16Array {
  const filtered = chunks.filter(
    (c) =>
      !!c &&
      c.samples instanceof Int16Array &&
      c.samples.length > 0 &&
      (!sampleRate || c.sampleRate === sampleRate),
  );

  const total = filtered.reduce((n, c) => n + c.samples.length, 0);
  const out = new Int16Array(total);

  let off = 0;
  for (const c of filtered) {
    out.set(c.samples, off);
    off += c.samples.length;
  }

  return out;
}

export function buildWavMono16FromSamples(samples: Int16Array, sampleRate: number): Blob {
  const dataBytes = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);

  u8.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  writeU32(view, 4, 36 + dataBytes);
  u8.set([0x57, 0x41, 0x56, 0x45], 8); // WAVE

  u8.set([0x66, 0x6d, 0x74, 0x20], 12); // fmt
  writeU32(view, 16, 16);
  writeU16(view, 20, 1); // PCM
  writeU16(view, 22, 1); // mono
  writeU32(view, 24, sampleRate);
  writeU32(view, 28, sampleRate * 2);
  writeU16(view, 32, 2);
  writeU16(view, 34, 16);

  u8.set([0x64, 0x61, 0x74, 0x61], 36); // data
  writeU32(view, 40, dataBytes);

  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(off, samples[i], true);
    off += 2;
  }

  return new Blob([buf], { type: 'audio/wav' });
}

function clampInt16(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value > 32767) return 32767;
  if (value < -32768) return -32768;
  return Math.round(value);
}

function clampFloat(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

type BiquadType = 'highpass' | 'lowpass';

class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private z1 = 0;
  private z2 = 0;

  constructor(type: BiquadType, sampleRate: number, frequency: number, q = 0.707) {
    const sr = Math.max(1000, sampleRate || 8000);
    const f = clampFloat(frequency, 1, sr * 0.45);
    const omega = (2 * Math.PI * f) / sr;
    const sin = Math.sin(omega);
    const cos = Math.cos(omega);
    const alpha = sin / (2 * Math.max(0.1, q));

    let b0: number;
    let b1: number;
    let b2: number;
    const a0 = 1 + alpha;
    let a1: number;
    let a2: number;

    if (type === 'highpass') {
      b0 = (1 + cos) / 2;
      b1 = -(1 + cos);
      b2 = (1 + cos) / 2;
      a1 = -2 * cos;
      a2 = 1 - alpha;
    } else {
      b0 = (1 - cos) / 2;
      b1 = 1 - cos;
      b2 = (1 - cos) / 2;
      a1 = -2 * cos;
      a2 = 1 - alpha;
    }

    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
  }

  process(x: number): number {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }

  reset() {
    this.z1 = 0;
    this.z2 = 0;
  }
}

function defaultsForMode(mode: StethoscopeAudioMode) {
  if (mode === 'lung') {
    return {
      highpassHz: 90,
      lowpassHz: 1200,
      gain: 0.9,
      limit: 0.9,
    };
  }

  return {
    highpassHz: 25,
    lowpassHz: 220,
    gain: 1.05,
    limit: 0.88,
  };
}

function softLimit(value: number, limit: number): number {
  const abs = Math.abs(value);
  if (abs <= limit) return value;
  const sign = value < 0 ? -1 : 1;
  const headroom = Math.max(1e-6, 1 - limit);
  return sign * (limit + headroom * Math.tanh((abs - limit) / headroom));
}

export class StethoscopePcm16Processor {
  private readonly sampleRate: number;
  private mode: StethoscopeAudioMode;
  private gain: number;
  private limit: number;
  private highpass: Biquad;
  private lowpass: Biquad;

  constructor(profile: StethoscopeAudioProfile = {}) {
    this.sampleRate = profile.sampleRate ?? 8000;
    this.mode = profile.mode ?? 'heart';

    const d = defaultsForMode(this.mode);
    this.gain = clampFloat(profile.gain ?? d.gain, 0.05, 2);
    this.limit = clampFloat(profile.limit ?? d.limit, 0.4, 0.98);

    this.highpass = new Biquad('highpass', this.sampleRate, d.highpassHz, 0.707);
    this.lowpass = new Biquad('lowpass', this.sampleRate, d.lowpassHz, 0.707);
  }

  setProfile(profile: StethoscopeAudioProfile = {}) {
    const nextMode = profile.mode ?? this.mode;
    const d = defaultsForMode(nextMode);

    this.mode = nextMode;
    this.gain = clampFloat(profile.gain ?? d.gain, 0.05, 2);
    this.limit = clampFloat(profile.limit ?? d.limit, 0.4, 0.98);

    this.highpass = new Biquad('highpass', this.sampleRate, d.highpassHz, 0.707);
    this.lowpass = new Biquad('lowpass', this.sampleRate, d.lowpassHz, 0.707);
  }

  reset() {
    this.highpass.reset();
    this.lowpass.reset();
  }

  process(samples: Int16Array): Int16Array {
    if (!(samples instanceof Int16Array) || samples.length === 0) {
      return new Int16Array();
    }

    // Per-packet baseline removal catches packet-level DC drift before the
    // stateful biquads run. This is deliberately conservative and does not
    // resample or fabricate missing packets.
    let mean = 0;
    for (let i = 0; i < samples.length; i += 1) mean += samples[i];
    mean /= Math.max(1, samples.length);

    const out = new Int16Array(samples.length);

    for (let i = 0; i < samples.length; i += 1) {
      const centered = (samples[i] - mean) / 32768;
      let y = this.highpass.process(centered);
      y = this.lowpass.process(y);
      y *= this.gain;
      y = softLimit(y, this.limit);
      out[i] = clampInt16(y * 32767);
    }

    return out;
  }
}

export function createStethoscopePcm16Processor(
  profile: StethoscopeAudioProfile = {},
): StethoscopePcm16Processor {
  return new StethoscopePcm16Processor(profile);
}

/**
 * Clean a complete auscultation PCM16 stream before waveform display / WAV export.
 * For continuous live streams, prefer createStethoscopePcm16Processor() so filter
 * state is preserved across BLE packets.
 */
export function cleanStethoscopePcm16Samples(
  samples: Int16Array,
  profile: StethoscopeAudioProfile = {},
): Int16Array {
  const processor = createStethoscopePcm16Processor(profile);
  return processor.process(samples);
}

export function cleanStethoscopePcmChunk(
  chunk: PcmChunk,
  profile?: StethoscopeAudioProfile,
): PcmChunk {
  return {
    ...chunk,
    samples: cleanStethoscopePcm16Samples(chunk.samples, {
      ...profile,
      sampleRate: profile?.sampleRate ?? chunk.sampleRate,
    }),
  };
}

/** Concatenate PCM16 chunks and emit 16-bit mono WAV Blob. */
export function buildWavMono16(chunks: PcmChunk[], sampleRate: number): Blob {
  const samples = concatPcm16Chunks(chunks, sampleRate);
  return buildWavMono16FromSamples(samples, sampleRate);
}

export class WavRecorder {
  private chunks: PcmChunk[] = [];
  private readonly sampleRate: number;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  push(c: PcmChunk) {
    if (!c || !(c.samples instanceof Int16Array) || c.samples.length === 0) return;
    if (c.sampleRate !== this.sampleRate) return;
    this.chunks.push(c);
  }

  getChunkCount() {
    return this.chunks.length;
  }

  getSampleCount() {
    return this.chunks.reduce((n, c) => n + c.samples.length, 0);
  }

  getDurationMs() {
    const totalSamples = this.getSampleCount();
    return this.sampleRate > 0 ? Math.round((totalSamples / this.sampleRate) * 1000) : 0;
  }

  flushSamples(): Int16Array {
    const out = concatPcm16Chunks(this.chunks, this.sampleRate);
    this.chunks = [];
    return out;
  }

  flush(): Blob {
    const samples = this.flushSamples();
    return buildWavMono16FromSamples(samples, this.sampleRate);
  }

  clear() {
    this.chunks = [];
  }
}
