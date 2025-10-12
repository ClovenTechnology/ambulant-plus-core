// apps/api-gateway/src/devices/iomt/duecare/stethoscope.ts
import type { IoMTDevice, IoMTInfo, IoMTData } from '../../types';
export default class DueCareStethoscope implements IoMTDevice {
  info: IoMTInfo = {
    id: 'duecare.stethoscope',
    vendor: 'duecare',
    displayName: 'DueCare Stethoscope',
    category: 'stethoscope',
  };
  private cb?: (e: IoMTData) => void;
  async connect() {}
  async disconnect() {}
  async start() {}
  async stop() {}
  onData(cb: (e: IoMTData) => void) { this.cb = cb; }
}
