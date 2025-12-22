import type { DeviceKey } from './serviceMap';

export async function connectDevice(key: DeviceKey) {
  const isCap = typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform();
  if (isCap) {
    const { connectBleNative } = await import('./bleNative');
    return connectBleNative(key);
  } else {
    const { connectBle } = await import('./ble');
    const conn = await connectBle(key);
    // normalise: add subscribe passthrough so iOS/Android/web share one call-site
    const { subscribe } = await import('./ble');
    return { ...conn, subscribe: (charKey: string, cb: (dv: DataView)=>void) => subscribe(conn, charKey, cb) } as any;
  }
}
