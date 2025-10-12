'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import useLiveVitals from '../../../components/charts/useLiveVitals';
import MiniLineCard from '../../../components/charts/MiniLineCard';
import MeterDonut from '../../../components/charts/MeterDonut';
import Sparkline from '../../../components/charts/Sparkline';
import SleepCard from '../../../components/charts/SleepCard';
import { getSleepSeed } from '../../../components/charts/sleepSeed';

const neon = {
  hr: '#00FFC6',
  spo2: '#6EA8FE',
  sys: '#FF6B6B',
  dia: '#F7B267',
  map: '#FFD93D',
  rr: '#9B5DE5',
  temp: '#25CCF7',
  glucose: '#2EE59D',
  steps: '#38bdf8',
  calories: '#fb7185',
  distance: '#22d3ee',
};

const fmt = (x?: number, unit?: string) =>
  typeof x === 'number' && Number.isFinite(x) ? `${x}${unit ? ` ${unit}` : ''}` : '—';

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 text-slate-200 shadow-inner">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold" suppressHydrationWarning>
        {value}
      </div>
      {sub ? <div className="text-xs text-slate-400 mt-1">{sub}</div> : null}
    </div>
  );
}

export default function VitalsDashboard() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data, live, flags } = useLiveVitals(120, 1);

  const sleepData =
    (data as any)?.sleep?.sessions?.length || Array.isArray((data as any)?.sleep?.stages)
      ? (data as any).sleep
      : getSleepSeed(new Date());

  if (!mounted) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 rounded bg-slate-200/20" />
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
        <div className="h-96 rounded-3xl border border-slate-800/40 bg-slate-900/80" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 sci-scanlines">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Live Vitals</h1>
          <p className="text-slate-500">
            Streaming from IoMT{' '}
            {live ? <span className="ml-2 inline-flex items-center text-emerald-600">● live</span> : <span className="ml-2 text-rose-600">● offline</span>}
          </p>
        </div>
      </motion.div>

      {/* quick-glance stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <Stat label="HR" value={fmt(data.latest.hr, 'bpm')} />
        <Stat label="SpO₂" value={fmt(data.latest.spo2, '%')} />
        <Stat label="SYS" value={fmt(data.latest.sys)} sub="mmHg" />
        <Stat label="DIA" value={fmt(data.latest.dia)} sub="mmHg" />
        <Stat label="MAP" value={fmt(data.latest.map)} sub="mmHg" />
        <Stat label="RR" value={fmt(data.latest.rr, 'rpm')} />
        <Stat label="Temp" value={fmt(data.latest.temp, '°C')} />
        <Stat label="Glucose" value={fmt(data.latest.glucose, 'mg/dL')} />
      </div>

      {/* bedside monitor */}
      <BedsideMonitor
        labels={data.labels}
        hr={data.hr.map((p) => p.v)}
        spo2={data.spo2.map((p) => p.v)}
        sys={data.sys.map((p) => p.v)}
        dia={data.dia.map((p) => p.v)}
        mapv={data.map.map((p) => p.v)}
        rr={data.rr.map((p) => p.v)}
        temp={data.temp.map((p) => p.v)}
        glucose={data.glucose.map((p) => p.v)}
        colors={neon}
      />

      {/* micro-trends */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <MicroTrend label="Steps" value={data.latest?.steps?.toLocaleString?.()} unit="" values={data.steps.map((p) => p.v)} color={neon.steps} />
        <MicroTrend label="Calories" value={data.latest?.calories} unit="kcal" values={data.calories.map((p) => p.v)} color={neon.calories} />
        <MicroTrend label="Distance" value={data.latest?.distance} unit="km" values={data.distance.map((p) => p.v)} color={neon.distance} />
        <MicroTrend label="Temp" value={fmt(data.latest?.temp, '°C')} values={data.temp.map((p) => p.v)} color={neon.temp} />
        <MicroTrend label="RR" value={fmt(data.latest?.rr, 'rpm')} values={data.rr.map((p) => p.v)} color={neon.rr} />
        <MicroTrend label="Glucose" value={fmt(data.latest?.glucose, 'mg/dL')} values={data.glucose.map((p) => p.v)} color={neon.glucose} />
      </div>

      {/* per-vital cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <MiniLineCard title="Heart Rate" unit=" bpm" labels={data.labels} values={data.hr.map((p) => p.v)} color={neon.hr} min={40} max={140}
          flagText={flags.HR_HIGH ? 'HR HIGH' : flags.HR_LOW ? 'HR LOW' : undefined} />
        <MeterDonut label="SpO₂" value={data.latest?.spo2 ?? 0} max={100} color={neon.spo2} unit="%" />
        <MiniLineCard title="Respiratory Rate" unit=" rpm" labels={data.labels} values={data.rr.map((p) => p.v)} color={neon.rr} min={6} max={32}
          flagText={flags.RR_HIGH ? 'RR HIGH' : flags.RR_LOW ? 'RR LOW' : undefined} />
        <MiniLineCard title="Temperature" unit=" °C" labels={data.labels} values={data.temp.map((p) => p.v)} color={neon.temp} min={35} max={39.5}
          flagText={flags.TEMP_HIGH ? 'TEMP HIGH' : flags.TEMP_LOW ? 'TEMP LOW' : undefined} />

        {/* BP card */}
        <div className={`rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur sci-glow ${flags.BP_HIGH ? 'sci-flag' : ''}`}>
          <div className="flex items-baseline justify-between">
            <div className="text-xs text-slate-400">Blood Pressure</div>
            <div className="text-sm font-semibold text-slate-200" suppressHydrationWarning>
              {data.latest ? `${fmt(data.latest.sys)}/${fmt(data.latest.dia)} · MAP ${fmt(data.latest.map)}` : '—'}
            </div>
          </div>
          <div className="h-28 mt-2">
            <LiveBP labels={data.labels} sys={data.sys.map((p) => p.v)} dia={data.dia.map((p) => p.v)} map={data.map.map((p) => p.v)} />
          </div>
          {flags.BP_HIGH ? <div className="mt-1 text-[10px] text-rose-300/90">BP HIGH</div> : null}
        </div>

        <MiniLineCard title="Glucose" unit=" mg/dL" labels={data.labels} values={data.glucose.map((p) => p.v)} color={neon.glucose} min={60} max={190}
          flagText={flags.GLU_HIGH ? 'GLU HIGH' : flags.GLU_LOW ? 'GLU LOW' : undefined} />

        <MeterDonut label="Steps" value={data.latest?.steps ?? 0} max={10000} color={neon.steps} />
        <MeterDonut label="Calories" value={data.latest?.calories ?? 0} max={2500} color={neon.calories} />
        <MeterDonut label="Distance (km)" value={data.latest?.distance ?? 0} max={8} color={neon.distance} />

        <SleepCard sleep={sleepData} />
      </div>

      <div className="scanline pointer-events-none" />
    </div>
  );
}

function MicroTrend({ label, value, unit, values, color }: { label: string; value?: any; unit?: string; values: number[]; color: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur sci-glow">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-xl font-semibold text-slate-200">{value ?? '—'} {unit}</div>
      <Sparkline labels={values.map((_, i) => `${i}`)} values={values} color={color} />
    </div>
  );
}

/** Tiny inline BP chart */
function LiveBP({ labels, sys, dia, map }: { labels: string[]; sys: number[]; dia: number[]; map: number[] }) {
  const { Line } = require('react-chartjs-2');
  const { Chart: ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } = require('chart.js');
  ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

  const data = {
    labels,
    datasets: [
      { label: 'SYS', data: sys, borderColor: '#FF6B6B', pointRadius: 0, tension: 0.25 },
      { label: 'DIA', data: dia, borderColor: '#F7B267', pointRadius: 0, tension: 0.25 },
      { label: 'MAP', data: map, borderColor: '#FFD93D', borderDash: [6, 4], pointRadius: 0, tension: 0.25 },
    ],
  };
  return <Line data={data} options={{ animation: { duration: 0 }, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { min: 50, max: 190 } } }} />;
}

/** Big bedside monitor chart */
function BedsideMonitor({ labels, hr, spo2, sys, dia, mapv, rr, temp, glucose, colors }:
  { labels: string[]; hr: number[]; spo2: number[]; sys: number[]; dia: number[]; mapv: number[]; rr: number[]; temp: number[]; glucose: number[]; colors: Record<string, string>; }) {
  const { Line } = require('react-chartjs-2');
  const { Chart: ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend } = require('chart.js');
  ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

  const data = {
    labels,
    datasets: [
      { label: 'HR (bpm)', data: hr, borderColor: colors.hr, pointRadius: 0, tension: 0.35 },
      { label: 'SpO₂ (%)', data: spo2, borderColor: colors.spo2, pointRadius: 0, tension: 0.35 },
      { label: 'SYS (mmHg)', data: sys, borderColor: colors.sys, pointRadius: 0, tension: 0.35 },
      { label: 'DIA (mmHg)', data: dia, borderColor: colors.dia, pointRadius: 0, tension: 0.35 },
      { label: 'MAP (mmHg)', data: mapv, borderColor: colors.map, borderDash: [6, 4], pointRadius: 0, tension: 0.35 },
      { label: 'RR (rpm)', data: rr, borderColor: colors.rr, pointRadius: 0, tension: 0.35 },
      { label: 'Temp (°C)', data: temp, borderColor: colors.temp, pointRadius: 0, tension: 0.35 },
      { label: 'Glucose (mg/dL)', data: glucose, borderColor: colors.glucose, pointRadius: 0, tension: 0.35 },
    ],
  };

  return (
    <div className="rounded-3xl border border-slate-800/40 bg-slate-900/80 shadow-xl p-4">
      <div className="h-[420px]">
        <Line data={data} options={{ responsive: true, animation: { duration: 0 }, plugins: { legend: { position: 'top', labels: { color: '#e2e8f0' } } } }} />
      </div>
    </div>
  );
}
