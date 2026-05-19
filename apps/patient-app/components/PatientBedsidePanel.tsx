// apps/patient-app/components/PatientBedsidePanel.tsx
'use client';

import { useMemo, useState } from 'react';
import useVitalsSSE from './useVitalsSSE';
import MiniLineCard from '@/components/charts/MiniLineCard';
import BpChart, { type BpPoint } from '@/components/charts/BpChart';
import MeterDonut from '@/components/charts/MeterDonut';

function HeaderSparkline({ values }: { values: number[] }) {
  const clean = values.filter((value) => Number.isFinite(value)).slice(-64);

  if (clean.length < 2) {
    return <div className="h-7 rounded bg-slate-100" aria-hidden />;
  }

  const width = 128;
  const height = 28;
  const pad = 2;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1;

  const points = clean
    .map((value, index) => {
      const x = pad + (index * (width - pad * 2)) / Math.max(clean.length - 1, 1);
      const y = height - pad - ((value - min) * (height - pad * 2)) / span;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Live heart-rate trend"
      className="block"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-cyan-500"
      />
    </svg>
  );
}

export default function PatientBedsidePanel({ roomId, defaultOpen = true }: { roomId: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const { buffer, samples } = useVitalsSSE(roomId, 240);

  const labels = useMemo(
    () => buffer.map(b => new Date(b.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })),
    [buffer]
  );
  const arr = (pick: (b: any) => number | undefined, fallback = NaN) =>
    buffer.map((item) => {
      const value = pick(item);
      return Number.isFinite(value) ? Number(value) : fallback;
    });

  const hr = arr(b => b.hr);
  const spo2 = arr(b => b.spo2);
  const rr = arr(b => b.rr);
  const temp = arr(b => b.tempC ?? b.temp);
  const glucose = arr(b => b.glucose);
  const bpSeries: BpPoint[] = useMemo(
    () =>
      buffer.flatMap((b) => {
        const bp = b.bp;

        if (bp?.sys == null || bp?.dia == null) {
          return [];
        }

        return [
          {
            ts: b.ts,
            sys: Number(bp.sys),
            dia: Number(bp.dia),
          },
        ];
      }),
    [buffer],
  );

  const sparkValues = useMemo(
    () => samples.filter((s) => s.type === 'hr').slice(-64).map((s) => s.value),
    [samples],
  );

  return (
    <section className="rounded-2xl border bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold">Bedside Monitor</div>
          <div className="w-32">
            <HeaderSparkline values={sparkValues} />
          </div>
        </div>
        <button onClick={() => setOpen(v => !v)} className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50">
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {open && (
        <div className="p-3 space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <MiniLineCard title="HR" unit=" bpm" labels={labels} values={hr} color="#22d3ee" min={40} max={160} />
            <MiniLineCard title="SpO₂" unit=" %" labels={labels} values={spo2} color="#60a5fa" min={88} max={100} />
            <MiniLineCard title="RR" unit=" /min" labels={labels} values={rr} color="#a78bfa" min={6} max={32} />
            <MiniLineCard title="Temp" unit=" °C" labels={labels} values={temp} color="#67e8f9" min={35} max={40} />
          </div>

          <div className="rounded-2xl overflow-hidden">
            <BpChart data={bpSeries} />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <MeterDonut label="Steps" value={0} max={10000} color="#84cc16" />
            <MeterDonut label="Calories" value={0} max={3000} color="#f59e0b" />
            <MeterDonut label="Distance" value={0} max={10} unit="km" color="#06b6d4" />
          </div>

          <div className="grid gap-3">
            <MiniLineCard title="Glucose" unit=" mg/dL" labels={labels} values={glucose} color="#34d399" min={60} max={190} />
          </div>
        </div>
      )}
    </section>
  );
}
