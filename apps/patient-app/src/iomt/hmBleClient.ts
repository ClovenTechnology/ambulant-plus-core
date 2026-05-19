// apps/patient-app/src/iomt/hmBleClient.ts
'use client';

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ?? '';

type Uuids = {
  hr?: string; // e.g. 00002a37-...
  ppg?: string; // e.g. vendor PPG if present
  serviceHints?: string[];
};

async function postVital(
  roomId: string,
  type: string,
  value: number,
  unit?: string
): Promise<void> {
  try {
    await fetch(`${GATEWAY}/api/vitals/emit`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        roomId,
        type,
        value,
        unit,
        t: new Date().toISOString(),
      }),
    });
  } catch {
    // Do not interrupt live BLE notification handling if telemetry upload fails.
  }
}

function getBluetooth(): Bluetooth {
  if (typeof navigator === 'undefined' || !navigator.bluetooth) {
    throw new Error(
      'Web Bluetooth is not available in this browser. Use Chrome or Edge over HTTPS or localhost.'
    );
  }

  return navigator.bluetooth;
}

function getCharacteristicValue(event: Event): DataView | null {
  const target = event.target as BluetoothRemoteGATTCharacteristic | null;
  return target?.value ?? null;
}

function getServiceHints(uuids: Uuids): BluetoothServiceUUID[] {
  return (uuids.serviceHints ?? []).filter(Boolean);
}

export class HMBleClient {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private subs: Array<() => void> = [];

  constructor(private uuids: Uuids) {}

  async connect(roomId: string): Promise<void> {
    const bluetooth = getBluetooth();
    const serviceHints = getServiceHints(this.uuids);

    const filters: BluetoothRequestDeviceFilter[] = serviceHints.length
      ? [{ services: serviceHints }]
      : [];

    const optionalServices: BluetoothServiceUUID[] = serviceHints.length
      ? serviceHints
      : ['0000180d-0000-1000-8000-00805f9b34fb'];

    const device = await bluetooth.requestDevice({
      filters: filters.length ? filters : undefined,
      optionalServices,
      acceptAllDevices: filters.length === 0,
    });

    if (!device.gatt) {
      throw new Error('Selected health monitor has no GATT server.');
    }

    this.device = device;
    this.server = await device.gatt.connect();

    // Heart Rate (0x2A37) – first two bytes contain HR.
    if (this.uuids.hr) {
      const svc = await this.server.getPrimaryService(
        '0000180d-0000-1000-8000-00805f9b34fb'
      );
      const chr = await svc.getCharacteristic(this.uuids.hr);

      await chr.startNotifications();

      const onHr = (event: Event): void => {
        const value = getCharacteristicValue(event);

        if (!value || value.byteLength < 2) {
          return;
        }

        // HR Measurement format: flags + HR.
        // If bit 0 is set, HR is uint16 at bytes 1-2; otherwise uint8 at byte 1.
        const flags = value.getUint8(0);
        const isUint16 = Boolean(flags & 0x01);

        const hr =
          isUint16 && value.byteLength >= 3
            ? value.getUint16(1, true)
            : value.getUint8(1);

        if (hr > 0 && hr < 255) {
          void postVital(roomId, 'hr', hr, 'bpm');
        }
      };

      chr.addEventListener('characteristicvaluechanged', onHr);

      this.subs.push(() => {
        chr.removeEventListener('characteristicvaluechanged', onHr);
      });
    }

    // PPG (vendor) – if present, forward averaged amplitude quickly.
    if (this.uuids.ppg) {
      const serviceUuid = serviceHints[0];

      if (!serviceUuid) {
        throw new Error('PPG characteristic configured without a service hint.');
      }

      const svc = await this.server.getPrimaryService(serviceUuid);
      const chr = await svc.getCharacteristic(this.uuids.ppg);

      await chr.startNotifications();

      const onPpg = (event: Event): void => {
        const value = getCharacteristicValue(event);

        if (!value) {
          return;
        }

        let sum = 0;
        let count = 0;

        for (let i = 0; i + 1 < value.byteLength; i += 2) {
          sum += value.getUint16(i, true);
          count += 1;
        }

        if (count > 0) {
          void postVital(roomId, 'ppg', Math.round(sum / count));
        }
      };

      chr.addEventListener('characteristicvaluechanged', onPpg);

      this.subs.push(() => {
        chr.removeEventListener('characteristicvaluechanged', onPpg);
      });
    }
  }

  async disconnect(): Promise<void> {
    for (const unsubscribe of this.subs.splice(0)) {
      try {
        unsubscribe();
      } catch {
        // Ignore listener cleanup failures.
      }
    }

    try {
      if (this.server?.connected) {
        this.server.disconnect();
      }
    } catch {
      // Ignore disconnect failures.
    }

    this.server = null;
    this.device = null;
  }
}