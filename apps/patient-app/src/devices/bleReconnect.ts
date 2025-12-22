// apps/patient-app/src/devices/bleReconnect.ts
export function attachAutoReconnect(
  device: BluetoothDevice,
  onReconnect: () => Promise<void>,
  { initialBackoffMs = 500, maxBackoffMs = 8000 } = {}
) {
  let backoff = initialBackoffMs;

  const handler = async () => {
    // Loop until we re-establish GATT and re-run the caller's wiring
    while (!device.gatt?.connected) {
      try {
        await device.gatt?.connect();
        await onReconnect();
        backoff = initialBackoffMs; // reset after success
        return;
      } catch {
        await new Promise(r => setTimeout(r, backoff));
        backoff = Math.min(backoff * 2, maxBackoffMs);
      }
    }
  };

  device.addEventListener('gattserverdisconnected', handler);
  // return disposer if you need to remove it later
  return () => device.removeEventListener('gattserverdisconnected', handler);
}
