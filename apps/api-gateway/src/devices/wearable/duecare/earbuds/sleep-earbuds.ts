import type { WearableDevice, WearableInfo, MetricSample } from '../../../types';
export default class DueCareSleepEarbuds implements WearableDevice {
info: WearableInfo = { id: 'duecare.sleep-earbuds', vendor: 'duecare', displayName: 'DueCare Sleep Earbuds', category: 'wearable', family: 'earbuds' };
async connect() {}
async disconnect() {}
async sync(): Promise<MetricSample[]> { return []; }
}