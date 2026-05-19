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