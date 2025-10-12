import type { WearableDevice, WearableInfo, MetricSample } from '../../../types';
export default class GalaxyWatch8Classic implements WearableDevice {
info: WearableInfo = { id: 'samsung.galaxy-watch-8-classic', vendor: 'samsung', displayName: 'Galaxy Watch 8 Classic', category: 'wearable', family: 'smart-watch' };
async connect() {}
async disconnect() {}
async sync(): Promise<MetricSample[]> { return []; }
}