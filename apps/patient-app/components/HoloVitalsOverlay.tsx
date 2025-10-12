'use client';

import clsx from 'clsx';
import React, { useMemo } from 'react';

type Vital = { t: string; type: string; value: number; unit?: string };
type Device = { id: string; vendor?: string; model?: string; lastSeenAt?: string };

export default function HoloVitalsOverlay({
  visible,
  vitals = [],
  devices = [],
  corner = 'tr',
}: {
  visible?: boolean;
  vitals?: Vital[];
  devices?: Device[];
  corner?: 'tl' | 'tr' | 'bl' | 'br';
}) {
  if (!visible) return null;

  const latest = useMemo(() => {
    const map = new Map<string, Vital>();
    for (const v of vitals) map.set(v.type, v);
    return Array.from(map.values()).sort((a, b) => a.type.localeCompare(b.type)).slice(0, 6);
  }, [vitals]);

  const cornerPos = {
    tl: 'top-3 left-3',
    tr: 'top-3 right-3',
    bl: 'bottom-3 left-3',
    br: 'bottom-3 right-3',
  }[corner];

  function presenceBadge(d: Device) {
    if (!d.lastSeenAt) return <span className="text-gray-400 text-[11px]">⚪ Idle</span>;
    const online = Date.now() - new Date(d.lastSeenAt).getTime() <= 60_000;
    return (
      <span className="text-[11px] font-medium">
        {online ? '🟢 Online' : '⚪ Idle'} · {new Date(d.lastSeenAt).toLocaleTimeString()}
      </span>
    );
  }

  return (
    <div
      className={clsx(
        'pointer-events-none fixed z-40',
        cornerPos,
        'glass neon holo-grid',
        'rounded-xl shadow-lg backdrop-blur bg-white/10 border border-white/20'
      )}
      style={{ minWidth: 260 }}
    >
      <div className="px-3 py-2 flex justify-between items-center">
        <div className="text-[11px] uppercase tracking-wider text-white/80">Vitals HUD</div>
        <div className="text-[10px] text-white/60">overlay · synced</div>
      </div>

      {/* Device badges row */}
      {devices.length > 0 && (
        <div className="px-3 flex flex-wrap gap-2">
          {devices.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-2 px-2 py-1 rounded bg-white/10 text-white text-xs border border-white/20"
            >
              <span>{d.vendor || '—'} {d.model || ''}</span>
              {presenceBadge(d)}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 p-3">
        {latest.length === 0 ? (
          <div className="col-span-2 text-xs text-white/70">Waiting for live vitals…</div>
        ) : (
          latest.map((v, i) => (
            <div
              key={i}
              className="rounded-lg px-2 py-1.5 bg-white/8 ring-1 ring-white/15 flex flex-col gap-0.5"
            >
              <div className="text-[10px] text-white/70 leading-none">{v.type}</div>
              <div className="text-white font-semibold text-sm leading-tight">
                {v.value}
                {v.unit ? <span className="text-white/70 text-[10px] ml-1">{v.unit}</span> : null}
              </div>
              <div className="text-[10px] text-white/50 leading-none">
                {new Date(v.t).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
