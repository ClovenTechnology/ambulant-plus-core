// apps/patient-app/src/devices/attachDecoder.ts
import type { BleConn } from '@/src/devices/ble';

// onParsed callback receives decoded object and characteristic key
export function attachDecoderToConn(
  conn: BleConn,
  charKey: string,
  decoder: (bytes: ArrayBuffer | DataView | Uint8Array) => any | null,
  onParsed: (parsed: any, meta?: { charKey: string }) => void
) {
  const ch = conn.chars.get(charKey);
  if (!ch) throw new Error(`Characteristic ${charKey} not found on connection`);
  const handler = (e: Event) => {
    const dv = (e.target as BluetoothRemoteGATTCharacteristic).value!;
    try {
      const parsed = decoder(dv);
      if (parsed) onParsed(parsed, { charKey });
    } catch (err) {
      console.warn('decoder error', err);
    }
  };
  ch.addEventListener('characteristicvaluechanged', handler as any);
  const start = async () => {
    await ch.startNotifications();
  };
  const stop = async () => {
    try { await ch.stopNotifications(); } catch {}
    ch.removeEventListener('characteristicvaluechanged', handler as any);
  };
  return { start, stop };
}
