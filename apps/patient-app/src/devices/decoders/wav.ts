// ============================================================================
// apps/patient-app/src/devices/decoders/wav.ts
// Build WAV from PCM16 chunks (explicit little-endian, mono by default).
// ============================================================================

export type PcmChunk = {
  ts: number;
  sampleRate: number;
  samples: Int16Array;
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


export type StethoscopeAudioProfile = {
  /**
   * 0.995 is a gentle DC-removal/high-pass profile suitable for an 8 kHz
   * auscultation stream. It removes baseline drift without destroying
   * low-frequency heart sounds.
   */
  hpAlpha?: number;
  /**
   * Conservative digital gain after DC removal. Keep <= 1 by default to avoid
   * amplifying device noise or clipping before WAV export.
   */
  gain?: number;
  /**
   * Soft limiter threshold expressed as a Float32 absolute amplitude.
   */
  limit?: number;
};

function clampInt16(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value > 32767) return 32767;
  if (value < -32768) return -32768;
  return Math.round(value);
}

/**
 * Clean an auscultation PCM16 stream before waveform display / WAV export.
 *
 * The HC-21/DueCare stethoscope stream is declared as PCM16LE mono at 8 kHz.
 * The most common audible artefacts in the web path are DC offset, packet-level
 * baseline drift, over-gain, and hard clipping. This function keeps the signal
 * in PCM16 form but applies:
 *   1. gentle high-pass/DC removal;
 *   2. conservative gain;
 *   3. tanh soft limiting near full scale.
 *
 * It intentionally does not resample and does not invent missing packets.
 */
export function cleanStethoscopePcm16Samples(
  samples: Int16Array,
  profile: StethoscopeAudioProfile = {},
): Int16Array {
  if (!(samples instanceof Int16Array) || samples.length === 0) {
    return new Int16Array();
  }

  const hpAlpha = Number.isFinite(profile.hpAlpha) ? Number(profile.hpAlpha) : 0.995;
  const gainRaw = Number.isFinite(profile.gain) ? Number(profile.gain) : 0.85;
  const gain = Math.max(0.05, Math.min(1.25, gainRaw));
  const limitRaw = Number.isFinite(profile.limit) ? Number(profile.limit) : 0.92;
  const limit = Math.max(0.5, Math.min(0.99, limitRaw));

  const out = new Int16Array(samples.length);
  let lastIn = 0;
  let lastOut = 0;

  for (let i = 0; i < samples.length; i += 1) {
    const x = samples[i] / 32768;
    const hp = hpAlpha * (lastOut + x - lastIn);
    lastIn = x;
    lastOut = hp;

    let y = hp * gain;

    if (Math.abs(y) > limit) {
      const sign = y < 0 ? -1 : 1;
      const excess = Math.abs(y) - limit;
      y = sign * (limit + (1 - limit) * Math.tanh(excess / Math.max(1e-6, 1 - limit)));
    }

    out[i] = clampInt16(y * 32767);
  }

  return out;
}

export function cleanStethoscopePcmChunk(
  chunk: PcmChunk,
  profile?: StethoscopeAudioProfile,
): PcmChunk {
  return {
    ...chunk,
    samples: cleanStethoscopePcm16Samples(chunk.samples, profile),
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