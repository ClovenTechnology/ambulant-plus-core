// ============================================================================
// apps/patient-app/src/devices/decoders/wav.ts
// Build WAV from PCM16 chunks (explicit little-endian).
// ============================================================================

export type PcmChunk = { ts: number; sampleRate: number; samples: Int16Array };

function writeU32(view: DataView, off: number, v: number) {
  view.setUint32(off, v, true);
}
function writeU16(view: DataView, off: number, v: number) {
  view.setUint16(off, v, true);
}

/** Concatenate PCM16 and emit 16-bit mono WAV Blob (explicit LE payload). */
export function buildWavMono16(chunks: PcmChunk[], sampleRate: number): Blob {
  const totalSamples = chunks.reduce((n, c) => n + (c?.samples?.length || 0), 0);
  const dataBytes = totalSamples * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);

  // RIFF/WAVE header
  u8.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  writeU32(view, 4, 36 + dataBytes);
  u8.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"

  u8.set([0x66, 0x6d, 0x74, 0x20], 12); // "fmt "
  writeU32(view, 16, 16); // PCM fmt chunk size
  writeU16(view, 20, 1); // format = PCM
  writeU16(view, 22, 1); // channels = 1
  writeU32(view, 24, sampleRate);
  writeU32(view, 28, sampleRate * 2); // byteRate = sr * channels * bytesPerSample
  writeU16(view, 32, 2); // blockAlign
  writeU16(view, 34, 16); // bitsPerSample

  u8.set([0x64, 0x61, 0x74, 0x61], 36); // "data"
  writeU32(view, 40, dataBytes);

  // PCM payload (explicit little-endian)
  let off = 44;
  for (const c of chunks) {
    if (!c?.samples?.length) continue;
    const s = c.samples;
    for (let i = 0; i < s.length; i++) {
      view.setInt16(off, s[i], true);
      off += 2;
    }
  }

  return new Blob([buf], { type: 'audio/wav' });
}

/** Simple in-memory recorder that collects chunks and flushes a WAV. */
export class WavRecorder {
  private chunks: PcmChunk[] = [];
  private readonly sampleRate: number;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  push(c: PcmChunk) {
    if (!c || c.sampleRate !== this.sampleRate) return;
    this.chunks.push(c);
  }

  flush(): Blob {
    const out = buildWavMono16(this.chunks, this.sampleRate);
    this.chunks = [];
    return out;
  }
}
