import type { WearableDevice, WearableInfo, MetricSample } from '../../../types';
export default class FitbitInspire3 implements WearableDevice {
info: WearableInfo = { id: 'fitbit.inspire-3', vendor: 'fitbit', displayName: 'Fitbit Inspire 3', category: 'wearable', family: 'band' };
async connect() {}
async disconnect() {}
async sync(): Promise<MetricSample[]> { return []; }
}