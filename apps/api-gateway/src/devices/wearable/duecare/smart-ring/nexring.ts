// apps/api-gateway/src/devices/wearable/duecare/smart-ring/nexring.ts
import type { WearableDevice, WearableInfo, MetricSample } from '../../../types';
export default class DueCareNexRing implements WearableDevice {
  info: WearableInfo = {
    id: 'duecare.nexring',
    vendor: 'duecare',
    displayName: 'DueCare NexRing',
    category: 'wearable',
    family: 'smart-ring'
  };
  async connect() {}
  async disconnect() {}
  async sync(): Promise<MetricSample[]> { return []; }
}
