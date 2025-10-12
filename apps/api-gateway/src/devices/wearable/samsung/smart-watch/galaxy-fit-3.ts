import type { WearableDevice, WearableInfo, MetricSample } from '../../../types';
export default class GalaxyFit3 implements WearableDevice {
info: WearableInfo = { id: 'samsung.galaxy-fit-3', vendor: 'samsung', displayName: 'Galaxy Fit3', category: 'wearable', family: 'band' };
async connect() {}
async disconnect() {}
async sync(): Promise<MetricSample[]> { return []; }
}