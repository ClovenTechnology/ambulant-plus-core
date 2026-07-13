'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { NativeHealthMonitor as HealthMonitor, type NativeHealthMonitorPlugin as HealthMonitorNative } from '../../../src/devices/nativeHealthMonitorPlugin';

type NativeEvent = {
  id: number;
  at: string;
  event: string;
  payload: unknown;
};

type DiscoveredDevice = {
  key: string;
  name?: string;
  mac?: string;
  raw: unknown;
};

const EVENT_NAMES = [
  'scanResult',
  'device',
  'devices',
  'status',
  'telemetry',
  'measurement',
  'measure',
  'blood_pressure',
  'bloodPressure',
  'bp',
  'spo2',
  'spO2',
  'temperature',
  'bodyTemperature',
  'ecg',
  'battery',
  'error',
];

const MEASUREMENT_TYPES = [
  { key: 'bp', label: 'Blood pressure' },
  { key: 'spo2', label: 'SpO₂' },
  { key: 'temperature', label: 'Temperature' },
  { key: 'ecg', label: 'ECG' },
  { key: 'all', label: 'All / SDK default' },
];

function nowStamp() {
  return new Date().toLocaleTimeString();
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function unwrapPayload(value: unknown): any {
  const root: any = value;
  return root?.data ?? root?.payload ?? root;
}

function extractDevices(eventName: string, payload: unknown): DiscoveredDevice[] {
  const root = unwrapPayload(payload);
  const candidates: unknown[] = [];

  function collect(value: unknown) {
    if (!value || typeof value !== 'object') return;

    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }

    const obj: any = value;
    const mac =
      obj.mac ??
      obj.address ??
      obj.deviceAddress ??
      obj.bleAddress ??
      obj.id ??
      obj.deviceId;

    const name =
      obj.name ??
      obj.deviceName ??
      obj.localName ??
      obj.bluetoothName ??
      obj.label;

    if (mac || name || eventName.toLowerCase().includes('scan')) {
      candidates.push(obj);
    }

    for (const key of ['device', 'devices', 'data', 'payload', 'result', 'results']) {
      if (obj[key]) collect(obj[key]);
    }
  }

  collect(root);

  return candidates.map((raw, index) => {
    const obj: any = raw;
    const mac =
      obj?.mac ??
      obj?.address ??
      obj?.deviceAddress ??
      obj?.bleAddress ??
      obj?.id ??
      obj?.deviceId ??
      '';

    const name =
      obj?.name ??
      obj?.deviceName ??
      obj?.localName ??
      obj?.bluetoothName ??
      obj?.label ??
      '';

    return {
      key: `${mac || name || 'device'}-${index}`,
      mac: String(mac || ''),
      name: String(name || ''),
      raw,
    };
  });
}

export default function NativeDeviceTestPage() {
  const [events, setEvents] = useState<NativeEvent[]>([]);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [mac, setMac] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const eventId = useRef(1);

  const isNative = useMemo(() => Capacitor.isNativePlatform(), []);

  function appendEvent(event: string, payload: unknown) {
    const next: NativeEvent = {
      id: eventId.current++,
      at: nowStamp(),
      event,
      payload,
    };

    setEvents((current) => [next, ...current].slice(0, 120));

    const found = extractDevices(event, payload).filter((device) => device.mac || device.name);
    if (found.length > 0) {
      setDevices((current) => {
        const map = new Map<string, DiscoveredDevice>();
        [...found, ...current].forEach((device) => {
          const key = device.mac || device.name || device.key;
          if (!map.has(key)) map.set(key, device);
        });
        return Array.from(map.values()).slice(0, 30);
      });
    }
  }

  async function callNative(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setLastError(null);
    appendEvent(`command:${label}:start`, {});
    try {
      const result = await fn();
      appendEvent(`command:${label}:ok`, result ?? {});
    } catch (error: any) {
      const message = error?.message || String(error);
      setLastError(message);
      appendEvent(`command:${label}:error`, { message, error });
    } finally {
      setBusy(null);
    }
  }

  async function startMeasurement(type: string) {
    const payload = type === 'all' ? {} : { type };

    await callNative(`start:${type}`, async () => {
      const plugin: any = HealthMonitor;
      if (typeof plugin.startMeasurement === 'function') {
        return plugin.startMeasurement(payload);
      }
      return plugin.startMeasurements(payload);
    });
  }

  useEffect(() => {
    let cancelled = false;
    const handles: PluginListenerHandle[] = [];

    async function attachListeners() {
      if (!isNative) {
        appendEvent('platform', {
          isNative: false,
          note: 'Native plugin calls only work inside the installed Android app.',
        });
        return;
      }

      appendEvent('platform', {
        isNative: true,
        platform: Capacitor.getPlatform(),
      });

      for (const eventName of EVENT_NAMES) {
        try {
          const handle = await HealthMonitor.addListener(eventName, (payload) => {
            appendEvent(eventName, payload);
          });

          if (!cancelled) {
            handles.push(handle);
          } else {
            void handle.remove();
          }
        } catch (error: any) {
          appendEvent(`listener:${eventName}:error`, {
            message: error?.message || String(error),
          });
        }
      }
    }

    void attachListeners();

    return () => {
      cancelled = true;
      handles.forEach((handle) => {
        void handle.remove();
      });
    };
  }, [isNative]);

  return (
    <main data-p-ui="patient-devices-native-test-page" className="min-w-0 overflow-x-clip min-h-screen bg-slate-950 px-4 py-6 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
                Ambulant+ Internal Device Test
              </p>
              <h1 className="mt-2 text-3xl font-bold text-white">
                Health Monitor Native SDK Console
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Use this page inside the installed Android app to test permissions,
                scan, connection, and raw measurement events before we wire final
                patient-facing persistence or live Televisit streaming.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm">
              <div className="text-slate-400">Platform</div>
              <div className={isNative ? 'font-semibold text-emerald-300' : 'font-semibold text-amber-300'}>
                {isNative ? `Native Android/iOS: ${Capacitor.getPlatform()}` : 'Web preview only'}
              </div>
            </div>
          </div>
        </section>

        {!isNative ? (
          <section className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-5 text-amber-100">
            This console is visible on web for layout review only. Native SDK controls are disabled here because the HealthMonitor bridge only exists inside the installed Android app. Build/sync the app, install the debug APK, then open this route in the Android WebView.
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-xl font-semibold">Controls</h2>

            <div className="mt-4 grid gap-3">
              <button
                className="rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
                disabled={!!busy || !isNative}
                onClick={() => callNative('permissions', () => HealthMonitor.askPermissions())}
              >
                Ask permissions
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  className="rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
                  disabled={!!busy || !isNative}
                  onClick={() => callNative('startScan', () => HealthMonitor.startScan())}
                >
                  Start scan
                </button>
                <button
                  className="rounded-2xl bg-slate-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
                  disabled={!!busy || !isNative}
                  onClick={() => callNative('stopScan', () => HealthMonitor.stopScan())}
                >
                  Stop scan
                </button>
              </div>

              <label className="mt-3 text-sm font-medium text-slate-300">
                Device MAC / address
                <input
                  value={mac}
                  onChange={(event) => setMac(event.target.value)}
                  placeholder="Tap a discovered device or paste MAC"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300"
                />
              </label>

              <button
                className="rounded-2xl bg-violet-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
                disabled={!!busy || !isNative || !mac.trim()}
                onClick={() => callNative('connect', () => HealthMonitor.connect({ mac: mac.trim() }))}
              >
                Connect
              </button>

              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900 p-4">
                <h3 className="font-semibold">Start measurement</h3>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {MEASUREMENT_TYPES.map((type) => (
                    <button
                      key={type.key}
                      className="rounded-xl bg-white/10 px-3 py-2 text-left text-sm font-medium text-white hover:bg-white/20 disabled:opacity-50"
                      disabled={!!busy || !isNative}
                      onClick={() => startMeasurement(type.key)}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="rounded-2xl bg-rose-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
                disabled={!!busy || !isNative}
                onClick={() => callNative('stopMeasurements', () => HealthMonitor.stopMeasurements())}
              >
                Stop measurements
              </button>

              {busy ? (
                <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-3 text-sm text-cyan-100">
                  Running: {busy}
                </div>
              ) : null}

              {lastError ? (
                <div className="rounded-2xl border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100">
                  {lastError}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Discovered devices</h2>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
                {devices.length}
              </span>
            </div>

            <div className="mt-4 max-h-[360px] space-y-3 overflow-auto pr-1">
              {devices.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-400">
                  No devices discovered yet. Press “Start scan” and watch for SDK events.
                </div>
              ) : (
                devices.map((device) => (
                  <button
                    key={device.key}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 p-4 text-left hover:border-cyan-300/60"
                    onClick={() => {
                      if (device.mac) setMac(device.mac);
                    }}
                  >
                    <div className="font-semibold text-white">
                      {device.name || 'Unnamed device'}
                    </div>
                    <div className="mt-1 text-sm text-cyan-200">
                      {device.mac || 'No MAC/address in event'}
                    </div>
                    <pre className="mt-3 max-h-28 overflow-auto rounded-xl bg-black/30 p-3 text-xs text-slate-300">
                      {safeJson(device.raw)}
                    </pre>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Raw native event log</h2>
              <p className="mt-1 text-sm text-slate-400">
                Keep this output for manufacturer-app comparison and SDK payload mapping.
              </p>
            </div>
            <button
              className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
              onClick={() => setEvents([])}
            >
              Clear log
            </button>
          </div>

          <div className="mt-4 max-h-[560px] space-y-3 overflow-auto pr-1">
            {events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-400">
                No events yet.
              </div>
            ) : (
              events.map((event) => (
                <article key={event.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-cyan-200">{event.event}</div>
                    <div className="text-xs text-slate-500">{event.at}</div>
                  </div>
                  <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-black/40 p-3 text-xs leading-5 text-slate-200">
                    {safeJson(event.payload)}
                  </pre>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
