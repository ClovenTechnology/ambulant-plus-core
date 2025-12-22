// apps/patient-app/src/devices/devtools.ts
import type { BleConn } from './ble';

export async function logMuxFor(
  conn: BleConn,
  ms = 10_000,
  charKey: 'vendor_notify' | 'pcm_stream' = 'vendor_notify'
) {
  const ch = conn.chars.get(charKey);
  if (!ch) throw new Error(`${charKey} not found`);
  await ch.startNotifications();

  const started = performance.now();
  const onEvt = (e: Event) => {
    const dv = (e.target as BluetoothRemoteGATTCharacteristic).value!;
    const u8 = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
    const hex = [...u8].map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log(`[${(performance.now() - started).toFixed(0)}ms] (${u8.length}B) ${hex}`);
  };

  ch.addEventListener('characteristicvaluechanged', onEvt as any);
  setTimeout(async () => {
    try { ch.removeEventListener('characteristicvaluechanged', onEvt as any); } catch {}
    try { await ch.stopNotifications(); } catch {}
  }, ms);
}
