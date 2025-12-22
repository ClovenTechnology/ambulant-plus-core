// apps/patient-app/src/devices/bleNative.ts
import { Plugins } from '@capacitor/core';
import type { DeviceKey } from './serviceMap';
import { DEVICE_MAP as MAP } from './serviceMap';

type BleConn = {
  device: { id: string };
  services: Map<string, any>;
  chars: Map<string, any>;
  stopAll: () => Promise<void>;
  write: (charKey: string, data: Uint8Array) => Promise<void>;
  subscribe: (charKey: string, cb: (dv: DataView) => void) => Promise<() => void>;
  configure?: (opts: { autoReconnect?: boolean; maxAttempts?: number }) => Promise<void>;
};

const isCap =
  typeof (window as any).Capacitor !== 'undefined' &&
  (window as any).Capacitor.isNativePlatform();

export async function connectBleNative(key: DeviceKey): Promise<BleConn> {
  const spec = MAP[key];
  if (!spec || spec.transport !== 'ble') throw new Error('Not a BLE device');

  if (!isCap) {
    // fall back to Web Bluetooth
    const { connectBle, subscribe } = await import('./ble');
    const conn = await connectBle(key);
    const sub = async (charKey: string, cb: (dv: DataView) => void) => subscribe(conn, charKey, cb);
    return { ...conn, subscribe: sub as any };
  }

  // --- Native path (iOS) ---
  const { BleBridge } = (Plugins as any);
  const namePrefix = spec.filters?.namePrefix ?? undefined;
  const services = spec.filters?.services ?? [];
  const characteristics = Object.fromEntries(
    Object.entries(spec.characteristics ?? {}).map(([k, v]) => [k, v.uuid])
  );

  // Connection state + simple write queue
  let isConnected = false;
  const writeQueue: Array<{ charKey: string; data: Uint8Array }> = [];
  let flushing = false;

  const toBase64 = (u8: Uint8Array) => btoa(String.fromCharCode(...u8));
  const fromBase64 = (b64: string) => {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };

  const flushQueue = async () => {
    if (flushing || !isConnected || writeQueue.length === 0) return;
    flushing = true;
    try {
      while (isConnected && writeQueue.length) {
        const { charKey, data } = writeQueue.shift()!;
        await BleBridge.write({ charKey, base64: toBase64(data) });
      }
    } finally {
      flushing = false;
    }
  };

  // Wire up connect/disconnect so we can flush queued writes
  const onConnect = () => {
    isConnected = true;
    setTimeout(() => void flushQueue(), 150);
  };
  const onDisconnect = () => {
    isConnected = false;
  };

  const removeConn = (window as any).Capacitor.Plugins.BleBridge.addListener('bleConnect', onConnect);
  const removeDisc = (window as any).Capacitor.Plugins.BleBridge.addListener('bleDisconnect', onDisconnect);

  // Start connection
  await BleBridge.connectBle({ services, characteristics, namePrefix });

  const chars = new Map<string, any>();
  for (const k of Object.keys(characteristics)) chars.set(k, { __native: true });

  const servicesMap = new Map<string, any>();
  const device = { id: spec.id };

  const write = async (charKey: string, data: Uint8Array) => {
    if (isConnected) {
      try {
        await BleBridge.write({ charKey, base64: toBase64(data) });
      } catch {
        writeQueue.push({ charKey, data });
      }
    } else {
      writeQueue.push({ charKey, data });
    }
  };

  const subscribe = async (charKey: string, onValue: (dv: DataView) => void) => {
    const handler = (evt: any) => {
      if (evt.charKey !== charKey) return;
      const u8 = fromBase64(evt.base64);
      onValue(new DataView(u8.buffer));
    };
    const remove = (window as any).Capacitor.Plugins.BleBridge.addListener('bleValue', handler);
    await BleBridge.subscribe({ charKey });

    return () => {
      try { remove.remove(); } catch {}
      try { BleBridge.unsubscribe?.({ charKey }); } catch {}
    };
  };

  const stopAll = async () => {
    try { await BleBridge.stopAll({}); } catch {}
    try { removeConn.remove(); removeDisc.remove(); } catch {}
    isConnected = false;
    writeQueue.length = 0;
  };

  const configure = async (opts: { autoReconnect?: boolean; maxAttempts?: number }) => {
    try { await BleBridge.configure(opts); } catch {}
  };

  return { device, services: servicesMap, chars, stopAll, write, subscribe, configure };
}
