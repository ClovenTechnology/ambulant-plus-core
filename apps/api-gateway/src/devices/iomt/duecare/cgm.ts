import type { IoMTDevice, IoMTInfo, IoMTData } from '../../types';
export default class DueCareCGM implements IoMTDevice {
info: IoMTInfo = { id: 'duecare.cgm', vendor: 'duecare', displayName: 'DueCare CGM Patch', category: 'cgm' };
private cb?: (e: IoMTData) => void;
async connect() {}
async disconnect() {}
async start() {}
async stop() {}
onData(cb: (e: IoMTData) => void) { this.cb = cb; }
}