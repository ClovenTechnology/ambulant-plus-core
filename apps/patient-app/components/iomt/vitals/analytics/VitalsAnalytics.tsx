'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { Collapse } from '@/components/Collapse';
import { CollapseBtn } from '@/components/CollapseBtn';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

type RangeOpt = 7 | 14 | 30 | 90;
type VitalBase = { id: string; timestamp: string };

type BPRec = VitalBase & { systolic: number; diastolic: number; pulse?: number };
type SpO2Rec = VitalBase & { spo2: number; pulse?: number };
type TempRec = VitalBase & { celsius: number };
type HRRec = VitalBase & { hr: number };

type Props = {
  patientId: string;
  defaultRangeDays?: RangeOpt;
  seedSummary?: any;
};

const uid = (p='') => p + Math.random().toString(36).slice(2,9);

const API = {
  bp: (pid: string, from: string, to: string) => `/api/v1/patients/${encodeURIComponent(pid)}/vitals/bp?from=${from}&to=${to}`,
  spo2: (pid: string, from: string, to: string) => `/api/v1/patients/${encodeURIComponent(pid)}/vitals/spo2?from=${from}&to=${to}`,
  temp: (pid: string, from: string, to: string) => `/api/v1/patients/${encodeURIComponent(pid)}/vitals/temp?from=${from}&to=${to}`,
  hr: (pid: string, from: string, to: string) => `/api/v1/patients/${encodeURIComponent(pid)}/vitals/hr?from=${from}&to=${to}`,
};

async function fetchSafe<T>(url: string, fallback: T, timeoutMs = 6000): Promise<T> {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { cache: 'no-store', signal: ac.signal });
    if (!r.ok) return fallback;
    const j = (await r.json()) as T;
    return (j as any)?.items ?? j ?? fallback;
  } catch { return fallback; } finally { clearTimeout(id); }
}

function cn(...a: Array<string | false | undefined>) { return a.filter(Boolean).join(' '); }
function toISO(date = new Date()) { return date.toISOString().slice(0,10); }
function addDays(base: Date, d: number) { const x=new Date(base); x.setDate(x.getDate()+d); return x; }

/** ---------- Shared analytics helpers ---------- */
function linearSlope(records: Array<{ timestamp: string; value: number }>) {
  if (!records.length) return 0;
  const xs = records.map(r => new Date(r.timestamp).getTime());
  const ys = records.map(r => r.value);
  const n = xs.length;
  const xMean = xs.reduce((a,b)=>a+b,0)/n;
  const yMean = ys.reduce((a,b)=>a+b,0)/n;
  let num=0, den=0;
  for (let i=0;i<n;i++){ num += (xs[i]-xMean)*(ys[i]-yMean); den += (xs[i]-xMean)*(xs[i]-xMean); }
  const slopePerMs = den===0 ? 0 : num/den;
  return slopePerMs * 1000*60*60*24; // per day
}
function bucket4h(ts: string) { return Math.floor(new Date(ts).getHours()/4); }
function dow(ts: string){ return new Date(ts).getDay(); }
function heatmapAvg(rows: Array<{ timestamp: string; value: number }>) {
  const buckets = Array.from({length:7},()=>Array.from({length:6},()=>[] as number[]));
  rows.forEach(r => buckets[dow(r.timestamp)][bucket4h(r.timestamp)].push(r.value));
  return buckets.map(row => row.map(col => col.length ? +(col.reduce((a,b)=>a+b,0)/col.length).toFixed(1) : null));
}

/** ---------- Threshold presets (editable later) ---------- */
const BP = {
  zones: {
    normal:   (s: number, d: number) => s < 120 && d < 80,
    elevated: (s: number, d: number) => s >= 120 && s <= 129 && d < 80,
    stage1:   (s: number, d: number) => (s >= 130 && s <= 139) || (d >= 80 && d <= 89),
    stage2:   (s: number, d: number) => s >= 140 || d >= 90,
  },
};
const SPO2 = { green: 95, amber: 90 }; // >=95 ok; 90-94 borderline; <90 low
const TEMP = { low: 35.0, high: 38.0 }; // °C
const HR = { brady: 60, tachy: 100 }; // bpm

/** ---------- Small primitives ---------- */
function SectionCard({ title, subtitle, children, right }: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="p-3 md:p-4 rounded-2xl border bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm md:text-base font-semibold tracking-tight">{title}</h3>
          {subtitle ? <p className="text-xs md:text-sm text-gray-500 mt-0.5">{subtitle}</p> : null}
        </div>
        <div>{right}</div>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function HeatDay({ label, row }: { label: string; row: (number|null)[] }) {
  const red = 1, amber = 2; // dynamic per-vital in each use
  return (
    <div className="text-xxs">
      <div className="mb-1 font-medium">{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap:4 }}>
        {row.map((v, i) => {
          const color = v==null ? '#e5e7eb' : v >  v! ? '#ef4444' : '#10b981'; // placeholder; set per-vital
          return (
            <div key={i} className="text-white text-xxs rounded p-1 text-center" style={{ background: v==null ? '#e5e7eb' : '#64748b' }}>
              {v==null ? '—' : v}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** ---------- BP Analytics ---------- */
function BPAnalytics({ items }: { items: BPRec[] }) {
  const pointsS = items.map(r => ({ timestamp: r.timestamp, value: r.systolic }));
  const pointsD = items.map(r => ({ timestamp: r.timestamp, value: r.diastolic }));
  const slopeS = linearSlope(pointsS);
  const slopeD = linearSlope(pointsD);
  const slopeLabel = (s: number) => s > 0.2 ? 'Upward' : s < -0.2 ? 'Downward' : 'Stable';

  // zones count
  const counts = useMemo(() => {
    let normal=0,elev=0,s1=0,s2=0;
    for (const r of items) {
      if (BP.zones.stage2(r.systolic, r.diastolic)) s2++;
      else if (BP.zones.stage1(r.systolic, r.diastolic)) s1++;
      else if (BP.zones.elevated(r.systolic, r.diastolic)) elev++;
      else if (BP.zones.normal(r.systolic, r.diastolic)) normal++;
    }
    return { normal, elev, s1, s2, total: items.length };
  }, [items]);

  const heat = useMemo(() => heatmapAvg(pointsS), [items]);

  const barData = {
    labels: ['Normal','Elevated','Stage 1','Stage 2'],
    datasets: [{ label: 'Count', data: [counts.normal, counts.elev, counts.s1, counts.s2], backgroundColor: ['rgba(16,185,129,.8)','rgba(245,158,11,.8)','rgba(99,102,241,.8)','rgba(239,68,68,.8)'] }]
  };
  const lineData = {
    labels: items.map(r => new Date(r.timestamp).toLocaleString()),
    datasets: [
      { label: 'Systolic', data: items.map(r => r.systolic), borderColor: 'rgba(99,102,241,1)', backgroundColor: 'rgba(99,102,241,.2)', tension:.2 },
      { label: 'Diastolic', data: items.map(r => r.diastolic), borderColor: 'rgba(16,185,129,1)', backgroundColor: 'rgba(16,185,129,.2)', tension:.2 },
    ]
  };

  // collapsible targets (optional future: user-editable)
  const [openTargets, setOpenTargets] = useState(true);

  return (
    <SectionCard
      title="Blood Pressure — Analytics"
      subtitle="Zones, trend, and time-of-day patterns"
      right={<CollapseBtn open={openTargets} onClick={()=>setOpenTargets(o=>!o)} titleOpen="Hide Targets" titleClosed="Show Targets" />}
    >
      <Collapse open={openTargets}>
        <div className="text-xs text-gray-600 mb-2">
          Zones: Normal &lt;120/&lt;80 • Elevated 120–129/&lt;80 • Stage1 130–139 or 80–89 • Stage2 ≥140 or ≥90 (modifiable later).
        </div>
      </Collapse>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 border rounded bg-white md:col-span-2">
          <div className="text-sm font-medium mb-1">Trend</div>
          <Line data={lineData} options={{ plugins:{legend:{display:true}}, scales:{ y:{ beginAtZero:false }}}}/>
          <div className="text-xs text-gray-600 mt-1">
            Slope/day — Systolic: {slopeS.toFixed(2)} • Diastolic: {slopeD.toFixed(2)} ({slopeLabel((slopeS+slopeD)/2)})
          </div>
        </div>
        <div className="p-3 border rounded bg-white">
          <div className="text-sm font-medium mb-1">Out-of-range breakdown</div>
          <Bar data={barData} options={{ plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true, precision:0 }}}}/>
          <div className="text-xs text-gray-600 mt-1">Total {counts.total} readings</div>
        </div>
      </div>

      <div className="mt-3 p-3 border rounded bg-white">
        <div className="text-sm font-medium mb-2">Daily heatmap (avg Systolic)</div>
        <div className="text-xxs text-gray-500 mb-2">Each cell ≈ 4h block</div>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{[0,1,2,3].map(d => <HeatDay key={d} label={['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]} row={heat[d]} />)}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{[4,5,6].map(d => <HeatDay key={d} label={['Thu','Fri','Sat'][d-4]} row={heat[d]} />)}</div>
        </div>
      </div>
    </SectionCard>
  );
}

/** ---------- SpO₂ Analytics ---------- */
function SpO2Analytics({ items }: { items: SpO2Rec[] }) {
  const pts = items.map(r => ({ timestamp: r.timestamp, value: r.spo2 }));
  const slope = linearSlope(pts);
  const tir = useMemo(() => {
    let green=0, amber=0, red=0;
    for (const r of items) {
      if (r.spo2 >= SPO2.green) green++;
      else if (r.spo2 >= SPO2.amber) amber++;
      else red++;
    }
    const total = items.length;
    return { green, amber, red, total, pctGreen: total? Math.round(green/total*100):0, t90: total? Math.round(red/total*100):0 };
  }, [items]);

  const lineData = {
    labels: items.map(r => new Date(r.timestamp).toLocaleString()),
    datasets: [{ label: 'SpO₂', data: items.map(r => r.spo2), borderColor: 'rgba(59,130,246,1)', backgroundColor:'rgba(59,130,246,.2)', tension:.2 }]
  };
  const barData = {
    labels: ['≥95% (ok)', '90–94% (borderline)', '<90% (low)'],
    datasets: [{ label:'Count', data:[tir.green, tir.amber, tir.red], backgroundColor:['rgba(16,185,129,.8)','rgba(245,158,11,.8)','rgba(239,68,68,.8)'] }]
  };

  const heat = useMemo(() => heatmapAvg(pts), [items]);
  const [openTargets, setOpenTargets] = useState(true);

  return (
    <SectionCard
      title="SpO₂ — Analytics"
      subtitle="TIR-style distribution, trend, and time-of-day"
      right={<CollapseBtn open={openTargets} onClick={()=>setOpenTargets(o=>!o)} titleOpen="Hide Targets" titleClosed="Show Targets" />}
    >
      <Collapse open={openTargets}>
        <div className="text-xs text-gray-600 mb-2">
          Targets: Green ≥{SPO2.green}% • Amber {SPO2.amber}–{SPO2.green-1}% • Red &lt;{SPO2.amber}% (editable in a future Thresholds panel).
        </div>
      </Collapse>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 border rounded bg-white md:col-span-2">
          <div className="text-sm font-medium mb-1">Trend</div>
          <Line data={lineData} options={{ plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:false, suggestedMin:85, suggestedMax:100 }}}}/>
          <div className="text-xs text-gray-600 mt-1">Slope/day: {slope.toFixed(2)} (%/day)</div>
        </div>

        <div className="p-3 border rounded bg-white">
          <div className="text-sm font-medium mb-1">Distribution</div>
          <Bar data={barData} options={{ plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true, precision:0 }}}}/>
          <div className="text-xs text-gray-600 mt-1">T90 (time &lt; 90%): {tir.t90}% • In-range ≥95%: {tir.pctGreen}%</div>
        </div>
      </div>

      <div className="mt-3 p-3 border rounded bg-white">
        <div className="text-sm font-medium mb-2">Daily heatmap (avg %)</div>
        <div className="text-xxs text-gray-500 mb-2">Each cell ≈ 4h block</div>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{[0,1,2,3].map(d => <HeatDay key={d} label={['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]} row={heat[d]} />)}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{[4,5,6].map(d => <HeatDay key={d} label={['Thu','Fri','Sat'][d-4]} row={heat[d]} />)}</div>
        </div>
      </div>
    </SectionCard>
  );
}

/** ---------- Temperature (lean) ---------- */
function TempAnalytics({ items }: { items: TempRec[] }) {
  const pts = items.map(r => ({ timestamp: r.timestamp, value: r.celsius }));
  const slope = linearSlope(pts);
  const dist = useMemo(() => {
    let low=0, normal=0, high=0;
    for (const r of items) {
      if (r.celsius < TEMP.low) low++;
      else if (r.celsius >= TEMP.high) high++;
      else normal++;
    }
    return { low, normal, high, total: items.length };
  }, [items]);
  const data = {
    labels: items.map(r => new Date(r.timestamp).toLocaleString()),
    datasets: [{ label:'°C', data: items.map(r => r.celsius), borderColor:'rgba(99,102,241,1)', backgroundColor:'rgba(99,102,241,.2)', tension:.2 }]
  };
  return (
    <SectionCard title="Temperature — Analytics" subtitle="Trend & thresholds">
      <Line data={data} options={{ plugins:{legend:{display:false}}, scales:{ y:{ suggestedMin:34, suggestedMax:40 }}}}/>
      <div className="text-xs text-gray-600 mt-1">Slope/day: {slope.toFixed(2)} °C • In-range: {dist.total? Math.round(dist.normal/dist.total*100):0}%</div>
    </SectionCard>
  );
}

/** ---------- Heart Rate (lean) ---------- */
function HRAnalytics({ items }: { items: HRRec[] }) {
  const pts = items.map(r => ({ timestamp: r.timestamp, value: r.hr }));
  const slope = linearSlope(pts);
  const dist = useMemo(() => {
    let brady=0, normal=0, tachy=0;
    for (const r of items) {
      if (r.hr < HR.brady) brady++;
      else if (r.hr >= HR.tachy) tachy++;
      else normal++;
    }
    return { brady, normal, tachy, total: items.length };
  }, [items]);
  const data = {
    labels: items.map(r => new Date(r.timestamp).toLocaleString()),
    datasets: [{ label:'bpm', data: items.map(r => r.hr), borderColor:'rgba(16,185,129,1)', backgroundColor:'rgba(16,185,129,.2)', tension:.2 }]
  };
  const bar = { labels:['Brady <60','Normal 60–99','Tachy ≥100'], datasets:[{ label:'Count', data:[dist.brady, dist.normal, dist.tachy], backgroundColor:['rgba(59,130,246,.8)','rgba(16,185,129,.8)','rgba(239,68,68,.8)'] }]};
  return (
    <SectionCard title="Heart Rate — Analytics" subtitle="Trend & brady/tachy breakdown">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 border rounded bg-white md:col-span-2">
          <Line data={data} options={{ plugins:{legend:{display:false}} }}/>
          <div className="text-xs text-gray-600 mt-1">Slope/day: {slope.toFixed(2)} bpm</div>
        </div>
        <div className="p-3 border rounded bg-white">
          <Bar data={bar} options={{ plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true, precision:0 }}}}/>
          <div className="text-xs text-gray-600 mt-1">Total {dist.total}</div>
        </div>
      </div>
    </SectionCard>
  );
}

/** ---------- Main Dashboard ---------- */
export default function VitalsAnalytics({ patientId, defaultRangeDays = 30, seedSummary }: Props) {
  const [range, setRange] = useState<RangeOpt>(defaultRangeDays);
  const to = toISO();
  const from = toISO(addDays(new Date(), -range));

  const [bp, setBP] = useState<BPRec[]>([]);
  const [spo2, setSPO2] = useState<SpO2Rec[]>([]);
  const [temp, setTemp] = useState<TempRec[]>([]);
  const [hr, setHR] = useState<HRRec[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [bpI, sI, tI, hI] = await Promise.all([
        fetchSafe<{items:BPRec[]}>(API.bp(patientId, from, to), []),
        fetchSafe<{items:SpO2Rec[]}>(API.spo2(patientId, from, to), []),
        fetchSafe<{items:TempRec[]}>(API.temp(patientId, from, to), []),
        fetchSafe<{items:HRRec[]}>(API.hr(patientId, from, to), []),
      ]);
      if (!mounted) return;
      setBP(bpI as any);
      setSPO2(sI as any);
      setTemp(tI as any);
      setHR(hI as any);
    })();
    return () => { mounted = false; };
  }, [patientId, from, to]);

  return (
    <div className="space-y-4">
      <SectionCard
        title="Analytics"
        subtitle="Cross-vital trends for selected date range"
        right={
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Range</label>
            <select value={range} onChange={e=>setRange(Number(e.target.value) as RangeOpt)} className="p-1 border rounded text-sm bg-white">
              <option value={7}>7d</option>
              <option value={14}>14d</option>
              <option value={30}>30d</option>
              <option value={90}>90d</option>
            </select>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="p-2 border rounded bg-white">
            <div className="font-medium">BP readings</div>
            <div className="text-base">{bp.length}</div>
            <div className="text-xxs text-gray-500">{from} → {to}</div>
          </div>
          <div className="p-2 border rounded bg-white">
            <div className="font-medium">SpO₂ readings</div>
            <div className="text-base">{spo2.length}</div>
            <div className="text-xxs text-gray-500">{from} → {to}</div>
          </div>
          <div className="p-2 border rounded bg-white">
            <div className="font-medium">Temp readings</div>
            <div className="text-base">{temp.length}</div>
            <div className="text-xxs text-gray-500">{from} → {to}</div>
          </div>
          <div className="p-2 border rounded bg-white">
            <div className="font-medium">HR readings</div>
            <div className="text-base">{hr.length}</div>
            <div className="text-xxs text-gray-500">{from} → {to}</div>
          </div>
        </div>
      </SectionCard>

      {/* Per-vital analytics */}
      <BPAnalytics items={bp} />
      <SpO2Analytics items={spo2} />
      <TempAnalytics items={temp} />
      <HRAnalytics items={hr} />
      {/* ECG can add session counts + quality summary when its history API is ready */}
    </div>
  );
}
