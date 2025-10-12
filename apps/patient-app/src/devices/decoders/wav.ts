// ============================================================================
// 2) PATH: apps/patient-app/src/devices/decoders/wav.ts  (NEW)
// Why: Build WAV from PCM16 chunks (ts, rate). Tested by Jest below.
// ============================================================================
export type PcmChunk = { ts: number; sampleRate: number; samples: Int16Array };

function writeU32(view: DataView, off: number, v: number) { view.setUint32(off, v, true); }
function writeU16(view: DataView, off: number, v: number) { view.setUint16(off, v, true); }

/** Concatenate PCM16 and emit 16-bit mono WAV Blob. */
export function buildWavMono16(chunks: PcmChunk[], sampleRate: number): Blob {
  const totalSamples = chunks.reduce((n, c) => n + c.samples.length, 0);
  const dataBytes = totalSamples * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);

  // RIFF/WAVE header
  u8.set([0x52,0x49,0x46,0x46], 0);                // "RIFF"
  writeU32(view, 4, 36 + dataBytes);               // chunk size
  u8.set([0x57,0x41,0x56,0x45], 8);                // "WAVE"
  u8.set([0x66,0x6D,0x74,0x20], 12);               // "fmt "
  writeU32(view, 16, 16);                          // PCM fmt chunk size
  writeU16(view, 20, 1);                           // audio format=1 (PCM)
  writeU16(view, 22, 1);                           // channels=1 (mono)
  writeU32(view, 24, sampleRate);                  // sampleRate
  writeU32(view, 28, sampleRate * 2);              // byteRate (16-bit mono)
  writeU16(view, 32, 2);                           // blockAlign
  writeU16(view, 34, 16);                          // bitsPerSample=16
  u8.set([0x64,0x61,0x74,0x61], 36);               // "data"
  writeU32(view, 40, dataBytes);                   // data size

  // PCM payload
  let off = 44;
  for (const c of chunks) {
    const s16 = new Int16Array(buf, off, c.samples.length);
    s16.set(c.samples);
    off += c.samples.length * 2;
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/** Simple in-memory recorder that collects chunks and flushes a WAV. */
export class WavRecorder {
  private chunks: PcmChunk[] = [];
  private readonly sampleRate: number;
  constructor(sampleRate: number) { this.sampleRate = sampleRate; }
  push(c: PcmChunk) {
    if (c.sampleRate !== this.sampleRate) return; // keep mono-rate for WAV
    this.chunks.push(c);
  }
  flush(): Blob {
    const out = buildWavMono16(this.chunks, this.sampleRate);
    this.chunks = [];
    return out;
  }
}
