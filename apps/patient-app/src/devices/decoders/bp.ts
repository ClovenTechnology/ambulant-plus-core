// apps/patient-app/src/devices/decoders/bp.ts

export type BPDecoded = {
  timestamp: string;
  systolic?: number;
  diastolic?: number;
  meanArterial?: number;
  pulse?: number;
  cuffStatus?: string;
  unit: 'mmHg';
  raw: Uint8Array;
};

type DecodableBytes = ArrayBuffer | DataView | Uint8Array;

function toUint8Array(bytes: DecodableBytes): Uint8Array {
  if (bytes instanceof Uint8Array) {
    return bytes;
  }

  if (bytes instanceof DataView) {
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  return new Uint8Array(bytes);
}

function readSfloat(dv: DataView, offset: number): number {
  if (offset + 1 >= dv.byteLength) {
    return Number.NaN;
  }

  const raw16 = dv.getUint16(offset, true);

  let mantissa = raw16 & 0x0fff;
  let exponent = raw16 >> 12;

  // IEEE-11073 SFLOAT uses a signed 12-bit mantissa.
  if (mantissa >= 0x0800) {
    mantissa = mantissa - 0x1000;
  }

  // IEEE-11073 SFLOAT uses a signed 4-bit exponent.
  if (exponent >= 0x0008) {
    exponent = exponent - 0x0010;
  }

  return mantissa * Math.pow(10, exponent);
}

function isPlausibleBp(
  systolic: number,
  diastolic?: number,
  meanArterial?: number
): boolean {
  if (!Number.isFinite(systolic) || systolic < 30 || systolic > 300) {
    return false;
  }

  if (
    typeof diastolic === 'number' &&
    Number.isFinite(diastolic) &&
    (diastolic < 20 || diastolic > 200)
  ) {
    return false;
  }

  if (
    typeof meanArterial === 'number' &&
    Number.isFinite(meanArterial) &&
    (meanArterial < 20 || meanArterial > 250)
  ) {
    return false;
  }

  return true;
}

/**
 * decodeBpPacket
 *
 * Parses Bluetooth SIG Blood Pressure Measurement packets where available.
 * Some devices may expose vendor-specific packets, so the byte fallback remains
 * deliberately conservative and only accepts physiologically plausible values.
 */
export function decodeBpPacket(bytes: DecodableBytes): BPDecoded | null {
  const u8 = toUint8Array(bytes);
  const now = new Date().toISOString();

  if (u8.length < 3) {
    return null;
  }

  try {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

    const flags = dv.getUint8(0);
    const hasPulse = Boolean(flags & 0x04);

    let offset = 1;

    const systolic = readSfloat(dv, offset);
    offset += 2;

    const diastolic = readSfloat(dv, offset);
    offset += 2;

    const meanArterial = readSfloat(dv, offset);
    offset += 2;

    let pulse: number | undefined;

    if (hasPulse && offset + 1 < dv.byteLength) {
      const pulseValue = readSfloat(dv, offset);

      if (Number.isFinite(pulseValue) && pulseValue > 20 && pulseValue < 250) {
        pulse = Math.round(pulseValue);
      }
    }

    if (isPlausibleBp(systolic, diastolic, meanArterial)) {
      return {
        timestamp: now,
        systolic: Math.round(systolic),
        diastolic: Number.isFinite(diastolic) ? Math.round(diastolic) : undefined,
        meanArterial: Number.isFinite(meanArterial)
          ? Math.round(meanArterial)
          : undefined,
        pulse,
        unit: 'mmHg',
        raw: u8,
      };
    }

    // Conservative byte fallback for simple vendor packets such as:
    // [header, systolic, diastolic, pulse]
    if (u8.length >= 4) {
      const systolicByte = u8[1];
      const diastolicByte = u8[2];
      const pulseByte = u8[3];

      if (
        isPlausibleBp(systolicByte, diastolicByte) &&
        pulseByte > 20 &&
        pulseByte < 250
      ) {
        return {
          timestamp: now,
          systolic: systolicByte,
          diastolic: diastolicByte,
          pulse: pulseByte,
          unit: 'mmHg',
          raw: u8,
        };
      }
    }

    return null;
  } catch (err) {
    console.warn('[decodeBpPacket] error', err);
    return null;
  }
}