import type { WearableDevice, WearableInfo, MetricSample } from '../../../types';
export default class AppleUltra3 implements WearableDevice {
info: WearableInfo = { id: 'apple.ultra-3', vendor: 'apple', displayName: 'Apple Watch Ultra 3', category: 'wearable', family: 'smart-watch' };
async connect() {}
async disconnect() {}
async sync(): Promise<MetricSample[]> { return []; }
}