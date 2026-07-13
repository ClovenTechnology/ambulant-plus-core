// apps/patient-app/app/myCare/devices/nexring/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const UUID_SERVICE = '00001822-0000-1000-8000-00805f9b34fb';
const UUID_CHAR_66FE = '000066fe-0000-1000-8000-00805f9b34fb';
const UUID_OTA = '0000fef5-0000-1000-8000-00805f9b34fb';

type PacketLog = {
  ts: number;
  dir: 'rx' | 'tx' | 'sys';
  text: string;
};

function nowStamp(ts = Date.now()): string {
  const d = new Date(ts);

  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';

  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }

  return window.btoa(bin);
}

function dataViewToUint8Array(dv: DataView): Uint8Array {
  return new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
}

function getBluetooth(): Bluetooth | null {
  if (typeof navigator === 'undefined') return null;

  return navigator.bluetooth ?? null;
}

export default function NexRingConsole() {
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deviceName, setDeviceName] = useState<string>('—');
  const [deviceId, setDeviceId] = useState<string>('—');
  const [packetCount, setPacketCount] = useState(0);
  const [logs, setLogs] = useState<PacketLog[]>([]);

  const gattRef = useRef<BluetoothRemoteGATTServer | null>(null);
  const serviceRef = useRef<BluetoothRemoteGATTService | null>(null);
  const ioCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const notifyHandlerRef = useRef<EventListener | null>(null);

  const supported = useMemo(() => {
    if (typeof window === 'undefined') return false;

    const secure = window.isSecureContext || window.location.hostname === 'localhost';

    return Boolean(getBluetooth()) && secure;
  }, []);

  const log = (dir: PacketLog['dir'], text: string): void => {
    setLogs((prev) => [{ ts: Date.now(), dir, text }, ...prev].slice(0, 400));
  };

  async function cleanup(): Promise<void> {
    const characteristic = ioCharRef.current;
    const notifyHandler = notifyHandlerRef.current;

    try {
      if (characteristic && notifyHandler) {
        characteristic.removeEventListener('characteristicvaluechanged', notifyHandler);
      }
    } catch {
      // Ignore listener cleanup failures.
    }

    try {
      await characteristic?.stopNotifications();
    } catch {
      // Ignore notification shutdown failures.
    }

    try {
      device?.gatt?.disconnect();
    } catch {
      // Ignore disconnect failures.
    }

    notifyHandlerRef.current = null;
    ioCharRef.current = null;
    serviceRef.current = null;
    gattRef.current = null;
  }

  useEffect(() => {
    return () => {
      void cleanup();
    };
    // cleanup intentionally closes the currently selected device on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!device) return undefined;

    const onDisconnect = () => {
      setConnected(false);
      log('sys', 'Device disconnected.');
    };

    device.addEventListener('gattserverdisconnected', onDisconnect);

    return () => {
      device.removeEventListener('gattserverdisconnected', onDisconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device]);

  async function connect(): Promise<void> {
    if (!supported) {
      log('sys', 'Web Bluetooth is not available here. Use HTTPS or localhost in Chrome/Edge.');
      return;
    }

    setBusy(true);

    try {
      const bluetooth = getBluetooth();

      if (!bluetooth) {
        throw new Error('Web Bluetooth is not available in this browser or context.');
      }

      log('sys', 'Requesting NexRing device…');

      const selectedDevice = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          UUID_SERVICE,
          UUID_OTA,
          '0000180a-0000-1000-8000-00805f9b34fb',
          '0000180d-0000-1000-8000-00805f9b34fb',
        ],
      });

      setDevice(selectedDevice);
      setDeviceName(selectedDevice.name || 'Unnamed device');
      setDeviceId(selectedDevice.id || '—');

      if (!selectedDevice.gatt) {
        throw new Error('No GATT server available on this device.');
      }

      log(
        'sys',
        `Selected device: ${selectedDevice.name || 'Unnamed'} (${selectedDevice.id || 'no-id'})`
      );
      log('sys', 'Connecting GATT…');

      const gatt = await selectedDevice.gatt.connect();
      gattRef.current = gatt;

      log('sys', `Connected. Discovering primary service ${UUID_SERVICE}…`);

      const service = await gatt.getPrimaryService(UUID_SERVICE);
      serviceRef.current = service;

      log('sys', `Resolving notify/write characteristic ${UUID_CHAR_66FE}…`);

      const characteristic = await service.getCharacteristic(UUID_CHAR_66FE);
      ioCharRef.current = characteristic;

      const onValue: EventListener = (event) => {
        try {
          const target = event.target as BluetoothRemoteGATTCharacteristic | null;
          const value = target?.value;

          if (!value) return;

          const bytes = dataViewToUint8Array(value);

          setPacketCount((n) => n + 1);

          const hex = bytesToHex(bytes);
          const base64 = bytesToBase64(bytes);

          log('rx', `notify len=${bytes.length} hex=${hex}`);
          log('rx', `notify b64=${base64}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          log('sys', `Notify parse error: ${message}`);
        }
      };

      notifyHandlerRef.current = onValue;
      characteristic.addEventListener('characteristicvaluechanged', onValue);

      log('sys', 'Starting notifications…');
      await characteristic.startNotifications();

      setConnected(true);
      log('sys', 'Connected and notifications enabled on 66FE.');
      log(
        'sys',
        'Note: this ring uses a custom command protocol. Health values will not necessarily appear until valid command packets are written.'
      );
    } catch (err) {
      console.error(err);

      const message = err instanceof Error ? err.message : String(err);
      log('sys', `Connect failed: ${message}`);

      setConnected(false);
      await cleanup().catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(): Promise<void> {
    setBusy(true);

    try {
      await cleanup();
      setConnected(false);
      log('sys', 'Disconnected.');
    } finally {
      setBusy(false);
    }
  }

  async function inspectServices(): Promise<void> {
    if (!gattRef.current || !device?.gatt?.connected) {
      log('sys', 'Not connected.');
      return;
    }

    setBusy(true);

    try {
      const services = await gattRef.current.getPrimaryServices();

      for (const service of services) {
        log('sys', `Service: ${service.uuid}`);

        const characteristics = await service.getCharacteristics();

        for (const characteristic of characteristics) {
          log(
            'sys',
            `  Characteristic: ${characteristic.uuid} props=${JSON.stringify(
              characteristic.properties
            )}`
          );
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log('sys', `Inspect services failed: ${message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main data-p-ui="patient-nexring-page" className="min-w-0 overflow-x-clip mx-auto max-w-5xl space-y-4 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">NexRing</h1>
          <p className="mt-1 text-sm text-slate-500">
            Web Bluetooth console for transport verification only. This is a dev tool,
            not the production integration path.
          </p>
        </div>

        <span
          className={[
            'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium',
            connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700',
          ].join(' ')}
        >
          <span
            className={[
              'h-2 w-2 rounded-full',
              connected ? 'bg-emerald-500' : 'bg-slate-400',
            ].join(' ')}
          />
          {connected ? 'Connected' : 'Not connected'}
        </span>
      </header>

      {!supported ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Web Bluetooth is not available here. Use HTTPS or localhost in Chrome/Edge.
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Device" value={deviceName} />
        <StatCard label="Device ID" value={deviceId} />
        <StatCard label="Packets RX" value={String(packetCount)} />
        <StatCard label="Transport" value={connected ? '1822 / 66FE' : '—'} />
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => void connect()}
          disabled={busy || connected || !supported}
          className="rounded-xl border bg-white px-4 py-2 text-sm shadow-sm hover:bg-slate-50 disabled:opacity-60"
          type="button"
        >
          Connect
        </button>

        <button
          onClick={() => void disconnect()}
          disabled={busy || !connected}
          className="rounded-xl border bg-white px-4 py-2 text-sm shadow-sm hover:bg-slate-50 disabled:opacity-60"
          type="button"
        >
          Disconnect
        </button>

        <button
          onClick={() => void inspectServices()}
          disabled={busy || !connected}
          className="rounded-xl border bg-white px-4 py-2 text-sm shadow-sm hover:bg-slate-50 disabled:opacity-60"
          type="button"
        >
          Inspect services
        </button>
      </div>

      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="mb-2 text-xs font-medium text-slate-500">
          What this page verifies
        </div>
        <ul className="space-y-1 text-sm text-slate-700">
          <li>• browser can discover the ring</li>
          <li>• browser can connect to service 1822</li>
          <li>• browser can subscribe to characteristic 66FE</li>
          <li>• raw notification packets are arriving</li>
        </ul>
      </section>

      <section className="rounded-2xl border bg-white p-3 shadow-sm">
        <div className="mb-2 text-xs font-medium text-slate-500">Logs</div>
        <div className="h-[28rem] overflow-auto whitespace-pre-wrap rounded-xl border bg-slate-50 p-3 text-sm text-slate-800">
          {logs.length === 0
            ? 'No data yet.'
            : logs
                .map(
                  (row) =>
                    `[${nowStamp(row.ts)}] [${row.dir.toUpperCase()}] ${row.text}`
                )
                .join('\n')}
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 break-all text-sm font-semibold text-slate-900">
        {value || '—'}
      </div>
    </div>
  );
}