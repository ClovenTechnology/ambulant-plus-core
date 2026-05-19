import { DEVICE_MAP } from '@/src/devices/serviceMap';

type StartOpts = {
  roomId: string;
};

let aborter: AbortController | null = null;
let activeCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
let activeDevice: BluetoothDevice | null = null;

function getBluetooth(): Bluetooth {
  if (typeof navigator === 'undefined' || !navigator.bluetooth) {
    throw new Error(
      'Web Bluetooth is not available in this browser. Use Chrome or Edge over HTTPS or localhost.'
    );
  }

  return navigator.bluetooth;
}

function getPrimaryServiceUuid(): BluetoothServiceUUID {
  const spec = DEVICE_MAP['duecare.health-monitor'];
  const services = spec.filters?.services ?? [];

  if (!services.length) {
    throw new Error('Health monitor BLE service UUID is not configured.');
  }

  return services[0];
}

function getSpo2WaveCharacteristicUuid(): BluetoothCharacteristicUUID {
  const spec = DEVICE_MAP['duecare.health-monitor'];
  const uuid = spec.characteristics?.spo2_wave?.uuid;

  if (!uuid) {
    throw new Error('Health monitor SpO2 wave characteristic UUID is not configured.');
  }

  return uuid;
}

function dataViewFromEvent(event: Event): DataView | null {
  const target = event.target as BluetoothRemoteGATTCharacteristic | null;
  return target?.value ?? null;
}

export async function startHM({ roomId }: StartOpts): Promise<void> {
  const spec = DEVICE_MAP['duecare.health-monitor'];
  const bluetooth = getBluetooth();

  const serviceUuid = getPrimaryServiceUuid();
  const ppgUuid = getSpo2WaveCharacteristicUuid();

  const optionalServices = spec.filters?.services ?? [serviceUuid];

  const device = await bluetooth.requestDevice({
    filters: [{ services: optionalServices }],
    optionalServices,
  });

  if (!device.gatt) {
    throw new Error('Selected health monitor has no GATT server.');
  }

  activeDevice = device;

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(serviceUuid);
  const characteristic = await service.getCharacteristic(ppgUuid);

  aborter?.abort();
  aborter = new AbortController();
  activeCharacteristic = characteristic;

  await characteristic.startNotifications();

  characteristic.addEventListener(
    'characteristicvaluechanged',
    (event: Event) => {
      const dv = dataViewFromEvent(event);

      if (!dv) {
        return;
      }

      const sampleCount = Math.floor(dv.byteLength / 2);

      for (let i = 0; i < sampleCount; i += 1) {
        const raw = dv.getInt16(i * 2, true);
        const value = Math.max(0, raw);

        fetch('/api/iomt/push', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            roomId,
            type: 'PPG',
            value,
            unit: 'a.u.',
          }),
          keepalive: true,
        }).catch(() => {
          // Do not interrupt live BLE notifications if telemetry upload fails.
        });
      }
    },
    { signal: aborter.signal }
  );
}

export async function stopHM(): Promise<void> {
  aborter?.abort();
  aborter = null;

  try {
    await activeCharacteristic?.stopNotifications();
  } catch {
    // Ignore notification shutdown failures.
  }

  try {
    activeDevice?.gatt?.disconnect();
  } catch {
    // Ignore disconnect failures.
  }

  activeCharacteristic = null;
  activeDevice = null;
}