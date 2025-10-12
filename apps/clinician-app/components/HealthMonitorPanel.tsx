// apps/clinician-app/components/HealthMonitorPanel.tsx
'use client';

import React, { useMemo } from 'react';
import useVitalsSSE from './useVitalsSSE';

type Props = {
  roomId?: string | null;
  title?: string;
  maxPoints?: number;
  className?: string;
};

type Sample = { t: string | number | Date; type: string; value: number; unit?: string };

function Sparkline({ data, w = 160, h = 36, pad = 2 }: { data: number[]; w?: number; h?: number; pad?: number }) {
  const path = useMemo(() => {
    if (!data.length) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const dx = (w - pad * 2) / Math.max(1, data.length - 1);
    return data
      .map((v, i) => {
        const x = pad + i * dx;
        const y = pad + (1 - (v - min) / span) * (h - pad * 2);
        return `${i ? 'L' : 'M'}${x},${y}`;
      })
      .join(' ');
  }, [data, w, h, pad]);

  return (
    <svg width={w} height={h} className="block">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function HealthMonitorPanel({ roomId, title = 'Health Monitor', maxPoints = 50, className = '' }: Props) {
  const vitals = useVitalsSSE(roomId || undefined) as Sample[] | undefined;

  const last = useMemo(() => {
    const get = (k: string) =>
      [...(vitals || [])].reverse().find((s) => s.type.toLowerCase() === k);
    return {
      hr: get('hr'),
      spo2: get('spo2'),
      rr: get('rr'),
      temp: get('temp') || get('tempc') || get('temp_c'),
      bpSys: get('bp_sys') || get('bpsys'),
      bpDia: get('bp_dia') || get('bpdia'),
    };
  }, [vitals]);

  const hrSeries = useMemo(
    () =>
      (vitals || [])
        .filter((s) => s.type.toLowerCase() === 'hr')
        .slice(-maxPoints)
        .map((s) => Number(s.value))
        .filter((v) => Number.isFinite(v)),
    [vitals, maxPoints]
  );

  const fmt = (x?: number | string) =>
    typeof x === 'number' && Number.isFinite(x) ? String(Math.round(x as number)) : '—';

  const bp = () =>
    last.bpSys?.value != null && last.bpDia?.value != null
      ? `${fmt(Number(last.bpSys.value))} / ${fmt(Number(last.bpDia.value))} mmHg`
      : '—/— mmHg';

  return (
    <section className={`border rounded bg-white ${className}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 rounded-t">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-gray-500">
          {vitals?.length ? new Date(vitals[vitals.length - 1].t as any).toLocaleTimeString() : '—'}
        </div>
      </div>

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Tile label="HR" value={`${fmt(Number(last.hr?.value))} bpm`}>
            <Sparkline data={hrSeries} />
          </Tile>
          <Tile label="SpO₂" value={`${fmt(Number(last.spo2?.value))} %`} />
          <Tile label="RR" value={`${fmt(Number(last.rr?.value))} /min`} />
          <Tile label="Temp" value={`${fmt(Number(last.temp?.value))} °C`} />
          <Tile label="BP" value={bp()} />
        </div>
      </div>
    </section>
  );
}

function Tile({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="rounded border p-3 bg-white">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {children ? <div className="mt-1 text-gray-600"><div className="text-[10px] uppercase tracking-wide">trend</div>{children}</div> : null}
    </div>
  );
}
