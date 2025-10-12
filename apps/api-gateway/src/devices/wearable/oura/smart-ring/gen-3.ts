import type { WearableDevice, WearableInfo, MetricSample } from '../../../types';
export default class OuraGen3 implements WearableDevice {
info: WearableInfo = { id: 'oura.gen-3', vendor: 'oura', displayName: 'Oura Ring Gen 3', category: 'wearable', family: 'smart-ring' };
async connect() {}
async disconnect() {}
async sync(): Promise<MetricSample[]> { return []; }
}