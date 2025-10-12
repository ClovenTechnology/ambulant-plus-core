import type { WearableDevice, WearableInfo, MetricSample } from '../../../types';
export default class FitbitCharge6 implements WearableDevice {
info: WearableInfo = { id: 'fitbit.charge-6', vendor: 'fitbit', displayName: 'Fitbit Charge 6', category: 'wearable', family: 'band' };
async connect() {}
async disconnect() {}
async sync(): Promise<MetricSample[]> { return []; }
}