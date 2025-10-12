// Thin Web Bluetooth helper used by the console.
// - Requests device using serviceMap filters
// - Subscribes to notify characteristics
// - Provides write() for start/stop commands

import { DEVICE_MAP, DeviceKey } from './serviceMap';

export type BleConn = {
  device: BluetoothDevice;
  server: BluetoothRemoteGATTServer;
  services: Map<string, BluetoothRemoteGATTService>;
  chars: Map<string, BluetoothRemoteGATTCharacteristic>;
  stopAll: () => Promise<void>;
  write: (charKey: string, data: Uint8Array) => Promise<void>;
};

export async function connectBle(key: DeviceKey): Promise<BleConn> {
  const spec = DEVICE_MAP[key];
  if (spec.transport !== 'ble') throw new Error('Not a BLE device');

  const filters: any[] = [];
  if (spec.filters?.namePrefix?.length) {
    for (const p of spec.filters.namePrefix) filters.push({ namePrefix: p });
  }
  // Web Bluetooth needs optionalServices for post-connection access
  const optionalServices = spec.filters?.services ?? [];

  const device = await navigator.bluetooth.requestDevice({
    filters: filters.length ? filters : undefined,
    optionalServices,
    acceptAllDevices: filters.length === 0,
  });

  const server = await device.gatt!.connect();
  const services = new Map<string, BluetoothRemoteGATTService>();
  for (const sid of optionalServices) {
    try { services.set(sid, await server.getPrimaryService(sid)); } catch {}
  }

  const chars = new Map<string, BluetoothRemoteGATTCharacteristic>();
  if (spec.characteristics) {
    for (const [k, c] of Object.entries(spec.characteristics)) {
      // characteristic UUID may belong to any of the services we requested
      let found: BluetoothRemoteGATTCharacteristic | null = null;
      for (const svc of services.values()) {
        try {
          const ch = await svc.getCharacteristic(c.uuid);
          if (ch) { found = ch; break; }
        } catch {}
      }
      if (found) chars.set(k, found);
    }
  }

  const stopAll = async () => {
    try { device.gatt?.disconnect(); } catch {}
  };

  const write = async (charKey: string, data: Uint8Array) => {
    const ch = chars.get(charKey);
    if (!ch) throw new Error(`Char not found: ${charKey}`);
    await ch.writeValueWithoutResponse(data);
  };

  return { device, server, services, chars, stopAll, write };
}

export async function subscribe(
  conn: BleConn,
  charKey: string,
  onValue: (data: DataView) => void
) {
  const ch = conn.chars.get(charKey);
  if (!ch) throw new Error(`Char not found: ${charKey}`);
  await ch.startNotifications();
  const handler = (e: Event) => {
    const dv = (e.target as BluetoothRemoteGATTCharacteristic).value!;
    onValue(dv);
  };
  ch.addEventListener('characteristicvaluechanged', handler as any);
  return () => ch.removeEventListener('characteristicvaluechanged', handler as any);
}
