// apps/patient-app/src/devices/decoders/bp.ts
export type BPDecoded = {
  timestamp: string;
  systolic?: number;
  diastolic?: number;
  meanArterial?: number;
  pulse?: number;
  cuffStatus?: string; // e.g. 'inflating'|'done' etc
  unit: 'mmHg';
  raw: Uint8Array;
};

/**
 * decodeBpPacket
 * - Generic parse for BP notify char: many devices follow Bluetooth SIG Blood Pressure spec
 * - If vendor uses custom layout, replace the VENDOR PARSE HOOK with exact code.
 */
export function decodeBpPacket(bytes: ArrayBuffer | DataView | Uint8Array): BPDecoded | null {
  let u8: Uint8Array;
  if (bytes instanceof Uint8Array) u8 = bytes;
  else if (bytes instanceof DataView) u8 = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  else u8 = new Uint8Array(bytes);

  const now = new Date().toISOString();
  const raw = u8;
  if (u8.length < 3) return null;

  try {
    // Standard Bluetooth Blood Pressure Measurement (0x2A35) uses IEEE-11073 float (sfloat)
    // Many vendors send [flags, systolic(sfloat), diastolic(sfloat), mean(sfloat), [pulseRate optional], ...]
    // Helper to read sfloat (16-bit IEEE-11073 SFLOAT)
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const flags = dv.getUint8(0);
    const hasPulse = !!(flags & 0x04);
    // read sfloat at offset 1.. (if buffer long enough)
    const readSfloat = (off: number) => {
      if (off + 1 >= dv.byteLength) return NaN;
      const raw16 = dv.getUint16(off, true);
      const mantissa = raw16 & 0x0FFF;
      let exp = raw16 >> 12;
      if (mantissa >= 0x0800) { // negative mantissa
        // sign extend 12-bit
        mantissa = -(0x1000 - mantissa);
      }
      if (exp >= 0x0008) exp = -(0x0010 - exp); // 4-bit signed
      return mantissa * Math.pow(10, exp);
    };

    // try parsing as BLE spec
    let off = 1;
    const systolic = readSfloat(off); off += 2;
    const diastolic = readSfloat(off); off += 2;
    const mean = readSfloat(off); off += 2;
    let pulse: number | undefined = undefined;
    if (hasPulse && off + 1 <= dv.byteLength) { pulse = dv.getUint16(off, true); }

    // plausibility check
    if (!isNaN(systolic) && systolic > 30 && systolic < 300) {
      return { timestamp: now, systolic: Math.round(systolic), diastolic: Math.round(diastolic), meanArterial: Math.round(mean), pulse: pulse ? Math.round(pulse) : undefined, unit: 'mmHg', raw };
    }

    // VENDOR PARSE FALLBACK:
    // Some devices send simple [hdr, sys, dia, pulse] as bytes
    if (u8.length >= 4) {
      const sys = u8[1];
      const dia = u8[2];
      const pl = u8[3];
      if (sys > 30 && sys < 300 && dia > 20 && dia < 200) {
        return { timestamp: now, systolic: sys, diastolic: dia, pulse: pl, unit: 'mmHg', raw };
      }
    }

    return null;
  } catch (e) {
    console.warn('decodeBpPacket error', e);
    return null;
  }
}


/*
Replace with exact decode logic from the SDK Protocol; BP is critical — please replace with vendor parse for production.
*/
