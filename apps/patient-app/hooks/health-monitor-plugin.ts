import { registerPlugin } from '@capacitor/core';

type HMEvent = any;

export type HealthMonitorPlugin = {
  askPermissions(): Promise<void>;
  startScan(): Promise<void>;
  stopScan(): Promise<void>;
  connect(options: { mac: string }): Promise<void>;
  startMeasurements(): Promise<void>;
  stopMeasurements(): Promise<void>;
  addListener(event: string, cb: (data: HMEvent) => void): Promise<{ remove: () => void }>;
};

export const HealthMonitor = registerPlugin<HealthMonitorPlugin>('HealthMonitor');
