import type { WearableDevice, WearableInfo, MetricSample } from '../../../types';
export default class DueCareSmartPillow implements WearableDevice {
info: WearableInfo = { id: 'duecare.smart-pillow', vendor: 'duecare', displayName: 'DueCare Smart Pillow', category: 'wearable', family: 'pillow' };
async connect() {}
async disconnect() {}
async sync(): Promise<MetricSample[]> { return []; }
}