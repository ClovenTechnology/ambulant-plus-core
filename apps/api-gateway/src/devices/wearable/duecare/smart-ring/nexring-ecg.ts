import type { WearableDevice, WearableInfo, MetricSample } from '../../../types';
export default class DueCareNexRingEcg implements WearableDevice {
info: WearableInfo = { id: 'duecare.nexring-ecg', vendor: 'duecare', displayName: 'DueCare Cardio Ring (ECG)', category: 'wearable', family: 'smart-ring' };
async connect() {}
async disconnect() {}
async sync(): Promise<MetricSample[]> { return []; }
}