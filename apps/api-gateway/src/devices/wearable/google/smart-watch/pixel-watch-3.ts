import type { WearableDevice, WearableInfo, MetricSample } from '../../../types';
export default class PixelWatch3 implements WearableDevice {
info: WearableInfo = { id: 'google.pixel-watch-3', vendor: 'google', displayName: 'Pixel Watch 3', category: 'wearable', family: 'smart-watch' };
async connect() {}
async disconnect() {}
async sync(): Promise<MetricSample[]> { return []; }
}