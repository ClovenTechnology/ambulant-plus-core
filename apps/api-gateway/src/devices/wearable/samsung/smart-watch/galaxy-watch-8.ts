import type { WearableDevice, WearableInfo, MetricSample } from '../../../types';
export default class AppleSE3 implements WearableDevice {
info: WearableInfo = { id: 'apple.se-3', vendor: 'apple', displayName: 'Apple Watch SE (3rd gen)', category: 'wearable', family: 'smart-watch' };
async connect() {}
async disconnect() {}
async sync(): Promise<MetricSample[]> { return []; }
}