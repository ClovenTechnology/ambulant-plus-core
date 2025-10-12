// apps/patient-app/src/lib/ble.ts
export type BleConnectResult = {
  device: BluetoothDevice;
  server: BluetoothRemoteGATTServer;
  cleanup: () => Promise<void>;
  abortController: AbortController;
};

export async function webBleConnect(filters: BluetoothRequestDeviceFilter[]): Promise<BleConnectResult> {
  // ensure developer didn't accidentally pass empty filters
  if (!Array.isArray(filters) || filters.length === 0) {
    throw new Error('No BLE filters supplied — ensure device service UUIDs are present.');
  }

  const abortController = new AbortController();

  try {
    // Do not use acceptAllDevices:true in production. Use filters with service UUIDs/namePrefix.
    const dev = await navigator.bluetooth.requestDevice({
      filters,
      optionalServices: Array.from(new Set(filters.flatMap(f => (f.services || []) as string[]))),
    });

    // user may cancel: guard
    if (!dev) throw new Error('device_selection_cancelled');

    const onDisconnected = () => {
      // no-op but can be expanded
    };

    dev.addEventListener('gattserverdisconnected', onDisconnected as EventListener);

    const server = await dev.gatt!.connect();

    async function cleanup() {
      try {
        // remove listeners
        try { dev.removeEventListener('gattserverdisconnected', onDisconnected as EventListener); } catch {}
        // stop gatt
        if (server?.connected) {
          try { server.disconnect(); } catch {}
        }
      } finally {
        abortController.abort();
      }
    }

    // When caller aborts, ensure cleanup
    abortController.signal.addEventListener('abort', () => {
      cleanup().catch(()=>{});
    });

    return { device: dev, server, cleanup, abortController };
  } catch (err) {
    // Translate common errors for UX
    const msg = (err instanceof Error) ? err.message : String(err);
    if (msg.includes('User cancelled') || msg.includes('cancelled')) {
      throw new Error('pairing_cancelled_by_user');
    }
    if (msg.includes('No supported devices') || msg.includes('No device found')) {
      throw new Error('no_supported_device_found');
    }
    throw err;
  }
}

// Subscribe to notifications and return an unsubscribe helper
export async function subscribeNotify(
  server: BluetoothRemoteGATTServer,
  serviceUUID: BluetoothServiceUUID,
  charUUID: BluetoothCharacteristicUUID,
  onValue: (dv: DataView) => void
) {
  const svc = await server.getPrimaryService(serviceUUID);
  const ch = await svc.getCharacteristic(charUUID);
  await ch.startNotifications();

  const handler = (e: Event) => {
    const val = (e.target as BluetoothRemoteGATTCharacteristic).value!;
    onValue(val);
  };

  ch.addEventListener('characteristicvaluechanged', handler);

  return async function unsubscribe() {
    try {
      ch.removeEventListener('characteristicvaluechanged', handler);
    } catch {}
    try { await ch.stopNotifications(); } catch {}
  };
}
