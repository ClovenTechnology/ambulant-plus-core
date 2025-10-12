import type { WearableDevice, WearableInfo, MetricSample } from '../../../types';
export default class DueCareNexBand implements WearableDevice {
info: WearableInfo = { id: 'duecare.nexband', vendor: 'duecare', displayName: 'DueCare NexBand', category: 'wearable', family: 'band' };
async connect() {}
async disconnect() {}
async sync(): Promise<MetricSample[]> { return []; }
}