import type { WearableDevice, WearableInfo, MetricSample } from '../../../types';
export default class FitbitLuxe implements WearableDevice {
info: WearableInfo = { id: 'fitbit.luxe', vendor: 'fitbit', displayName: 'Fitbit Luxe', category: 'wearable', family: 'band' };
async connect() {}
async disconnect() {}
async sync(): Promise<MetricSample[]> { return []; }
}