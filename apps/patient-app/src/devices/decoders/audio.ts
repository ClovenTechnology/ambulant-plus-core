// src/devices/decoders/audio.ts
export function pcm16ToFloat32(buffer: ArrayBuffer) {
  const l = buffer.byteLength / 2;
  const dv = new DataView(buffer);
  const out = new Float32Array(l);
  for (let i = 0; i < l; i++) {
    const int16 = dv.getInt16(i * 2, true); // little-endian
    out[i] = int16 / 0x8000; // normalize
  }
  return out;
}
