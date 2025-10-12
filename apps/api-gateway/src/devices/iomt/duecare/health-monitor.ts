// apps/api-gateway/src/devices/iomt/duecare/health-monitor.ts
import type { IoMTDevice, IoMTInfo, IoMTData } from '../../types';

export default class DueCareHealthMonitor implements IoMTDevice {
  // Normalized vendor-prefixed id
  info: IoMTInfo = {
    id: 'duecare.health-monitor',
    vendor: 'duecare',
    displayName: 'DueCare Health Monitor',
    category: 'monitor',
  };

  private cb?: (e: IoMTData) => void;

  async connect() {
    // implement BLE connect using SDK
  }
  async disconnect() {
    // cleanup
  }
  async start() {
    // start BLE session: BP/SpO2/ECG/temp and glucose spot if supported
  }
  async stop() {}
  onData(cb: (e: IoMTData) => void) { this.cb = cb; }
}
