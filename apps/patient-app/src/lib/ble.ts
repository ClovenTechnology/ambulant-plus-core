// apps/patient-app/src/lib/ble.ts

export type BleConnectResult = {
  device: BluetoothDevice;
  server: BluetoothRemoteGATTServer;
  cleanup: () => Promise<void>;
  abortController: AbortController;
};

function getBluetooth(): Bluetooth {
  if (typeof navigator === 'undefined' || !navigator.bluetooth) {
    throw new Error(
      'Web Bluetooth is not available in this browser. Use Chrome or Edge over HTTPS or localhost.'
    );
  }

  return navigator.bluetooth;
}

function getOptionalServicesFromFilters(
  filters: BluetoothRequestDeviceFilter[]
): BluetoothServiceUUID[] {
  return Array.from(
    new Set(
      filters.flatMap((filter) =>
        Array.isArray(filter.services) ? filter.services : []
      )
    )
  );
}

function getCharacteristicValue(event: Event): DataView | null {
  const target = event.target as BluetoothRemoteGATTCharacteristic | null;
  return target?.value ?? null;
}

function normalizeBleError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);

  if (
    message.includes('User cancelled') ||
    message.includes('cancelled') ||
    message.includes('User canceled') ||
    message.includes('canceled')
  ) {
    return new Error('pairing_cancelled_by_user');
  }

  if (
    message.includes('No supported devices') ||
    message.includes('No device found')
  ) {
    return new Error('no_supported_device_found');
  }

  return err instanceof Error ? err : new Error(message);
}

export async function webBleConnect(
  filters: BluetoothRequestDeviceFilter[]
): Promise<BleConnectResult> {
  if (!Array.isArray(filters) || filters.length === 0) {
    throw new Error(
      'No BLE filters supplied — ensure device service UUIDs are present.'
    );
  }

  const bluetooth = getBluetooth();
  const abortController = new AbortController();

  try {
    // Do not use acceptAllDevices:true in production. Use filters with service UUIDs/namePrefix.
    const device = await bluetooth.requestDevice({
      filters,
      optionalServices: getOptionalServicesFromFilters(filters),
    });

    if (!device) {
      throw new Error('device_selection_cancelled');
    }

    if (!device.gatt) {
      throw new Error('Selected BLE device has no GATT server.');
    }

    const onDisconnected = (): void => {
      // Placeholder for future disconnected-state handling.
    };

    device.addEventListener(
      'gattserverdisconnected',
      onDisconnected as EventListener
    );

    const server = await device.gatt.connect();

    let cleanedUp = false;

    async function cleanup(): Promise<void> {
      if (cleanedUp) return;
      cleanedUp = true;

      try {
        try {
          device.removeEventListener(
            'gattserverdisconnected',
            onDisconnected as EventListener
          );
        } catch {
          // Ignore listener cleanup failures.
        }

        if (server.connected) {
          try {
            server.disconnect();
          } catch {
            // Ignore disconnect failures.
          }
        }
      } finally {
        if (!abortController.signal.aborted) {
          abortController.abort();
        }
      }
    }

    abortController.signal.addEventListener(
      'abort',
      () => {
        void cleanup();
      },
      { once: true }
    );

    return {
      device,
      server,
      cleanup,
      abortController,
    };
  } catch (err) {
    throw normalizeBleError(err);
  }
}

// Subscribe to notifications and return an unsubscribe helper.
export async function subscribeNotify(
  server: BluetoothRemoteGATTServer,
  serviceUUID: BluetoothServiceUUID,
  charUUID: BluetoothCharacteristicUUID,
  onValue: (dv: DataView) => void
): Promise<() => Promise<void>> {
  const service = await server.getPrimaryService(serviceUUID);
  const characteristic = await service.getCharacteristic(charUUID);

  await characteristic.startNotifications();

  const handler = (event: Event): void => {
    const value = getCharacteristicValue(event);

    if (!value) {
      return;
    }

    onValue(value);
  };

  characteristic.addEventListener('characteristicvaluechanged', handler);

  return async function unsubscribe(): Promise<void> {
    try {
      characteristic.removeEventListener(
        'characteristicvaluechanged',
        handler
      );
    } catch {
      // Ignore listener cleanup failures.
    }

    try {
      await characteristic.stopNotifications();
    } catch {
      // Ignore notification shutdown failures.
    }
  };
}