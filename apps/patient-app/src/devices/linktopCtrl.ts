// apps/patient-app/src/devices/linktopCtrl.ts

import type { BleConn } from './ble';

function toStrictArrayBuffer(data: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  return buffer;
}

export async function sendCtrl(conn: BleConn, bytes: Uint8Array): Promise<void> {
  const characteristic = conn.chars.get('vendor_ctrl');

  if (!characteristic) {
    throw new Error('vendor_ctrl not found');
  }

  const payload = toStrictArrayBuffer(bytes);

  try {
    if (
      'writeValueWithoutResponse' in characteristic &&
      typeof characteristic.writeValueWithoutResponse === 'function'
    ) {
      await characteristic.writeValueWithoutResponse(payload);
      return;
    }

    if (
      'writeValue' in characteristic &&
      typeof characteristic.writeValue === 'function'
    ) {
      await characteristic.writeValue(payload);
      return;
    }

    throw new Error('vendor_ctrl characteristic is not writable');
  } catch (err) {
    console.error('[sendCtrl] failed', err);
    throw err;
  }
}