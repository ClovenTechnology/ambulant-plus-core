import { registerPlugin } from '@capacitor/core';
import type { HealthMonitorPlugin } from './definitions';

export const HealthMonitor = registerPlugin<HealthMonitorPlugin>('HealthMonitor', {
  web: () => import('./web').then(m => new m.HealthMonitorWeb()),
});

export * from './definitions';
