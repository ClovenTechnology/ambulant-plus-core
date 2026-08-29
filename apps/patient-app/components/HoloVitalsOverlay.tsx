'use client';

import React, { useMemo } from 'react';

type Vital = { t: string; type: string; value: number; unit?: string };
type Device = { id: string; vendor?: string; model?: string; lastSeenAt?: string };

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

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
  const latest = useMemo(() => {
    const map = new Map<string, Vital>();
    for (const v of vitals) map.set(v.type, v);
    return Array.from(map.values())
      .sort((a, b) => a.type.localeCompare(b.type))
      .slice(0, 6);
  }, [vitals]);

  if (!visible) return null;

  const cornerPos = {
    tl: 'top-14 left-3',
    tr: 'top-14 right-3',
    bl: 'bottom-20 left-3',
    br: 'bottom-20 right-3',
  }[corner];

  function presenceBadge(d: Device) {
    if (!d.lastSeenAt) {
      return <span className="text-[10px] font-medium text-slate-300">Idle</span>;
    }

    const online = Date.now() - new Date(d.lastSeenAt).getTime() <= 60_000;
    return (
      <span className={cx('text-[10px] font-semibold', online ? 'text-emerald-300' : 'text-slate-300')}>
        {online ? 'Online' : 'Idle'}
      </span>
    );
  }

  return (
    <div
      className={cx(
        'pointer-events-none absolute z-20 w-[min(78%,340px)] overflow-hidden',
        cornerPos,
        'rounded-2xl border border-white/70 bg-slate-950/90 shadow-xl backdrop-blur-md',
      )}
      aria-label="Live vitals overlay"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white">Live vitals</div>
          <div className="text-[10px] text-slate-300">Optional consultation overlay</div>
        </div>
        <div className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-medium text-slate-200">
          {latest.length > 0 ? `${latest.length} reading${latest.length === 1 ? '' : 's'}` : 'Waiting'}
        </div>
      </div>

      {devices.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2">
          {devices.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[10px] text-slate-100"
            >
              <span className="max-w-[140px] truncate">{d.vendor || 'Device'} {d.model || ''}</span>
              {presenceBadge(d)}
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-1.5 p-2">
        {latest.length === 0 ? (
          <div className="col-span-2 rounded-xl bg-white/95 px-3 py-2 text-xs font-medium text-slate-700">
            Waiting for live readings…
          </div>
        ) : (
          latest.map((v, i) => (
            <div key={`${v.type}-${i}`} className="rounded-xl bg-white/95 px-2.5 py-2 shadow-sm">
              <div className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{v.type}</div>
              <div className="mt-0.5 text-base font-bold leading-tight text-slate-950">
                {v.value}
                {v.unit ? <span className="ml-1 text-[10px] font-semibold text-slate-500">{v.unit}</span> : null}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400">{new Date(v.t).toLocaleTimeString()}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
