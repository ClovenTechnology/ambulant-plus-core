import type { WearableDevice, WearableInfo, MetricSample } from '../../../types';
export default class AppleSeries11 implements WearableDevice {
info: WearableInfo = { id: 'apple.series-11', vendor: 'apple', displayName: 'Apple Watch Series 11', category: 'wearable', family: 'smart-watch' };
async connect() {}
async disconnect() {}
async sync(): Promise<MetricSample[]> { return []; }
}