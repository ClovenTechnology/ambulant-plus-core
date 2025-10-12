import type { WearableDevice, WearableInfo, MetricSample } from '../../../types';
export default class AppleSeries10 implements WearableDevice {
info: WearableInfo = { id: 'apple.series-10', vendor: 'apple', displayName: 'Apple Watch Series 10', category: 'wearable', family: 'smart-watch' };
async connect() {}
async disconnect() {}
async sync(): Promise<MetricSample[]> { return []; }
}