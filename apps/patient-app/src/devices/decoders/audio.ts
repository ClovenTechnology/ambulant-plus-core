// apps/patient-app/src/devices/decoders/audio.ts

export function pcm16ToFloat32(input: ArrayBuffer | Int16Array) {
  // Fast path if caller already has Int16Array samples
  if (input instanceof Int16Array) {
    const out = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = input[i] / 0x8000;
    return out;
  }

  // Explicit little-endian decode for raw buffers
  const l = Math.floor(input.byteLength / 2);
  const dv = new DataView(input);
  const out = new Float32Array(l);
  for (let i = 0; i < l; i++) {
    const int16 = dv.getInt16(i * 2, true); // little-endian
    out[i] = int16 / 0x8000;
  }
  return out;
}
