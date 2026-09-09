'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Capacitor } from '@capacitor/core';
import {
  NexRing,
  type NexRingScanResult,
} from '@/hooks/nexring-plugin';

type DiagnosticRow = {
  ts: number;
  event: string;
  payload: unknown;
};

function stamp(ts: number) {
  return new Date(ts).toLocaleTimeString();
}

export default function NexRingNativeDiagnosticPage() {
  const isNativeAndroid = useMemo(
    () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android',
    [],
  );
  const pluginAvailable = useMemo(
    () => Capacitor.isPluginAvailable('NexRing'),
    [],
  );

  const [rows, setRows] = useState<DiagnosticRow[]>([]);
  const [devices, setDevices] = useState<NexRingScanResult[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState('');
  const [lastError, setLastError] = useState('');
  const handlesRef = useRef<Array<{ remove: () => Promise<void> | void }>>([]);

  function append(event: string, payload: unknown) {
    setRows((prev) => {
      const next = [...prev, { ts: Date.now(), event, payload }];
      return next.length <= 500 ? next : next.slice(next.length - 500);
    });
  }

  async function call(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setLastError('');
    append(`command:${label}:start`, {});
    try {
      const result = await fn();
      append(`command:${label}:ok`, result ?? {});
      return result;
    } catch (error: any) {
      const message = error?.message || String(error);
      setLastError(message);
      append(`command:${label}:error`, { message });
      return null;
    } finally {
      setBusy('');
    }
  }

  useEffect(() => {
    let cancelled = false;
    const localHandles: Array<{ remove: () => Promise<void> | void }> = [];

    async function attach() {
      append('platform', {
        platform: Capacitor.getPlatform(),
        isNative: Capacitor.isNativePlatform(),
        pluginAvailable: Capacitor.isPluginAvailable('NexRing'),
      });

      if (!isNativeAndroid || !pluginAvailable) return;

      const plugin: any = NexRing;
      for (const eventName of [
        'diagnostic',
        'scanResult',
        'connectionState',
        'ready',
        'mtu',
        'notify',
        'error',
      ]) {
        try {
          const handle = await plugin.addListener(eventName, (payload: any) => {
            append(eventName, payload);

            if (eventName === 'scanResult') {
              const device = payload as NexRingScanResult;
              setDevices((prev) => {
                const id = device.id || device.mac || '';
                const filtered = prev.filter((item) => (item.id || item.mac || '') !== id);
                return [...filtered, device].sort(
                  (a, b) => (b.rssi ?? -999) - (a.rssi ?? -999),
                );
              });
              setSelectedId((prev) => prev || device.id || device.mac || '');
            }
          });

          if (cancelled) {
            await handle.remove();
          } else {
            localHandles.push(handle);
          }
        } catch (error: any) {
          append(`listener:${eventName}:error`, {
            message: error?.message || String(error),
          });
        }
      }

      handlesRef.current = localHandles;
    }

    void attach();

    return () => {
      cancelled = true;
      handlesRef.current = [];
      localHandles.forEach((handle) => {
        void handle.remove();
      });
    };
  }, [isNativeAndroid, pluginAvailable]);

  const selected = devices.find((d) => (d.id || d.mac || '') === selectedId) ?? null;
  const controlsDisabled = !isNativeAndroid || !pluginAvailable || !!busy;

  return (
    <main className="min-h-screen min-w-0 overflow-x-clip bg-slate-950 px-3 py-4 text-slate-100 sm:px-4 md:px-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                Ambulant+ internal device test
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
                NexRing native transport
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Direct Capacitor-plugin diagnostics for Android BLE scan, GATT,
                service discovery, CCC notifications, MTU, raw notify packets,
                writes and disconnect behavior.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/devices/native-test/nexring/web"
                className="inline-flex min-h-[44px] items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white"
              >
                Web BLE diagnostic
              </Link>
              <Link
                href="/myCare/devices/nexring"
                className="inline-flex min-h-[44px] items-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950"
              >
                Patient NexRing
              </Link>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs text-slate-400">Platform</div>
              <div className="mt-1 font-semibold">{Capacitor.getPlatform()}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs text-slate-400">Native Android</div>
              <div className="mt-1 font-semibold">{isNativeAndroid ? 'Yes' : 'No'}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs text-slate-400">NexRing plugin</div>
              <div className="mt-1 font-semibold">{pluginAvailable ? 'Available' : 'Unavailable'}</div>
            </div>
          </div>
        </section>

        {!isNativeAndroid || !pluginAvailable ? (
          <section className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
            Native controls are intentionally disabled here. Open this route inside
            the installed Ambulant+ Android app. Browser validation remains available
            from the Web BLE diagnostic link above.
          </section>
        ) : null}

        {lastError ? (
          <section className="rounded-3xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            {lastError}
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <h2 className="text-lg font-semibold">Controls</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  disabled={controlsDisabled}
                  onClick={() => void call('permissions', () => NexRing.askPermissions())}
                  className="min-h-[44px] rounded-2xl bg-cyan-300 px-4 py-2 font-semibold text-slate-950 disabled:opacity-40"
                >
                  Permissions
                </button>
                <button
                  disabled={controlsDisabled}
                  onClick={() => {
                    setDevices([]);
                    setSelectedId('');
                    void call('scan', () => NexRing.startScan());
                  }}
                  className="min-h-[44px] rounded-2xl border border-white/10 px-4 py-2 font-semibold disabled:opacity-40"
                >
                  Start scan
                </button>
                <button
                  disabled={controlsDisabled}
                  onClick={() => void call('stopScan', () => NexRing.stopScan())}
                  className="min-h-[44px] rounded-2xl border border-white/10 px-4 py-2 font-semibold disabled:opacity-40"
                >
                  Stop scan
                </button>
                <button
                  disabled={controlsDisabled || !selected}
                  onClick={() =>
                    void call('connect', () =>
                      NexRing.connect({
                        id: selected?.id || selected?.mac,
                        mac: selected?.mac || selected?.id,
                        name: selected?.name,
                      }),
                    )
                  }
                  className="min-h-[44px] rounded-2xl border border-white/10 px-4 py-2 font-semibold disabled:opacity-40"
                >
                  Connect selected
                </button>
                <button
                  disabled={controlsDisabled}
                  onClick={() => void call('mtu203', () => NexRing.requestMtu?.({ mtu: 203 }) ?? Promise.resolve())}
                  className="min-h-[44px] rounded-2xl border border-white/10 px-4 py-2 font-semibold disabled:opacity-40"
                >
                  Request MTU 203
                </button>
                <button
                  disabled={controlsDisabled}
                  onClick={() => void call('disconnect', () => NexRing.disconnect())}
                  className="min-h-[44px] rounded-2xl border border-white/10 px-4 py-2 font-semibold disabled:opacity-40"
                >
                  Disconnect
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <h2 className="text-lg font-semibold">Discovered rings</h2>
              <div className="mt-3 max-h-72 overflow-auto rounded-2xl border border-white/10">
                {devices.length === 0 ? (
                  <div className="p-4 text-sm text-slate-400">No native scan results yet.</div>
                ) : (
                  devices.map((device) => {
                    const id = device.id || device.mac || '';
                    const active = id === selectedId;
                    return (
                      <button
                        key={id || `${device.name}-${device.rssi}`}
                        onClick={() => setSelectedId(id)}
                        className={`flex min-h-[56px] w-full items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-left last:border-b-0 ${
                          active ? 'bg-cyan-400/10' : 'bg-transparent'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">
                            {device.name || 'Unnamed ring'}
                          </span>
                          <span className="block truncate text-xs text-slate-400">{id}</span>
                        </span>
                        <span className="shrink-0 text-xs text-slate-400">
                          {device.rssi ?? '—'} dBm
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </section>
          </div>

          <section className="min-w-0 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Structured native evidence</h2>
              <button
                type="button"
                onClick={() => setRows([])}
                className="min-h-[40px] rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold"
              >
                Clear
              </button>
            </div>
            <div className="mt-4 max-h-[70vh] overflow-auto rounded-2xl bg-black/30 p-3 font-mono text-[11px] leading-5 text-slate-200 sm:text-xs">
              {rows.length === 0 ? (
                <div className="font-sans text-sm text-slate-400">No events yet.</div>
              ) : (
                rows
                  .slice()
                  .reverse()
                  .map((row, index) => (
                    <div key={`${row.ts}-${index}`} className="border-b border-white/5 py-2 last:border-b-0">
                      <div className="text-cyan-300">
                        [{stamp(row.ts)}] {row.event}
                      </div>
                      <pre className="mt-1 whitespace-pre-wrap break-words text-slate-300">
                        {JSON.stringify(row.payload, null, 2)}
                      </pre>
                    </div>
                  ))
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
