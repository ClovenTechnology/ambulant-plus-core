// apps/patient-app/src/devices/linktopCtrl.ts
import type { BleConn } from './ble';

export async function sendCtrl(conn: BleConn, bytes: Uint8Array) {
  const ch = conn.chars.get('vendor_ctrl');
  if (!ch) throw new Error('vendor_ctrl not found');
  try {
    // prefer writeWithoutResponse if available
    // @ts-ignore
    if (ch.writeValueWithoutResponse) await ch.writeValueWithoutResponse(bytes);
    else await ch.writeValue(bytes);
  } catch (e) {
    console.error('sendCtrl failed', e);
    throw e;
  }
}
