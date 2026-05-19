// apps/patient-app/src/devices/bleNative.ts
import { Capacitor } from '@capacitor/core';
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

type BleBridgePlugin = {
  connectBle: (opts: {
    services?: string[];
    characteristics?: Record<string, string>;
    namePrefix?: string[];
  }) => Promise<any>;
  write: (opts: { charKey: string; base64: string }) => Promise<any>;
  subscribe: (opts: { charKey: string }) => Promise<any>;
  unsubscribe?: (opts: { charKey: string }) => Promise<any>;
  stopAll: (opts?: Record<string, never>) => Promise<any>;
  configure?: (opts: { autoReconnect?: boolean; maxAttempts?: number }) => Promise<any>;
  addListener: (
    eventName: string,
    listener: (evt: any) => void
  ) => Promise<{ remove: () => Promise<void> | void }> | { remove: () => Promise<void> | void };
};

function isNativeCapacitor(): boolean {
  try {
    return typeof window !== 'undefined' && !!Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

function getBleBridge(): BleBridgePlugin | null {
  if (typeof window === 'undefined') return null;
  return ((window as any)?.Capacitor?.Plugins?.BleBridge ?? null) as BleBridgePlugin | null;
}

function toBase64(u8: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function safeRemove(handleOrPromise: any): Promise<void> {
  try {
    const handle = await handleOrPromise;
    await handle?.remove?.();
  } catch {}
}

export async function connectBleNative(key: DeviceKey): Promise<BleConn> {
  const spec = MAP[key];
  if (!spec || spec.transport !== 'ble') {
    throw new Error('Not a BLE device');
  }

  if (!isNativeCapacitor()) {
    const { connectBle, subscribe } = await import('./ble');
    const conn = await connectBle(key);
    const sub = async (charKey: string, cb: (dv: DataView) => void) => subscribe(conn, charKey, cb);
    return { ...conn, subscribe: sub as any };
  }

  const BleBridge = getBleBridge();
  if (!BleBridge) {
    throw new Error('BleBridge native plugin not available');
  }

  const namePrefix = spec.filters?.namePrefix ?? undefined;
  const services = spec.filters?.services ?? [];
  const characteristics = Object.fromEntries(
    Object.entries(spec.characteristics ?? {}).map(([k, v]) => [k, v.uuid])
  );

  let isConnected = false;
  const writeQueue: Array<{ charKey: string; data: Uint8Array }> = [];
  let flushing = false;

  const flushQueue = async () => {
    if (flushing || !isConnected || writeQueue.length === 0) return;
    flushing = true;
    try {
      while (isConnected && writeQueue.length > 0) {
        const next = writeQueue.shift();
        if (!next) break;
        await BleBridge.write({
          charKey: next.charKey,
          base64: toBase64(next.data),
        });
      }
    } finally {
      flushing = false;
    }
  };

  const onConnect = () => {
    isConnected = true;
    setTimeout(() => {
      void flushQueue();
    }, 150);
  };

  const onDisconnect = () => {
    isConnected = false;
  };

  const connListener = BleBridge.addListener('bleConnect', onConnect);
  const discListener = BleBridge.addListener('bleDisconnect', onDisconnect);

  await BleBridge.connectBle({
    services,
    characteristics,
    namePrefix,
  });

  // Mark connected optimistically after successful connect call.
  // Native plugin event should still arrive and keep state aligned.
  isConnected = true;

  const chars = new Map<string, any>();
  for (const k of Object.keys(characteristics)) {
    chars.set(k, { __native: true });
  }

  const servicesMap = new Map<string, any>();
  const device = { id: spec.id };

  const write = async (charKey: string, data: Uint8Array) => {
    if (!isConnected) {
      writeQueue.push({ charKey, data });
      return;
    }

    try {
      await BleBridge.write({
        charKey,
        base64: toBase64(data),
      });
    } catch {
      writeQueue.push({ charKey, data });
    }
  };

  const subscribe = async (charKey: string, onValue: (dv: DataView) => void) => {
    const handler = (evt: any) => {
      if (!evt || evt.charKey !== charKey || !evt.base64) return;
      try {
        const u8 = fromBase64(evt.base64);
        onValue(new DataView(u8.buffer, u8.byteOffset, u8.byteLength));
      } catch {}
    };

    const valueListener = BleBridge.addListener('bleValue', handler);
    await BleBridge.subscribe({ charKey });

    return async () => {
      await safeRemove(valueListener);
      try {
        await BleBridge.unsubscribe?.({ charKey });
      } catch {}
    };
  };

  const stopAll = async () => {
    try {
      await BleBridge.stopAll({});
    } catch {}

    await safeRemove(connListener);
    await safeRemove(discListener);

    isConnected = false;
    writeQueue.length = 0;
  };

  const configure = async (opts: { autoReconnect?: boolean; maxAttempts?: number }) => {
    try {
      await BleBridge.configure?.(opts);
    } catch {}
  };

  return {
    device,
    services: servicesMap,
    chars,
    stopAll,
    write,
    subscribe,
    configure,
  };
}