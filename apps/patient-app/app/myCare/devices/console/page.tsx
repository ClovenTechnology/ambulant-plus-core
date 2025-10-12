'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DEVICE_MAP, DeviceKey } from '@/src/devices/serviceMap';
import { connectBle, subscribe } from '@/src/devices/ble';
import { openInsightStream, pushInsightFrame } from '@/src/lib/insight';

export default function DevicesConsole() {
  const sp = useSearchParams();
  const deviceId = (sp.get('deviceId') as DeviceKey) || 'duecare.stethoscope';
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
      startHeartbeat(); // 👈 kick off keepalive

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
    stopHeartbeat(); // 👈 stop keepalive

    if (spec.transport === 'ble' && conn && spec.commands?.stop) {
      await conn.write?.('ctrl', spec.commands.stop);
    }
  };

  return (
    <main className="p-6 space-y-4">
      {/* ... header + panels unchanged ... */}
    </main>
  );
}
