// apps/api-gateway/src/devices/managers/iomt.ts
import { iomtInventory, getMapperByKey } from '../registry';
import type { IoMTDevice, IoMTInfo, IoMTManager } from '../types';

function toIoMTInfo(device: any): IoMTInfo {
  return {
    id: device.slug || device.key,
    vendor: device.vendor || 'DueCare',
    displayName: device.label || device.model || device.key,
    category: device.modality || device.key,
    model: device.model,
    transport: device.transport,
    capabilities: device.capabilities || [],
  };
}

function toIoMTDevice(device: any): IoMTDevice {
  return {
    info: toIoMTInfo(device),
    connect: async () => undefined,
    disconnect: async () => undefined,
    start: async () => undefined,
    stop: async () => undefined,
    read: async () => null,
  };
}

export const IoMT: IoMTManager = {
  list(): IoMTInfo[] {
    return iomtInventory.map(toIoMTInfo);
  },

  get(id: string): IoMTDevice | undefined {
    const wanted = String(id || '').trim().toLowerCase();

    if (!wanted) return undefined;

    const found = iomtInventory.find((device: any) => {
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

    return found ? toIoMTDevice(found) : undefined;
  },

  find(id: string): IoMTDevice | undefined {
    return this.get?.(id);
  },

  connect(id: string): IoMTDevice | null {
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

export function getIoMTMapper(id: string) {
  return getMapperByKey(id);
}

export default IoMT;