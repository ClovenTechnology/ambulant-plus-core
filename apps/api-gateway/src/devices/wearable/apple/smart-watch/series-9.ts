import type { WearableDevice, WearableInfo, MetricSample } from '../../../types';
export default class AppleSeries9 implements WearableDevice {
info: WearableInfo = { id: 'apple.series-9', vendor: 'apple', displayName: 'Apple Watch Series 9', category: 'wearable', family: 'smart-watch' };
async connect() {}
async disconnect() {}
async sync(): Promise<MetricSample[]> { return []; }
}