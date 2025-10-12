// ===================================================================================
// apps/patient-app/src/devices/decoders/nexringPPG.ts
// PPG Uint16 stream (FEE0/FEE2). Sends frames to InsightCore.
// ===================================================================================
import { API } from '@/src/lib/config';

const FEE0 = '0000fee0-0000-1000-8000-00805f9b34fb';
const FEE2 = '0000fee2-0000-1000-8000-00805f9b34fb';

export type PpgFrame = {
  ts: number;
  cadenceHz: number;     // ~50
  samples: Uint16Array;  // raw PPG ADC units
};

export async function connectNexRingPPG(onFrame: (f: PpgFrame) => void, roomId?: string) {
  const dev = await navigator.bluetooth.requestDevice({
    filters: [{ services: [FEE0] }, { namePrefix: 'NexRing' }],
    optionalServices: [FEE0, 0x180D, 0x180A],
  });
  const server = await dev.gatt!.connect();
  const svc = await server.getPrimaryService(FEE0);
  const ppg = await svc.getCharacteristic(FEE2);
  await ppg.startNotifications();

  const handler = async (ev: Event) => {
    const dv = (ev.target as BluetoothRemoteGATTCharacteristic).value!;
    const u8 = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
    const len = u8.length & ~1;
    const u16 = new Uint16Array(len / 2);
    for (let i = 0; i < len; i += 2) u16[i >> 1] = u8[i] | (u8[i + 1] << 8);

    const frame = { ts: Date.now(), cadenceHz: 50, samples: u16 };
    onFrame(frame);

    if (roomId) {
      const b64 = btoa(String.fromCharCode(...new Uint8Array(u16.buffer)));
      fetch(`${API}/api/insight/frame`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'ppg_u16', cadenceHz: 50, ts: frame.ts, roomId, payloadB64: b64 }),
      }).catch(() => {});
    }
  };

  ppg.addEventListener('characteristicvaluechanged', handler);

  return {
    device: dev,
    disconnect: async () => {
      try { await ppg.stopNotifications(); } catch {}
      ppg.removeEventListener('characteristicvaluechanged', handler);
      try { server.disconnect(); } catch {}
    },
  };
}
