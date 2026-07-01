'use client';

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DEVICE_MAP, DeviceKey } from '@/src/devices/serviceMap';
import { connectBle, subscribe } from '@/src/devices/ble';
import { openInsightStream, pushInsightFrame } from '@/src/lib/insight';

function DevicesConsoleContent() {
  const sp = useSearchParams();

  const qs = useMemo(
    () => new URLSearchParams(sp?.toString() ?? ''),
    [sp],
  );

  const deviceId = (qs.get('deviceId') as DeviceKey) || 'duecare.stethoscope';
  const spec = DEVICE_MAP[deviceId];
  const sessionId = useMemo(() => `devsess-${Date.now().toString(36)}`, []);
  const [conn, setConn] = useState<any>(null);
  const [labels, setLabels] = useState<any[]>([]);
  const unsubRef = useRef<(() => void) | null>(null);
  const hbTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Live AI annotations
    const close = openInsightStream(sessionId, (msg) =>
      setLabels((a) => [msg, ...a].slice(0, 50))
    );
    return () => close();
  }, [sessionId]);

  // ---- Heartbeat ----
  const startHeartbeat = () => {
    stopHeartbeat();
    hbTimer.current = setInterval(async () => {
      try {
        await fetch('/api/devices/seen', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ deviceId }),
        });
      } catch (e) {
        console.warn('heartbeat failed', e);
      }
    }, 30_000);
  };
  const stopHeartbeat = () => {
    if (hbTimer.current) clearInterval(hbTimer.current);
    hbTimer.current = null;
  };

  // ---- ACTIONS (per panel) ----
  const pair = async () => {
    if (spec.transport === 'usb') {
      alert('USB device selected in the video panel (choose camera source).');
      return;
    }
    const c = await connectBle(deviceId);
    setConn(c);
  };

  const startStream = async () => {
    if (!spec) return;
    if (spec.transport === 'ble' && conn) {
      startHeartbeat(); // Start keepalive

      if (spec.console.panels.includes('pcm') && spec.characteristics?.pcm_stream) {
        await conn.write?.('ctrl', spec.commands?.start ?? new Uint8Array([1]));
        unsubRef.current?.();
        unsubRef.current = await subscribe(conn, 'pcm_stream', async (dv) => {
          await pushInsightFrame(sessionId, 'pcm', { bytes: Array.from(new Uint8Array(dv.buffer)) });
        });
      }
      if (spec.console.panels.includes('ecg') && spec.characteristics?.ecg_wave) {
        unsubRef.current?.();
        unsubRef.current = await subscribe(conn, 'ecg_wave', async (dv) => {
          const arr = new Int16Array(dv.buffer.slice(0));
          await pushInsightFrame(sessionId, 'ecg', { samples: Array.from(arr) });
        });
      }
      if (spec.console.panels.includes('ppg') && spec.characteristics?.ppg_wave) {
        unsubRef.current?.();
        unsubRef.current = await subscribe(conn, 'ppg_wave', async (dv) => {
          const arr = new Uint16Array(dv.buffer.slice(0));
          await pushInsightFrame(sessionId, 'ppg', { samples: Array.from(arr) });
        });
      }
      if (spec.console.panels.includes('vitals')) {
        if (spec.characteristics?.bp_start && spec.commands?.bp_start) {
          await conn.write?.('bp_start', spec.commands.bp_start);
        }
      }
    }
  };

  const stopStream = async () => {
    try {
      unsubRef.current?.();
    } catch {}
    unsubRef.current = null;
    stopHeartbeat(); // Stop keepalive

    if (spec.transport === 'ble' && conn && spec.commands?.stop) {
      await conn.write?.('ctrl', spec.commands.stop);
    }
  };

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Generic device console</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-950">Device console</h1>
        <p className="mt-2 text-sm text-slate-600">
          This fallback console is reserved for devices without a dedicated patient workflow.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="/myCare/devices/health-monitor" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Health Monitor</a>
          <a href="/myCare/devices/stethoscope" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Stethoscope</a>
          <a href="/myCare/devices/otoscope" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">HD Otoscope</a>
          <a href="/myCare/devices/nexring" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">NexRing</a>
        </div>
      </section>
    </main>
  );
}

export default function DevicesConsole() {
  return (
    <Suspense fallback={null}>
      <DevicesConsoleContent />
    </Suspense>
  );
}

