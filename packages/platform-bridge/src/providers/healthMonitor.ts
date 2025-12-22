// packages/platform-bridge/src/providers/healthMonitor.ts
import { Capacitor } from '@capacitor/core';

// Prefer typed import if your workspace links the plugin:
let plugin: any = null;
try {
  // If you wired the plugin package name in your workspace, this import will work.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  plugin = require('@ambulant/capacitor-health-monitor').HealthMonitor;
} catch {
  /* fall back to global */
}

function getPlugin(): any | null {
  if (plugin) return plugin;
  const anyWin = typeof window !== 'undefined' ? (window as any) : null;
  return anyWin?.Capacitor?.Plugins?.HealthMonitor ?? null;
}

const isNative = () => {
  try { return Capacitor?.isNativePlatform?.() || (Capacitor as any)?.isNative; }
  catch { return false; }
};

export type HMBridge = {
  available: boolean;
  connect(opts: { patientId: string; ctrlStart?: number[]; ctrlStop?: number[] }): Promise<void>;
  startStreaming(): Promise<void>;
  stopStreaming(): Promise<void>;
  disconnect(): Promise<void>;
  on(event:
    'telemetry' | 'ecg' | 'ppg' | 'heart_rate' | 'blood_pressure' | 'temperature' | 'blood_glucose' | 'vitals',
    cb: (data: any) => void
  ): () => void;
};

const healthMonitor: HMBridge = {
  available: !!getPlugin(),
  async connect(opts) {
    const p = getPlugin();
    if (!p || !isNative()) return;
    await p.connect(opts);
  },
  async startStreaming() {
    const p = getPlugin();
    if (!p || !isNative()) return;
    await p.startStreaming();
  },
  async stopStreaming() {
    const p = getPlugin();
    if (!p || !isNative()) return;
    await p.stopStreaming();
  },
  async disconnect() {
    const p = getPlugin();
    if (!p || !isNative()) return;
    await p.disconnect();
  },
  on(event, cb) {
    const p = getPlugin();
    if (!p || !isNative()) return () => {};
    let sub: { remove: () => void } | null = null;
    p.addListener(event, (data: any) => { try { cb(data); } catch {} })
      .then((h: any) => sub = h)
      .catch(() => sub = null);
    return () => { try { sub?.remove?.(); } catch {} };
  },
};

export default healthMonitor;
