// apps/api-gateway/src/devices/registry.ts
// Production device registry.
// Supported device scope only:
// 1. Health Monitor
// 2. Digital Stethoscope
// 3. HD Otoscope
// 4. NexRing

export type DeviceTransport = 'ble' | 'mqtt' | 'http' | 'manual';

export type DeviceModality =
  | 'monitor'
  | 'stethoscope'
  | 'otoscope'
  | 'ring';

export type SupportedDeviceInfo = {
  slug: string;
  key: string;
  label: string;
  vendor: string;
  model: string;
  modality: DeviceModality;
  transport: DeviceTransport;
  aliases: string[];
};

export type DeviceMapper = {
  key: string;
  device: SupportedDeviceInfo;
  normalizePayload: (payload: any) => any;
  map: (payload: any) => any;
  parse: (payload: any) => any;
};

function normalizePayload(device: SupportedDeviceInfo, payload: any) {
  const now = new Date().toISOString();

  return {
    deviceKey: device.key,
    deviceSlug: device.slug,
    deviceLabel: device.label,
    vendor: device.vendor,
    model: device.model,
    modality: device.modality,
    transport: device.transport,
    receivedAt: now,
    payload: payload ?? {},
  };
}

function makeMapper(device: SupportedDeviceInfo): DeviceMapper {
  const mapper = {
    key: device.key,
    device,
    normalizePayload: (payload: any) => normalizePayload(device, payload),
    map: (payload: any) => normalizePayload(device, payload),
    parse: (payload: any) => normalizePayload(device, payload),
  };

  return mapper;
}

export const supportedDevices: SupportedDeviceInfo[] = [
  {
    slug: 'duecare.health-monitor',
    key: 'health-monitor',
    label: 'Health Monitor',
    vendor: 'DueCare',
    model: 'DueMonitor',
    modality: 'monitor',
    transport: 'ble',
    aliases: [
      'health-monitor',
      'health_monitor',
      'duecare.health-monitor',
      'duecare.vitals-360',
      'DueMonitor',
      'HM_DEVICE_ID',
    ],
  },
  {
    slug: 'duecare.stethoscope',
    key: 'digital-stethoscope',
    label: 'Digital Stethoscope',
    vendor: 'DueCare',
    model: 'DueScope',
    modality: 'stethoscope',
    transport: 'ble',
    aliases: [
      'digital-stethoscope',
      'digital_stethoscope',
      'stethoscope',
      'duecare.stethoscope',
      'DueScope',
      'STETH_DEVICE_ID',
    ],
  },
  {
    slug: 'duecare.otoscope',
    key: 'hd-otoscope',
    label: 'HD Otoscope',
    vendor: 'DueCare',
    model: 'DueOto',
    modality: 'otoscope',
    transport: 'ble',
    aliases: [
      'hd-otoscope',
      'hd_otoscope',
      'otoscope',
      'duecare.otoscope',
      'DueOto',
      'OTO_DEVICE_ID',
    ],
  },
  {
    slug: 'duecare.nexring',
    key: 'nexring',
    label: 'NexRing',
    vendor: 'DueCare',
    model: 'NexRing',
    modality: 'ring',
    transport: 'ble',
    aliases: [
      'nexring',
      'nex-ring',
      'duecare.nexring',
      'DueRing',
      'NexRing',
      'RING_DEVICE_ID',
    ],
  },
];

export const wearableInventory = supportedDevices.filter((device) => device.modality === 'ring');
export const iomtInventory = supportedDevices.filter((device) => device.modality !== 'ring');

const mappers = supportedDevices.map(makeMapper);

function normalizeKey(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

export function getMapperByKey(key: string | null | undefined): DeviceMapper | null {
  const wanted = normalizeKey(key);
  if (!wanted) return null;

  return (
    mappers.find((mapper) => {
      const device = mapper.device;
      return (
        normalizeKey(device.key) === wanted ||
        normalizeKey(device.slug) === wanted ||
        normalizeKey(device.model) === wanted ||
        device.aliases.some((alias) => normalizeKey(alias) === wanted)
      );
    }) ?? null
  );
}

export function getMapperFromLegacyVendor(vendor: string | null | undefined, model?: string | null): DeviceMapper | null {
  const vendorKey = normalizeKey(vendor);
  const modelKey = normalizeKey(model);

  if (modelKey) {
    const byModel = getMapperByKey(modelKey);
    if (byModel) return byModel;
  }

  if (!vendorKey) return null;

  if (vendorKey.includes('health') || vendorKey.includes('monitor') || vendorKey.includes('vitals')) {
    return getMapperByKey('health-monitor');
  }

  if (vendorKey.includes('steth')) {
    return getMapperByKey('digital-stethoscope');
  }

  if (vendorKey.includes('oto')) {
    return getMapperByKey('hd-otoscope');
  }

  if (vendorKey.includes('ring') || vendorKey.includes('nex')) {
    return getMapperByKey('nexring');
  }

  return null;
}

export function listSupportedDevices() {
  return supportedDevices;
}