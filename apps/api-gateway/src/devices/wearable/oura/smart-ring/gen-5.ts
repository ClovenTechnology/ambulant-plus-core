import type { WearableDevice, WearableInfo, MetricSample } from '../../../types';
export default class OuraGen5 implements WearableDevice {
info: WearableInfo = { id: 'oura.gen-5', vendor: 'oura', displayName: 'Oura Ring Gen 5', category: 'wearable', family: 'smart-ring' };
async connect() {}
async disconnect() {}
async sync(): Promise<MetricSample[]> { return []; }
}