// apps/patient-app/src/devices/decoders/bpDecoder.ts
export type BpParsed = {
  systolic: number;
  diastolic: number;
  pulse?: number;
  unit?: 'mmHg';
  cuffStatus?: string;
  timestamp?: string;
  raw: Uint8Array;
};

/**
 * Typical Blood Pressure (GATT spec 0x2A35) has a standard layout.
 * But vendor spot-notify might pack SBP/DBP/HR as:
 * [0] flags
 * [1..2] systolic (uint16 LE) or float16
 * [3..4] diastolic (uint16 LE)
 * [5] pulse (uint8)
 *
 * This parser handles typical GATT-style and the custom vendor compact form.
 */
export function parseBpChar(buf: DataView | Uint8Array): BpParsed | null {
  let dv: DataView;
  if (buf instanceof DataView) dv = buf;
  else dv = new DataView((buf as Uint8Array).buffer, (buf as Uint8Array).byteOffset, (buf as Uint8Array).byteLength);

  // if length matches GATT BP measurement (flags + 3*float16-ish)
  if (dv.byteLength >= 6) {
    try {
      const flags = dv.getUint8(0);
      // treat systolic as uint16 LE
      const sys = dv.getUint16(1, true);
      const dia = dv.getUint16(3, true);
      let pulse: number | undefined = undefined;
      if (dv.byteLength >= 6) {
        const possiblePulse = dv.getUint8(5);
        if (possiblePulse > 0 && possiblePulse < 255) pulse = possiblePulse;
      }
      // sanity checks
      if (sys < 30 || sys > 300) return null;
      if (dia < 20 || dia > 200) return null;
      return { systolic: sys, diastolic: dia, pulse, unit: 'mmHg', timestamp: new Date().toISOString(), raw: new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength) };
    } catch (e) {
      return null;
    }
  }

  // fallback: if compact three-bytes [sys, dia, pulse]
  if (dv.byteLength >= 3) {
    const sys = dv.getUint8(0);
    const dia = dv.getUint8(1);
    const pulse = dv.getUint8(2);
    if (sys >= 30 && sys <= 300 && dia >= 20 && dia <= 200) {
      return { systolic: sys, diastolic: dia, pulse, unit: 'mmHg', timestamp: new Date().toISOString(), raw: new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength) };
    }
  }

  return null;
}
