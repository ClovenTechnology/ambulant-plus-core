import type { WearableDevice, WearableInfo, MetricSample } from '../../../types';
export default class OuraGen4 implements WearableDevice {
info: WearableInfo = { id: 'oura.gen-4', vendor: 'oura', displayName: 'Oura Ring Gen 4', category: 'wearable', family: 'smart-ring' };
async connect() {}
async disconnect() {}
async sync(): Promise<MetricSample[]> { return []; }
}