import type { WearableDevice, WearableInfo, MetricSample } from '../../../types';
export default class AppleUltra2 implements WearableDevice {
info: WearableInfo = { id: 'apple.ultra-2', vendor: 'apple', displayName: 'Apple Watch Ultra 2', category: 'wearable', family: 'smart-watch' };
async connect() {}
async disconnect() {}
async sync(): Promise<MetricSample[]> { return []; }
}