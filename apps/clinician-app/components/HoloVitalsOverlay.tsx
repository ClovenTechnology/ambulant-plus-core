'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';
import useVitalsSSE from '@/components/useVitalsSSE';
import {
  DEVICE_REFRESH_INTERVAL,
  DEVICE_ONLINE_THRESHOLD,
} from '@/lib/deviceConstants';

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ?? '';

type DeviceRow = {
  id: string;
  deviceId: string;
  vendor: string | null;
  category: string | null;
  model: string | null;
  lastSeenAt?: string;
  roomId?: string | null;
};

type Props = { roomId?: string | null; visible?: boolean };

export default function HoloVitalsOverlay({ roomId, visible }: Props) {
  const vitals = useVitalsSSE(roomId);
  const [devices, setDevices] = useState<DeviceRow[]>([]);

  const fetchDevices = async () => {
    if (!roomId) return;
    try {
      const qs = new URLSearchParams();
      qs.set('room_id', roomId);
      const r = await fetch(`${GATEWAY}/api/devices/list?${qs}`, {
        cache: 'no-store',
        headers: { 'x-uid': 'clinician-local-001', 'x-role': 'clinician' },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setDevices(j.items || []);
    } catch (err) {
      console.warn('[HoloVitalsOverlay] fetch devices failed', err);
    }
  };

  useEffect(() => {
    if (!roomId) return;
    fetchDevices();
    const t = setInterval(fetchDevices, DEVICE_REFRESH_INTERVAL);
    return () => clearInterval(t);
  }, [roomId]);

  if (!visible) return null;

  const last = (vitals ?? []).slice(-5).reverse();

  function presenceBadge(d: DeviceRow) {
    if (!d.lastSeenAt) {
      return <span className="text-gray-400 text-[11px]">⚪ Idle</span>;
    }
    const online =
      Date.now() - new Date(d.lastSeenAt).getTime() <= DEVICE_ONLINE_THRESHOLD;
    const ts = new Date(d.lastSeenAt).toLocaleTimeString();
    return (
      <span className="text-[11px] font-medium">
        {online ? '🟢 Online' : '⚪ Idle'} · {ts}
      </span>
    );
  }

  return (
    <div
      className={clsx(
        'pointer-events-none',
        'fixed inset-x-0 top-0 z-20',
        'mx-auto mt-2 w-[min(92vw,640px)]',
        'rounded-2xl p-3',
        'glass neon holo-grid backdrop-blur-md ring-1 ring-white/15'
      )}
      aria-hidden
    >
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-white/80">
          Vitals HUD
        </div>
        <div className="text-[10px] text-white/60">overlay · synced</div>
      </div>

      {devices.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {devices.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-2 px-2 py-1 rounded bg-white/10 text-white text-xs border border-white/20"
            >
              <span>
                {d.vendor || '—'} {d.model || ''}
              </span>
              {presenceBadge(d)}
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
        {last.length === 0 ? (
          <div className="col-span-2 sm:col-span-5 text-xs text-white/70">
            No live vitals yet…
          </div>
        ) : (
          last.map((v, i) => (
            <div
              key={i}
              className="rounded-xl bg-white/8 border border-white/10 px-2 py-1.5"
            >
              <div className="text-[10px] text-white/60">{v.type}</div>
              <div className="text-sm font-semibold text-white">
                {v.value}
                {v.unit ? ` ${v.unit}` : ''}
              </div>
              <div className="text-[10px] text-white/50">
                {new Date(v.t).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
