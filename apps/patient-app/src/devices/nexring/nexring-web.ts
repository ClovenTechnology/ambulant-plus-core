'use client';

export const NEXRING_SERVICE_UUID = '00001822-0000-1000-8000-00805f9b34fb';
export const NEXRING_IO_UUID = '000066fe-0000-1000-8000-00805f9b34fb';
export const NEXRING_OTA_UUID = '0000fef5-0000-1000-8000-00805f9b34fb';

export type WebRingScanDevice = {
  id: string;
  mac?: string;
  name?: string;
  rssi?: number;
  isConnectable?: boolean;
};

export type WebRingNotify = {
  serviceUuid: string;
  characteristicUuid: string;
  base64: string;
  hex: string;
  length: number;
};

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';

  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }

  return btoa(bin);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function dvToU8(dv: DataView): Uint8Array {
  return new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
}

function normalizeDeviceId(device: BluetoothDevice): string {
  return String((device as { id?: string }).id || device.name || 'web-ring');
}

function normalizeScanDevice(device: BluetoothDevice): WebRingScanDevice {
  return {
    id: normalizeDeviceId(device),
    mac: undefined,
    name: device.name || 'Unnamed ring',
    rssi: undefined,
    isConnectable: true,
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function errorName(err: unknown): string {
  if (err && typeof err === 'object' && 'name' in err) {
    return String((err as { name?: unknown }).name || 'Error');
  }

  return 'Error';
}

function getBluetooth(): Bluetooth {
  if (typeof navigator === 'undefined' || !navigator.bluetooth) {
    throw new Error('Web Bluetooth not available in this browser/context');
  }

  return navigator.bluetooth;
}

function toStrictArrayBuffer(data: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  return buffer;
}

export class NexRingWebTransport {
  private device: BluetoothDevice | null = null;
  private gatt: BluetoothRemoteGATTServer | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private ioChar: BluetoothRemoteGATTCharacteristic | null = null;
  private notifyHandler: ((event: Event) => void) | null = null;

  private knownDevices = new Map<string, BluetoothDevice>();
  private selectedDeviceId: string | null = null;

  constructor(
    private readonly callbacks: {
      onConnectionState?: (state: {
        state: string;
        id?: string;
        mac?: string;
        name?: string;
      }) => void;
      onReady?: () => void;
      onNotify?: (event: WebRingNotify) => void;
      onError?: (event: { code: string; message: string }) => void;
      onScanResult?: (device: WebRingScanDevice) => void;
    } = {}
  ) {}

  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.bluetooth &&
      (window.isSecureContext || window.location.hostname === 'localhost')
    );
  }

  async askPermissions(): Promise<{ ok: true }> {
    return { ok: true as const };
  }

  private rememberDevice(device: BluetoothDevice): string {
    const id = normalizeDeviceId(device);

    this.knownDevices.set(id, device);
    this.selectedDeviceId = id;
    this.device = device;

    return id;
  }

  private async refreshGrantedDevices(): Promise<void> {
    const bluetooth =
      typeof navigator !== 'undefined' ? navigator.bluetooth : undefined;

    const getDevices = (bluetooth as unknown as {
      getDevices?: () => Promise<BluetoothDevice[]>;
    } | undefined)?.getDevices;

    if (!bluetooth || typeof getDevices !== 'function') {
      return;
    }

    try {
      const granted = await getDevices.call(bluetooth);

      for (const device of granted || []) {
        const id = normalizeDeviceId(device);
        this.knownDevices.set(id, device);
      }
    } catch {
      // Ignore browser/device permission enumeration failures.
    }
  }

  private async resolveDevice(options?: {
    id?: string;
    name?: string;
  }): Promise<BluetoothDevice | null> {
    if (options?.id && this.knownDevices.has(options.id)) {
      const device = this.knownDevices.get(options.id)!;

      this.device = device;
      this.selectedDeviceId = options.id;

      return device;
    }

    if (this.device) {
      const currentId = normalizeDeviceId(this.device);

      if (!options?.id || options.id === currentId) {
        this.selectedDeviceId = currentId;
        return this.device;
      }
    }

    await this.refreshGrantedDevices();

    if (options?.id && this.knownDevices.has(options.id)) {
      const device = this.knownDevices.get(options.id)!;

      this.device = device;
      this.selectedDeviceId = options.id;

      return device;
    }

    if (this.selectedDeviceId && this.knownDevices.has(this.selectedDeviceId)) {
      const device = this.knownDevices.get(this.selectedDeviceId)!;

      this.device = device;

      return device;
    }

    return null;
  }

  async startScan(): Promise<
    | { ok: true; selectedId: string }
    | { ok: false; code: string; message: string }
  > {
    if (!this.isSupported()) {
      const message = 'Web Bluetooth not available in this browser/context';

      this.callbacks.onError?.({
        code: 'web_bluetooth_unavailable',
        message,
      });

      throw new Error(message);
    }

    this.callbacks.onConnectionState?.({ state: 'scanning' });

    try {
      const bluetooth = getBluetooth();

      const device = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          NEXRING_SERVICE_UUID,
          NEXRING_OTA_UUID,
          '0000180a-0000-1000-8000-00805f9b34fb',
          '0000180d-0000-1000-8000-00805f9b34fb',
        ],
      });

      const id = this.rememberDevice(device);
      const scanResult = normalizeScanDevice(device);

      this.callbacks.onScanResult?.(scanResult);
      this.callbacks.onConnectionState?.({
        state: 'scan_stopped',
        id,
        name: scanResult.name,
      });

      return {
        ok: true as const,
        selectedId: id,
      };
    } catch (err) {
      const code = errorName(err);
      const message = errorMessage(err);

      this.callbacks.onConnectionState?.({ state: 'scan_stopped' });
      this.callbacks.onError?.({ code, message });

      return {
        ok: false as const,
        code,
        message,
      };
    }
  }

  async stopScan(): Promise<{ ok: true }> {
    this.callbacks.onConnectionState?.({ state: 'scan_stopped' });
    return { ok: true as const };
  }

  async connect(options: {
    id?: string;
    mac?: string;
    name?: string;
  }): Promise<{ ok: true; id: string; mac: undefined; name: string }> {
    const device = await this.resolveDevice(options);

    if (!device) {
      throw new Error('No device selected. Run scan first.');
    }

    if (!device.gatt) {
      throw new Error('Selected device has no GATT server');
    }

    const id = normalizeDeviceId(device);

    this.callbacks.onConnectionState?.({
      state: 'connecting',
      id,
      name: device.name || options.name || '',
    });

    try {
      this.gatt = await device.gatt.connect();
      this.service = await this.gatt.getPrimaryService(NEXRING_SERVICE_UUID);
      this.ioChar = await this.service.getCharacteristic(NEXRING_IO_UUID);

      this.notifyHandler = (event: Event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic | null;
        const value = target?.value;

        if (!value) {
          return;
        }

        const bytes = dvToU8(value);

        this.callbacks.onNotify?.({
          serviceUuid: NEXRING_SERVICE_UUID,
          characteristicUuid: NEXRING_IO_UUID,
          base64: bytesToBase64(bytes),
          hex: bytesToHex(bytes),
          length: bytes.length,
        });
      };

      this.ioChar.addEventListener(
        'characteristicvaluechanged',
        this.notifyHandler as EventListener
      );

      await this.ioChar.startNotifications();

      this.device = device;
      this.selectedDeviceId = id;
      this.knownDevices.set(id, device);

      this.callbacks.onConnectionState?.({
        state: 'connected',
        id,
        name: device.name || options.name || '',
      });

      this.callbacks.onReady?.();

      return {
        ok: true as const,
        id,
        mac: undefined,
        name: device.name || options.name || '',
      };
    } catch (err) {
      const code = errorName(err);
      const message = errorMessage(err);

      this.callbacks.onError?.({ code, message });
      this.callbacks.onConnectionState?.({
        state: 'disconnected',
        id,
        name: device.name || options.name || '',
      });

      throw err;
    }
  }

  async disconnect(): Promise<{ ok: true }> {
    try {
      if (this.ioChar && this.notifyHandler) {
        this.ioChar.removeEventListener(
          'characteristicvaluechanged',
          this.notifyHandler as EventListener
        );
      }
    } catch {
      // Ignore cleanup failures.
    }

    try {
      await this.ioChar?.stopNotifications?.();
    } catch {
      // Ignore notification shutdown failures.
    }

    try {
      this.device?.gatt?.disconnect();
    } catch {
      // Ignore disconnect failures.
    }

    const disconnectedDeviceId = this.device
      ? normalizeDeviceId(this.device)
      : this.selectedDeviceId || '';

    const disconnectedDeviceName = this.device?.name || '';

    this.ioChar = null;
    this.service = null;
    this.gatt = null;
    this.notifyHandler = null;

    this.callbacks.onConnectionState?.({
      state: 'disconnected',
      id: disconnectedDeviceId,
      name: disconnectedDeviceName,
    });

    return { ok: true as const };
  }

  async requestMtu(options?: {
    mtu?: number;
  }): Promise<{ ok: false; requestedMtu: number }> {
    return {
      ok: false,
      requestedMtu: options?.mtu ?? 247,
    };
  }

  async startStreaming(): Promise<{ ok: true }> {
    return { ok: true as const };
  }

  async stopStreaming(): Promise<{ ok: true }> {
    return { ok: true as const };
  }

  async write(options: {
    bytes?: number[];
    base64?: string;
  }): Promise<{
    ok: true;
    length: number;
    writeMode: 'with_response' | 'without_response' | 'legacy_writeValue';
  }> {
    if (!this.ioChar) {
      throw new Error('No connected IO characteristic');
    }

    let bytes: Uint8Array | null = null;

    if (options.bytes?.length) {
      bytes = Uint8Array.from(options.bytes.map((value) => value & 0xff));
    } else if (options.base64) {
      const bin = atob(options.base64);
      const out = new Uint8Array(bin.length);

      for (let i = 0; i < bin.length; i += 1) {
        out[i] = bin.charCodeAt(i);
      }

      bytes = out;
    }

    if (!bytes || bytes.length === 0) {
      throw new Error('write requires bytes or base64');
    }

    const payload = toStrictArrayBuffer(bytes);

    // Prefer write-with-response first for NexRing command reliability.
    if (typeof this.ioChar.writeValueWithResponse === 'function') {
      await this.ioChar.writeValueWithResponse(payload);

      return {
        ok: true as const,
        length: bytes.length,
        writeMode: 'with_response',
      };
    }

    if (typeof this.ioChar.writeValueWithoutResponse === 'function') {
      await this.ioChar.writeValueWithoutResponse(payload);

      return {
        ok: true as const,
        length: bytes.length,
        writeMode: 'without_response',
      };
    }

    await this.ioChar.writeValue(payload);

    return {
      ok: true as const,
      length: bytes.length,
      writeMode: 'legacy_writeValue',
    };
  }
}