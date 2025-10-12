import type { WearableDevice, MetricSample, WearableInfo } from '../../types';

export default class TemplateWearable implements WearableDevice {
  info: WearableInfo = {
    id: 'vendor.model', vendor: 'duecare', displayName: 'Template', category: 'wearable', family: 'smart-watch'
  };
  async connect() {}
  async disconnect() {}
  async sync(): Promise<MetricSample[]> {
    // Replace with SDK pull; keep types stable
    return [ { t: Date.now(), type: 'hr', value: 60, unit: 'bpm' } ];
  }
}
