// apps/api-gateway/src/devices/managers/wearables.ts
import { wearableInventory, getMapperByKey } from '../registry';
import type {
  WearableDevice,
  WearableInfo,
  WearableManager,
} from '../types';

function toWearableInfo(device: any): WearableInfo {
  return {
    id: device.slug || device.key,
    vendor: device.vendor || 'DueCare',
    displayName: device.label || device.model || device.key,
    category: device.modality || 'ring',
    model: device.model,
    transport: device.transport,
    capabilities: device.capabilities || [],
  };
}

function toWearableDevice(device: any): WearableDevice {
  return {
    info: toWearableInfo(device),
    connect: async () => undefined,
    disconnect: async () => undefined,
    start: async () => undefined,
    stop: async () => undefined,
    read: async () => null,
  };
}

export const Wearables: WearableManager = {
  list(): WearableInfo[] {
    return wearableInventory.map(toWearableInfo);
  },

  get(id: string): WearableDevice | undefined {
    const wanted = String(id || '').trim().toLowerCase();

    if (!wanted) return undefined;

    const found = wearableInventory.find((device: any) => {
      const keys = [
        device.slug,
        device.key,
        device.model,
        device.label,
        ...(Array.isArray(device.aliases) ? device.aliases : []),
      ]
        .filter(Boolean)
        .map((x) => String(x).trim().toLowerCase());

      return keys.includes(wanted);
    });

    return found ? toWearableDevice(found) : undefined;
  },

  find(id: string): WearableDevice | undefined {
    return this.get?.(id);
  },

  connect(id: string): WearableDevice | null {
    const device = this.get?.(id);
    return device || null;
  },

  disconnect(_id: string): void {
    // No-op for server-side registry manager.
  },

  onData(_id: string, _cb: (event: any) => void): void {
    // No-op for server-side registry manager.
  },
};

export function getWearableMapper(id: string) {
  return getMapperByKey(id);
}

export default Wearables;