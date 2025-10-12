import type { IoMTDevice, IoMTInfo, IoMTData } from '../../types';
export default class DueCareSmartScale implements IoMTDevice {
info: IoMTInfo = { id: 'duecare.smart-scale', vendor: 'duecare', displayName: 'DueCare Smart Scale (28‑metric)', category: 'scale' };
private cb?: (e: IoMTData) => void;
async connect() {}
async disconnect() {}
async start() {}
async stop() {}
onData(cb: (e: IoMTData) => void) { this.cb = cb; }
}