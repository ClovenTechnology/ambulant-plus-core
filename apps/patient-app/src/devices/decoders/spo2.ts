// apps/patient-app/src/devices/decoders/spo2.ts
// apps/patient-app/src/devices/decoders/spo2.ts
export type Spo2Decoded = {
  timestamp: string;
  spo2?: number;      // percentage
  pulse?: number;     // bpm
  perfIndex?: number; // optional perfusion index
  unit?: '%' | null;
  raw: Uint8Array;
};

/**
 * decodeSpo2Packet
 * Many vendor PPG frames are either:
 * - periodic waveform chunks (u16 samples) -> these are large and should be handled by PPG pipeline
 * - spot-read notification: compact packet with spo2 and pulse
 *
 * This parser tries to detect spot-read layout:
 * e.g. [0]=hdr [1]=type [2]=spo2 [3]=pulse [4]=pi*10 ... OR vendor-specific.
 */
export function decodeSpo2Packet(bytes: ArrayBuffer | DataView | Uint8Array): Spo2Decoded | null {
  let u8: Uint8Array;
  if (bytes instanceof Uint8Array) u8 = bytes;
  else if (bytes instanceof DataView) u8 = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  else u8 = new Uint8Array(bytes);

  const now = new Date().toISOString();
  const raw = u8;
  if (u8.length === 0) return null;

  // If packet looks like waveform (many bytes, multiple of 2), return null (handled by PPG pipeline)
  if (u8.length > 30 && (u8.length % 2) === 0) return null;

  try {
    // Heuristic spot-read
    // Case A: [x,x, spo2, pulse, pi]
    if (u8.length >= 4) {
      const spo2 = u8[2];
      const pulse = u8[3];
      const perfIndex = u8[4] ? +(u8[4] / 10) : undefined;
      if (spo2 >= 50 && spo2 <= 100 && pulse > 20 && pulse < 220) {
        return { timestamp: now, spo2, pulse, perfIndex, unit: '%', raw };
      }
    }

    // Case B: little-endian 16-bit spo2/pulse combos (rare)
    if (u8.length >= 4) {
      const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      const s1 = dv.getUint16(0, true);
      const s2 = dv.getUint16(2, true);
      // try to derive spo2/pulse from packed words if plausible
      const maybePulse = s1 & 0x03FF;
      const maybeSpo2 = (s2 & 0x00FF);
      if (maybeSpo2 >= 50 && maybeSpo2 <= 100 && maybePulse > 20 && maybePulse < 220) {
        return { timestamp: now, spo2: maybeSpo2, pulse: maybePulse, unit: '%', raw };
      }
    }

    // nothing matched
    return null;
  } catch (e) {
    console.warn('decodeSpo2Packet error', e);
    return null;
  }
}

/*
Replace with vendor parser once decompiled: vendor may pack spo2/pulse perf-index in a fixed structure.
*/
