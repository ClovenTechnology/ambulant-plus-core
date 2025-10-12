// apps/patient-app/src/iomt/hmBleClient.ts
'use client';

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ?? '';

type Uuids = {
  hr?: string;          // e.g. 00002a37-...
  ppg?: string;         // e.g. vendor PPG if present
  serviceHints?: string[];
};

async function postVital(roomId: string, type: string, value: number, unit?: string) {
  try {
    await fetch(`${GATEWAY}/api/vitals/emit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roomId, type, value, unit, t: new Date().toISOString() })
    });
  } catch {}
}

export class HMBleClient {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private subs: Array<() => void> = [];

  constructor(private uuids: Uuids) {}

  async connect(roomId: string) {
    const filters: BluetoothLEScanFilter[] = [];
    if (this.uuids.serviceHints?.length) filters.push({ services: this.uuids.serviceHints as any });
    const device = await navigator.bluetooth.requestDevice({
      filters: filters.length ? filters : undefined,
      optionalServices: this.uuids.serviceHints?.length ? this.uuids.serviceHints : ['0000180d-0000-1000-8000-00805f9b34fb'],
      acceptAllDevices: !filters.length,
    });
    this.device = device;
    this.server = await device.gatt!.connect();

    // Heart Rate (0x2A37) – first two bytes contain HR (8/16-bit). We’ll decode simply.
    if (this.uuids.hr) {
      const svc = await this.server.getPrimaryService('0000180d-0000-1000-8000-00805f9b34fb');
      const chr = await svc.getCharacteristic(this.uuids.hr);
      await chr.startNotifications();
      const onHr = (e: Event) => {
        const v = (e.target as BluetoothRemoteGATTCharacteristic).value!;
        // HR Measurement format: flags + HR (uint8 or uint16). We parse the 2nd byte as uint8 for typical devices.
        const hr = v.getUint8(1);
        if (hr > 0 && hr < 255) postVital(roomId, 'hr', hr, 'bpm');
      };
      chr.addEventListener('characteristicvaluechanged', onHr);
      this.subs.push(() => chr.removeEventListener('characteristicvaluechanged', onHr));
    }

    // PPG (vendor) – if present, forward averaged amplitude quickly
    if (this.uuids.ppg) {
      const svc = await this.server.getPrimaryService(this.uuids.serviceHints![0]);
      const chr = await svc.getCharacteristic(this.uuids.ppg);
      await chr.startNotifications();
      const onPpg = (e: Event) => {
        const dv = (e.target as BluetoothRemoteGATTCharacteristic).value!;
        // Treat as little-endian uint16 samples
        let sum = 0, n = 0;
        for (let i = 0; i + 1 < dv.byteLength; i += 2) { sum += dv.getUint16(i, true); n++; }
        if (n) postVital(roomId, 'ppg', Math.round(sum / n));
      };
      chr.addEventListener('characteristicvaluechanged', onPpg);
      this.subs.push(() => chr.removeEventListener('characteristicvaluechanged', onPpg));
    }
  }

  async disconnect() {
    for (const f of this.subs.splice(0)) try { f(); } catch {}
    if (this.server?.connected) this.server.disconnect();
    this.server = null;
    this.device = null;
  }
}
