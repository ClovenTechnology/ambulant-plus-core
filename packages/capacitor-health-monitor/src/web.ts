import { WebPlugin } from '@capacitor/core';
import type { HealthMonitorPlugin } from './definitions';

export class HealthMonitorWeb extends WebPlugin implements HealthMonitorPlugin {
  async connect(_opts: any){ return { ok: true }; }
  async startStreaming(){ return { ok: true }; }
  async stopStreaming(){ return { ok: true }; }
  async disconnect(){ return { ok: true }; }
}
