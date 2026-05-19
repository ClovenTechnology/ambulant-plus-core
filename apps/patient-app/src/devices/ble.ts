// apps/patient-app/src/devices/ble.ts
// Web Bluetooth helper with aggressive service/characteristic discovery
// and fallback aliasing for DueCare / Linktop monitor variants.

import { DEVICE_MAP, DeviceKey } from './serviceMap';

export type BleConn = {
  device: BluetoothDevice;
  server: BluetoothRemoteGATTServer;
  services: Map<string, BluetoothRemoteGATTService>;
  chars: Map<string, BluetoothRemoteGATTCharacteristic>;
  stopAll: () => Promise<void>;
  write: (charKey: string, data: Uint8Array) => Promise<void>;
};

const norm = (uuid: string): string => String(uuid || '').toLowerCase();

function toStrictArrayBuffer(data: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  return buffer;
}

function charSupportsWrite(ch: BluetoothRemoteGATTCharacteristic): boolean {
  const p = ch.properties;
  return Boolean(p.write || p.writeWithoutResponse);
}

function charSupportsNotify(ch: BluetoothRemoteGATTCharacteristic): boolean {
  const p = ch.properties;
  return Boolean(p.notify || p.indicate);
}

function addIfMissing(
  map: Map<string, BluetoothRemoteGATTCharacteristic>,
  key: string,
  ch?: BluetoothRemoteGATTCharacteristic | null
): void {
  if (!ch) return;
  if (!map.has(key)) map.set(key, ch);
}

async function getAllPrimaryServices(
  server: BluetoothRemoteGATTServer,
  preferredServiceIds: string[]
): Promise<Map<string, BluetoothRemoteGATTService>> {
  const services = new Map<string, BluetoothRemoteGATTService>();

  try {
    const all = await server.getPrimaryServices();

    for (const svc of all) {
      services.set(norm(svc.uuid), svc);
    }
  } catch {
    // Browser/device may not allow unrestricted service discovery.
    // Fallback below attempts the preferred service list one by one.
  }

  for (const sid of preferredServiceIds) {
    const id = norm(sid);

    if (services.has(id)) continue;

    try {
      const svc = await server.getPrimaryService(id);
      services.set(id, svc);
    } catch {
      // Service not exposed by this device/session.
    }
  }

  return services;
}

async function getAllCharacteristics(
  services: Map<string, BluetoothRemoteGATTService>
): Promise<Map<string, BluetoothRemoteGATTCharacteristic>> {
  const chars = new Map<string, BluetoothRemoteGATTCharacteristic>();

  for (const svc of services.values()) {
    try {
      const list = await svc.getCharacteristics();

      for (const ch of list) {
        chars.set(`uuid:${norm(ch.uuid)}`, ch);
      }
    } catch {
      // Some services may reject full characteristic enumeration.
    }
  }

  return chars;
}

function aliasSpecCharacteristics(
  chars: Map<string, BluetoothRemoteGATTCharacteristic>,
  specChars?: Record<string, { uuid: string }>
): void {
  if (!specChars) return;

  for (const [key, c] of Object.entries(specChars)) {
    const found = chars.get(`uuid:${norm(c.uuid)}`);
    if (found) chars.set(key, found);
  }
}

function aliasHealthMonitorFallbacks(
  chars: Map<string, BluetoothRemoteGATTCharacteristic>
): void {
  const all = Array.from(chars.entries())
    .filter(([key]) => key.startsWith('uuid:'))
    .map(([, ch]) => ch);

  const byUuid = (uuid: string): BluetoothRemoteGATTCharacteristic | undefined =>
    chars.get(`uuid:${norm(uuid)}`);

  const fff1 = byUuid('0000fff1-0000-1000-8000-00805f9b34fb');
  const fff4 = byUuid('0000fff4-0000-1000-8000-00805f9b34fb');
  const fff5 = byUuid('0000fff5-0000-1000-8000-00805f9b34fb');
  const ffe1 = byUuid('0000ffe1-0000-1000-8000-00805f9b34fb');
  const ffd1 = byUuid('0000ffd1-0000-1000-8000-00805f9b34fb');

  addIfMissing(chars, 'vendor_ctrl', fff1 && charSupportsWrite(fff1) ? fff1 : null);
  addIfMissing(chars, 'vendor_notify', fff4 && charSupportsNotify(fff4) ? fff4 : null);
  addIfMissing(chars, 'therm_confirm', fff5 && charSupportsNotify(fff5) ? fff5 : null);
  addIfMissing(chars, 'temp', ffe1 && charSupportsNotify(ffe1) ? ffe1 : null);
  addIfMissing(chars, 'glucose', ffd1 && charSupportsNotify(ffd1) ? ffd1 : null);

  if (!chars.has('vendor_ctrl')) {
    const firstWritable =
      all.find((ch) => {
        const uuid = norm(ch.uuid);

        return (
          charSupportsWrite(ch) &&
          (uuid.includes('fff1') ||
            uuid.includes('fff2') ||
            uuid.includes('ff12') ||
            uuid.includes('ffb2'))
        );
      }) || all.find((ch) => charSupportsWrite(ch));

    addIfMissing(chars, 'vendor_ctrl', firstWritable ?? null);
  }

  if (!chars.has('vendor_notify')) {
    const firstNotify = all.find((ch) => charSupportsNotify(ch));
    addIfMissing(chars, 'vendor_notify', firstNotify ?? null);
  }

  if (!chars.has('temp')) {
    const tempCandidate = all.find((ch) => {
      const uuid = norm(ch.uuid);
      return (uuid.includes('ffe1') || uuid.includes('fff5')) && charSupportsNotify(ch);
    });

    addIfMissing(chars, 'temp', tempCandidate ?? null);
  }

  if (!chars.has('glucose')) {
    const glucoseCandidate = all.find((ch) => {
      const uuid = norm(ch.uuid);
      return (uuid.includes('ffd1') || uuid.includes('ffe1')) && charSupportsNotify(ch);
    });

    addIfMissing(chars, 'glucose', glucoseCandidate ?? null);
  }

  const battery = byUuid('00002a19-0000-1000-8000-00805f9b34fb');
  const firmware = byUuid('00002a26-0000-1000-8000-00805f9b34fb');
  const hardware = byUuid('00002a27-0000-1000-8000-00805f9b34fb');
  const software = byUuid('00002a28-0000-1000-8000-00805f9b34fb');

  addIfMissing(chars, 'batt', battery ?? null);
  addIfMissing(chars, 'firmware_rev', firmware ?? null);
  addIfMissing(chars, 'hardware_rev', hardware ?? null);
  addIfMissing(chars, 'software_rev', software ?? null);
}

function getBluetooth(): Bluetooth | null {
  if (typeof navigator === 'undefined') return null;
  return navigator.bluetooth ?? null;
}

function formatAvailableCharKeys(
  chars: Map<string, BluetoothRemoteGATTCharacteristic>
): string {
  return (
    Array.from(chars.keys())
      .filter((key) => !key.startsWith('uuid:'))
      .join(', ') || 'none'
  );
}

export async function connectBle(key: DeviceKey): Promise<BleConn> {
  const spec = DEVICE_MAP[key];

  if (!spec || spec.transport !== 'ble') {
    throw new Error('Not a BLE device');
  }

  const filters: BluetoothRequestDeviceFilter[] = [];

  if (spec.filters?.namePrefix?.length) {
    for (const prefix of spec.filters.namePrefix) {
      filters.push({ namePrefix: prefix });
    }
  }

  const optionalServices = Array.from(
    new Set(
      [
        ...(spec.filters?.services ?? []),
        '0000ff27-0000-1000-8000-00805f9b34fb',
        '0000180a-0000-1000-8000-00805f9b34fb',
        '0000180f-0000-1000-8000-00805f9b34fb',
        '0000fff0-0000-1000-8000-00805f9b34fb',
        '0000ffe0-0000-1000-8000-00805f9b34fb',
        '0000ffd0-0000-1000-8000-00805f9b34fb',
        '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
      ].map(norm)
    )
  );

  const bluetooth = getBluetooth();

  if (!bluetooth?.requestDevice) {
    throw new Error(
      'Bluetooth is not available in this browser. Use Chrome or Edge on desktop/Android over HTTPS, or connect through the supported native bridge.'
    );
  }

  const device = await bluetooth.requestDevice({
    filters: filters.length ? filters : undefined,
    optionalServices,
    acceptAllDevices: filters.length === 0,
  });

  if (!device.gatt) {
    throw new Error('Selected device has no GATT server');
  }

  const server = await device.gatt.connect();
  const services = await getAllPrimaryServices(server, optionalServices);
  const chars = await getAllCharacteristics(services);

  aliasSpecCharacteristics(chars, spec.characteristics);

  if (key === 'duecare.health-monitor') {
    aliasHealthMonitorFallbacks(chars);
  }

  const stopAll = async (): Promise<void> => {
    try {
      for (const ch of chars.values()) {
        try {
          await ch.stopNotifications();
        } catch {
          // Characteristic may not support/need notification shutdown.
        }
      }
    } catch {
      // Continue to disconnect even if iteration fails.
    }

    try {
      device.gatt?.disconnect();
    } catch {
      // Ignore disconnect failures.
    }
  };

  const write = async (charKey: string, data: Uint8Array): Promise<void> => {
    const ch =
      chars.get(charKey) ||
      chars.get(`uuid:${norm(charKey)}`) ||
      (charKey === 'vendor_ctrl' ? chars.get('vendor_ctrl') : null);

    if (!ch) {
      throw new Error(
        `Char not found: ${charKey}. Available chars: ${formatAvailableCharKeys(chars)}`
      );
    }

    console.info('[ble.write]', {
      charKey,
      uuid: ch.uuid,
      write: ch.properties.write,
      writeWithoutResponse: ch.properties.writeWithoutResponse,
      bytes: Array.from(data),
    });

    const payload = toStrictArrayBuffer(data);

    if (
      'writeValueWithoutResponse' in ch &&
      typeof ch.writeValueWithoutResponse === 'function'
    ) {
      await ch.writeValueWithoutResponse(payload);
      return;
    }

    if ('writeValue' in ch && typeof ch.writeValue === 'function') {
      await ch.writeValue(payload);
      return;
    }

    throw new Error(`Characteristic is not writable: ${charKey}`);
  };

  return {
    device,
    server,
    services,
    chars,
    stopAll,
    write,
  };
}

/**
 * subscribe(conn, charKey, onValue)
 * - direct characteristic if present
 * - otherwise fallback to vendor_notify for demux
 */
export async function subscribe(
  conn: BleConn,
  charKey: string,
  onValue: (data: DataView) => void
): Promise<() => void> {
  const direct = conn.chars.get(charKey);

  if (direct) {
    await direct.startNotifications();

    const handler: EventListener = (event) => {
      const value = (event.target as BluetoothRemoteGATTCharacteristic | null)?.value;

      if (value) {
        onValue(value);
      }
    };

    direct.addEventListener('characteristicvaluechanged', handler);

    return () => {
      try {
        direct.removeEventListener('characteristicvaluechanged', handler);
      } catch {
        // Ignore cleanup failures.
      }
    };
  }

  const mux = conn.chars.get('vendor_notify');

  if (!mux) {
    throw new Error(
      `Char not found: ${charKey}. Available chars: ${formatAvailableCharKeys(conn.chars)}`
    );
  }

  await mux.startNotifications();

  const handler: EventListener = (event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic | null)?.value;

    if (value) {
      onValue(value);
    }
  };

  mux.addEventListener('characteristicvaluechanged', handler);

  return () => {
    try {
      mux.removeEventListener('characteristicvaluechanged', handler);
    } catch {
      // Ignore cleanup failures.
    }
  };
}