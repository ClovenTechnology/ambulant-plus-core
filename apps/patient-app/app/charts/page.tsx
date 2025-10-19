'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import useLiveVitals from '../../components/charts/useLiveVitals';
import MiniLineCard from '../../components/charts/MiniLineCard';
import MeterDonut from '../../components/charts/MeterDonut';
import Sparkline from '../../components/charts/Sparkline';
import SleepCard from '../../components/charts/SleepCard';
import { getSleepSeed } from '../../components/charts/sleepSeed';

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
  typeof x === 'number' && Number.isFinite(x) ? `${x}${unit ? ` ${unit}` : ''}` : '”';

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

export default function ChartsPage() {
  // avoid hydration mismatch from live/random data
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data, live, flags } = useLiveVitals(120, 1);

  // Fallback to seed (two sessions) if live pipe hasn't provided sleep yet
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
            {live ? <span className="ml-2 inline-flex items-center text-emerald-600"> live</span> : <span className="ml-2 text-rose-600"> offline</span>}
          </p>
        </div>
      </motion.div>

      {/* quick-glance stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <Stat label="HR" value={fmt(data.latest.hr, 'bpm')} />
        <Stat label="SpO2‚‚" value={fmt(data.latest.spo2, '%')} />
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

      {/* activity / micro-trends */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur sci-glow">
          <div className="text-xs text-slate-400">Steps</div>
          <div className="text-xl font-semibold text-slate-200">{data.latest?.steps?.toLocaleString?.() ?? '”'}</div>
          <Sparkline labels={data.labels} values={data.steps.map((p) => p.v)} color={neon.steps} />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur sci-glow">
          <div className="text-xs text-slate-400">Calories</div>
          <div className="text-xl font-semibold text-slate-200">{data.latest?.calories ?? '”'} kcal</div>
          <Sparkline labels={data.labels} values={data.calories.map((p) => p.v)} color={neon.calories} />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur sci-glow">
          <div className="text-xs text-slate-400">Distance</div>
          <div className="text-xl font-semibold text-slate-200">{data.latest?.distance ?? '”'} km</div>
          <Sparkline labels={data.labels} values={data.distance.map((p) => p.v)} color={neon.distance} />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur sci-glow">
          <div className="text-xs text-slate-400">Temp</div>
          <div className="text-xl font-semibold text-slate-200">{fmt(data.latest?.temp, '°C')}</div>
          <Sparkline labels={data.labels} values={data.temp.map((p) => p.v)} color={neon.temp} />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur sci-glow">
          <div className="text-xs text-slate-400">RR</div>
          <div className="text-xl font-semibold text-slate-200">{fmt(data.latest?.rr, 'rpm')}</div>
          <Sparkline labels={data.labels} values={data.rr.map((p) => p.v)} color={neon.rr} />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur sci-glow">
          <div className="text-xs text-slate-400">Glucose</div>
          <div className="text-xl font-semibold text-slate-200">{fmt(data.latest?.glucose, 'mg/dL')}</div>
          <Sparkline labels={data.labels} values={data.glucose.map((p) => p.v)} color={neon.glucose} />
        </div>
      </div>

      {/* per-vital cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <MiniLineCard
          title="Heart Rate"
          unit=" bpm"
          labels={data.labels}
          values={data.hr.map((p) => p.v)}
          color={neon.hr}
          min={40}
          max={140}
          flagText={flags.HR_HIGH ? 'HR HIGH' : flags.HR_LOW ? 'HR LOW' : undefined}
        />
        <MeterDonut label="SpO2" value={data.latest?.spo2 ?? 0} max={100} color={neon.spo2} unit="%" />
        <MiniLineCard
          title="Respiratory Rate"
          unit=" rpm"
          labels={data.labels}
          values={data.rr.map((p) => p.v)}
          color={neon.rr}
          min={6}
          max={32}
          flagText={flags.RR_HIGH ? 'RR HIGH' : flags.RR_LOW ? 'RR LOW' : undefined}
        />
        <MiniLineCard
          title="Temperature"
          unit=" °C"
          labels={data.labels}
          values={data.temp.map((p) => p.v)}
          color={neon.temp}
          min={35}
          max={39.5}
          flagText={flags.TEMP_HIGH ? 'TEMP HIGH' : flags.TEMP_LOW ? 'TEMP LOW' : undefined}
        />

        {/* BP with micro chart */}
        <div className={`rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur sci-glow ${flags.BP_HIGH ? 'sci-flag' : ''}`}>
          <div className="flex items-baseline justify-between">
            <div className="text-xs text-slate-400">Blood Pressure</div>
            <div className="text-sm font-semibold text-slate-200" suppressHydrationWarning>
              {data.latest ? `${fmt(data.latest.sys)}/${fmt(data.latest.dia)} · MAP ${fmt(data.latest.map)}` : '”'}
            </div>
          </div>
          <div className="h-28 mt-2">
            <LiveBP
              labels={data.labels}
              sys={data.sys.map((p) => p.v)}
              dia={data.dia.map((p) => p.v)}
              map={data.map.map((p) => p.v)}
            />
          </div>
          {flags.BP_HIGH ? <div className="mt-1 text-[10px] text-rose-300/90">BP HIGH</div> : null}
        </div>

        <MiniLineCard
          title="Glucose"
          unit=" mg/dL"
          labels={data.labels}
          values={data.glucose.map((p) => p.v)}
          color={neon.glucose}
          min={60}
          max={190}
          flagText={flags.GLU_HIGH ? 'GLU HIGH' : flags.GLU_LOW ? 'GLU LOW' : undefined}
        />

        {/* Activity rings */}
        <MeterDonut label="Steps" value={data.latest?.steps ?? 0} max={10000} color={neon.steps} />
        <MeterDonut label="Calories" value={data.latest?.calories ?? 0} max={2500} color={neon.calories} unit="" />
        <MeterDonut label="Distance (km)" value={data.latest?.distance ?? 0} max={8} color={neon.distance} unit="" />

        {/* Sleep “ seed until live */}
        <SleepCard sleep={sleepData} />
      </div>

      <div className="scanline pointer-events-none" />
    </div>
  );
}

/** tiny inline BP chart */
function LiveBP({
  labels,
  sys,
  dia,
  map,
}: {
  labels: string[];
  sys: number[];
  dia: number[];
  map: number[];
}) {
  const { Line } = require('react-chartjs-2');
  const {
    Chart: ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
  } = require('chart.js');
  ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

  const data = {
    labels,
    datasets: [
      { label: 'SYS', data: sys, borderColor: '#FF6B6B', pointRadius: 0, tension: 0.25 },
      { label: 'DIA', data: dia, borderColor: '#F7B267', pointRadius: 0, tension: 0.25 },
      { label: 'MAP', data: map, borderColor: '#FFD93D', borderDash: [6, 4], pointRadius: 0, tension: 0.25 },
    ],
  };
  const options = {
    animation: { duration: 0 },
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      x: { display: false },
      y: { min: 50, max: 190, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.08)' } },
    },
    maintainAspectRatio: false,
  };
  return <Line data={data} options={options as any} />;
}

/** Big bedside monitor chart (self-contained) */
function BedsideMonitor({
  labels,
  hr,
  spo2,
  sys,
  dia,
  mapv,
  rr,
  temp,
  glucose,
  colors,
}: {
  labels: string[];
  hr: number[];
  spo2: number[];
  sys: number[];
  dia: number[];
  mapv: number[];
  rr: number[];
  temp: number[];
  glucose: number[];
  colors: Record<string, string>;
}) {
  const { Line } = require('react-chartjs-2');
  const {
    Chart: ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend,
  } = require('chart.js');
  ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

  const data = {
    labels,
    datasets: [
      { label: 'HR (bpm)', data: hr, borderColor: colors.hr, pointRadius: 0, tension: 0.35 },
      { label: 'SpO2 (%)', data: spo2, borderColor: colors.spo2, pointRadius: 0, tension: 0.35 },
      { label: 'SYS (mmHg)', data: sys, borderColor: colors.sys, pointRadius: 0, tension: 0.35 },
      { label: 'DIA (mmHg)', data: dia, borderColor: colors.dia, pointRadius: 0, tension: 0.35 },
      { label: 'MAP (mmHg)', data: mapv, borderColor: colors.map, pointRadius: 0, borderDash: [6, 4], tension: 0.35 },
      { label: 'RR (rpm)', data: rr, borderColor: colors.rr, pointRadius: 0, tension: 0.35 },
      { label: 'Temp (°C)', data: temp, borderColor: colors.temp, pointRadius: 0, tension: 0.35 },
      { label: 'Glucose (mg/dL)', data: glucose, borderColor: colors.glucose, pointRadius: 0, tension: 0.35 },
    ],
  };

  const options = {
    animation: { duration: 0 },
    responsive: true,
    plugins: {
      legend: { display: true, position: 'top' as const, labels: { color: '#e2e8f0' } },
      tooltip: { enabled: true },
    },
    scales: {
      x: { ticks: { color: '#94a3b8', maxRotation: 0, autoSkip: true }, grid: { color: 'rgba(148,163,184,0.08)' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.08)' } },
    },
  };

  return (
    <div className="rounded-3xl border border-slate-800/40 bg-slate-900/80 shadow-xl p-4">
      <div className="h-[420px]">
        <Line data={data} options={options as any} />
      </div>
    </div>
  );
}
