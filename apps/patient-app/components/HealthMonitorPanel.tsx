// components/HealthMonitorPanel.tsx
'use client';

import React, { useMemo } from 'react';
import MiniLineCard from '@/components/charts/MiniLineCard';
import BpChart, { type BpPoint } from '@/components/charts/BpChart';

type AnyVitals =
  | Array<{ ts: number; type: string; value: number; unit?: string }>
  | { latest: any; buffer: Array<{ ts: number; hr?: number; spo2?: number; rr?: number; tempC?: number; bp?: { sys?: number; dia?: number }; glucose?: number }>; samples?: Array<{ t: number; type: string; value: number; unit?: string }> };

function toSeries(vitals: AnyVitals) {
  // Accept either: per-metric samples OR grouped buffer
  if (Array.isArray(vitals)) {
    // samples -> group by ts
    const map = new Map<number, any>();
    for (const s of vitals) {
      const ts = Number(s.ts ?? Date.now());
      const row = map.get(ts) || { ts };
      const t = (s.type || '').toLowerCase();
      if (t === 'hr') row.hr = s.value;
      if (t === 'spo2') row.spo2 = s.value;
      if (t === 'rr') row.rr = s.value;
      if (t === 'temp' || t === 'tempc' || t === 'temp_c') row.tempC = s.value;
      if (t === 'glucose') row.glucose = s.value;
      if (t === 'bp_sys') row.bp = { ...(row.bp || {}), sys: s.value };
      if (t === 'bp_dia') row.bp = { ...(row.bp || {}), dia: s.value };
      map.set(ts, row);
    }
    return [...map.values()].sort((a, b) => a.ts - b.ts);
  }

  // object with buffer (grouped)
  const buf = (vitals?.buffer ?? []) as Array<any>;
  return Array.isArray(buf) ? buf : [];
}

export default function HealthMonitorPanel({ vitals }: { vitals: AnyVitals }) {
  const buffer = useMemo(() => toSeries(vitals), [vitals]);

  const labels = useMemo(
    () => buffer.map(b => new Date(b.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })),
    [buffer]
  );
  const arr = (pick: (b: any) => number | undefined, fallback = NaN) =>
    buffer.map(pick).map(v => (Number.isFinite(v!) ? Number(v) : fallback));

  const hr = arr(b => b.hr);
  const spo2 = arr(b => b.spo2);
  const rr = arr(b => b.rr);
  const temp = arr(b => b.tempC);
  const glucose = arr(b => b.glucose);
  const bpSeries: BpPoint[] = useMemo(
    () => buffer
      .filter(b => b.bp?.sys != null && b.bp?.dia != null)
      .map(b => ({ ts: b.ts, sys: Number(b.bp.sys), dia: Number(b.bp.dia) })),
    [buffer]
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-4">
        <MiniLineCard title="HR" unit=" bpm" labels={labels} values={hr} color="#22d3ee" min={40} max={160} />
        <MiniLineCard title="SpO₂" unit=" %" labels={labels} values={spo2} color="#60a5fa" min={88} max={100} />
        <MiniLineCard title="RR" unit=" /min" labels={labels} values={rr} color="#a78bfa" min={6} max={32} />
        <MiniLineCard title="Temp" unit=" °C" labels={labels} values={temp} color="#67e8f9" min={35} max={40} />
      </div>

      <div className="rounded-2xl overflow-hidden">
        <BpChart data={bpSeries} />
      </div>

      <div className="grid gap-3">
        <MiniLineCard title="Glucose" unit=" mg/dL" labels={labels} values={glucose} color="#34d399" min={60} max={190} />
      </div>
    </div>
  );
}
