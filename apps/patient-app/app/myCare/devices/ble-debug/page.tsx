// ===================================================================================
// apps/patient-app/app/myCare/devices/ble-debug/page.tsx
// Minimal dynamic inspector (no hardcoded vendor UUIDs).
// ===================================================================================
'use client';

import { useState } from 'react';

type BluetoothRequestDeviceOptions = {
  acceptAllDevices?: boolean;
  optionalServices?: Array<number | string>;
};

type BluetoothCharacteristicPropertiesLike = {
  read?: boolean;
  write?: boolean;
  notify?: boolean;
};

type BluetoothRemoteGATTCharacteristicLike = {
  uuid: string;
  properties: BluetoothCharacteristicPropertiesLike;
};

type BluetoothRemoteGATTServiceLike = {
  uuid: string;
  getCharacteristics: () => Promise<BluetoothRemoteGATTCharacteristicLike[]>;
};

type BluetoothRemoteGATTServerLike = {
  connect: () => Promise<BluetoothRemoteGATTServerLike>;
  getPrimaryServices: () => Promise<BluetoothRemoteGATTServiceLike[]>;
};

type BluetoothDeviceLike = {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServerLike;
};

type NavigatorWithBluetooth = Navigator & {
  bluetooth?: {
    requestDevice: (
      options: BluetoothRequestDeviceOptions,
    ) => Promise<BluetoothDeviceLike>;
  };
};

export default function Page() {
  const [log, setLog] = useState<string[]>([]);
  const push = (s: string) => setLog((L) => [...L, s]);

  const scan = async () => {
    try {
      const nav = navigator as NavigatorWithBluetooth;

      if (!nav.bluetooth?.requestDevice) {
        push('ERR: Web Bluetooth is not available in this browser or context.');
        return;
      }

      const dev = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          0x180f,
          0x180a,
          '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
          '0000fee0-0000-1000-8000-00805f9b34fb',
        ],
      });

      push(`Connected ${dev.name || dev.id}`);

      if (!dev.gatt) {
        push('ERR: Selected device does not expose a GATT server.');
        return;
      }

      const g = await dev.gatt.connect();
      const svcs = await g.getPrimaryServices();

      push(`Primary services: ${svcs.length}`);

      for (const s of svcs) {
        push(`Service: ${s.uuid}`);

        const chs = await s.getCharacteristics();

        for (const c of chs) {
          push(
            `  Char: ${c.uuid} props=${JSON.stringify({
              read: c.properties.read,
              write: c.properties.write,
              notify: c.properties.notify,
            })}`,
          );
        }
      }
    } catch (e: any) {
      push(`ERR: ${e?.message ?? 'Unknown BLE error'}`);
    }
  };

  return (
    <main data-p-ui="patient-mycare-ble-debug-page" className="min-w-0 overflow-x-clip p-4 text-xs">
      <button className="border rounded px-3 py-1" onClick={scan}>
        Scan
      </button>

      <pre className="mt-3 whitespace-pre-wrap">{log.join('\n')}</pre>
    </main>
  );
}