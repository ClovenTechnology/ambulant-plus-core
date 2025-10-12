import type { WearableDevice, WearableInfo, MetricSample } from '../../../types';
export default class AppleUltra implements WearableDevice {
info: WearableInfo = { id: 'apple.ultra', vendor: 'apple', displayName: 'Apple Watch Ultra', category: 'wearable', family: 'smart-watch' };
async connect() {}
async disconnect() {}
async sync(): Promise<MetricSample[]> { return []; }
}