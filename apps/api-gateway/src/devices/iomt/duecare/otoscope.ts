// apps/api-gateway/src/devices/iomt/duecare/otoscope.ts
import type { IoMTDevice, IoMTInfo, IoMTData } from '../../types';
export default class DueCareOtoscope implements IoMTDevice {
  info: IoMTInfo = {
    id: 'duecare.otoscope',
    vendor: 'duecare',
    displayName: 'DueCare HD Otoscope',
    category: 'otoscope',
  };
  private cb?: (e: IoMTData) => void;
  async connect() {}
  async disconnect() {}
  async start() { /* emit { kind:'photo' | 'video', b64:..., ts:... } via this.cb */ }
  async stop() {}
  onData(cb: (e: IoMTData) => void) { this.cb = cb; }
}
