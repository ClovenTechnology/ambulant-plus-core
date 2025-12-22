// apps/patient-app/src/devices/bleUtils.ts
import type { BleConn } from '@/src/devices/ble'; // adapt import path to your project

/**
 * attachDecoderToConn(conn, charKey, decoder, onParsed)
 * - conn: result of connectBle / similar that has chars map
 * - charKey: key name from serviceMap.characteristics (e.g. 'glucose' or 'spo2_wave')
 * - decoder: (dv: DataView) => parsed|null
 * - onParsed: parsed => void
 *
 * returns: { stop: () => Promise<void> }
 */
export async function attachDecoderToConn<T>(
  conn: BleConn,
  charKey: string,
  decoder: (dv: DataView | Uint8Array) => T | null,
  onParsed: (p: T, raw?: Uint8Array) => void
) {
  const char = conn.chars.get(charKey);
  if (!char) throw new Error(`Characteristic ${charKey} not found on connection`);
  await char.startNotifications();
  const handler = (ev: Event) => {
    try {
      const dv = (ev.target as BluetoothRemoteGATTCharacteristic).value!;
      const u8 = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      const parsed = decoder(dv);
      if (parsed) onParsed(parsed as T, u8);
    } catch (e) {
      console.warn('attachDecoderToConn handler', e);
    }
  };
  char.addEventListener('characteristicvaluechanged', handler as any);
  return {
    stop: async () => {
      try { await char.stopNotifications(); } catch {}
      try { char.removeEventListener('characteristicvaluechanged', handler as any); } catch {}
    }
  };
}
