// apps/patient-app/src/devices/decoders/ecgDecoder.ts
export type EcgParsed = {
  samples?: Int16Array | Float32Array; // if waveform chunk
  rhr?: number;          // resting HR / computed beat rate
  hrv?: number | null;
  durationSec?: number | null;
  paperSpeed?: number | null;
  timestamp?: string;
  raw: Uint8Array;
  kind: 'waveform' | 'summary';
};

/**
 * ECG waveform packets are often high-throughput. Vendor formats vary:
 * - Some send 16-bit little-endian PCM samples in chunks (header + series)
 * - Others send TLV: [type][length][payload...]
 *
 * Parser here recognizes:
 * - chunk starting with header byte 0xA0/0xF1 (example) as waveform => decode Int16 LE
 * - summary messages (small, low-frequency) containing rhr/hrv text or small fields
 *
 * IMPORTANT: confirm header magic from SDK's ECG classes (I saw ECG bean and online fragments).
 */
export function parseEcgChunk(buf: DataView | Uint8Array): EcgParsed | null {
  let u8: Uint8Array;
  if (buf instanceof DataView) u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  else u8 = buf;

  if (u8.length === 0) return null;

  // Heuristic: waveform chunk length even -> likely 16-bit samples
  if (u8.length >= 4 && (u8.length % 2) === 0) {
    // create Int16Array view (LE)
    const samples = new Int16Array(u8.length / 2);
    for (let i = 0; i + 1 < u8.length; i += 2) {
      samples[i / 2] = (u8[i] | (u8[i + 1] << 8));
    }
    return { kind: 'waveform', samples, raw: u8, timestamp: new Date().toISOString() };
  }

  // Fallback: summary small packet: try parse ascii JSON/text
  try {
    const s = new TextDecoder().decode(u8);
    if (s.trim().startsWith('{') || s.includes('rhr')) {
      try {
        const j = JSON.parse(s);
        return { kind: 'summary', rhr: j.rhr ?? j.hr ?? undefined, hrv: j.hrv ?? null, durationSec: j.duration ?? null, raw: u8, timestamp: new Date().toISOString() };
      } catch {}
    }
  } catch {}

  return null;
}
