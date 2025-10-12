'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Vitals = {
  hr?: number;
  spo2?: number;
  tempC?: number;
  rr?: number;
  bpSys?: number;
  bpDia?: number;
  ts?: number;
};

type SeriesPoint = { x: number; y: number };

const MAX_POINTS = 180; // keep ~6 minutes at 2s cadence

export default function ChartsClient() {
  const [hr, setHr] = useState<SeriesPoint[]>([]);
  const [spo2, setSpo2] = useState<SeriesPoint[]>([]);
  const [tempC, setTempC] = useState<SeriesPoint[]>([]);
  const [rr, setRr] = useState<SeriesPoint[]>([]);
  const [bpSys, setBpSys] = useState<SeriesPoint[]>([]);
  const [bpDia, setBpDia] = useState<SeriesPoint[]>([]);
  const lastRef = useRef<Vitals | null>(null);

  const push = (setter: React.Dispatch<React.SetStateAction<SeriesPoint[]>>, x: number, y?: number) => {
    if (typeof y !== 'number' || !Number.isFinite(y)) return;
    setter(prev => {
      const next = [...prev, { x, y }];
      return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
    });
  };

  useEffect(() => {
    // Accept vitals from:
    // 1) BroadcastChannel('amb-vitals')  [from patient SFU]
    // 2) window.postMessage({ type:'vitals', vitals }) [fallback]
    const onSample = (v: Vitals) => {
      const t = v.ts ?? Date.now();
      push(setHr, t, v.hr);
      push(setSpo2, t, v.spo2);
      push(setTempC, t, v.tempC);
      push(setRr, t, v.rr);
      push(setBpSys, t, v.bpSys);
      push(setBpDia, t, v.bpDia);
      lastRef.current = v;
    };

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('amb-vitals');
      bc.onmessage = (e: MessageEvent) => {
        const data = e.data;
        // accepts: { type:'vitals', payload: Vitals } OR raw Vitals
        if (data?.type === 'vitals' && data?.payload) onSample(data.payload as Vitals);
        else if (data && typeof data === 'object' && ('hr' in data || 'bpSys' in data)) onSample(data as Vitals);
      };
    } catch {
      // older browsers / blocked â€” ignore
    }

    const onWinMsg = (e: MessageEvent) => {
      if (e.data?.type === 'vitals' && e.data?.vitals) onSample(e.data.vitals as Vitals);
    };
    window.addEventListener('message', onWinMsg);

    return () => {
      window.removeEventListener('message', onWinMsg);
      try { bc?.close(); } catch {}
    };
  }, []);

  const now = Date.now();
  const last = lastRef.current;

  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Bedside Monitor</h1>
        <div className="text-xs text-gray-500">
          {last?.ts ? new Date(last.ts).toLocaleTimeString() : 'â€”'}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Heart Rate (bpm)" subtitle={fmtVal(last?.hr, ' bpm')}>
          <LineChart series={[{ name: 'HR', data: hr }]} yMin={40} yMax={160} />
        </Card>

        <Card title="SpOâ‚‚ (%)" subtitle={fmtVal(last?.spo2, ' %')}>
          <LineChart series={[{ name: 'SpO2', data: spo2 }]} yMin={85} yMax={100} />
        </Card>

        <Card title="Temperature (Â°C)" subtitle={fmtVal(last?.tempC, ' Â°C')}>
          <LineChart series={[{ name: 'Temp', data: tempC }]} yMin={34} yMax={40} />
        </Card>

        <Card title="Respiratory Rate (/min)" subtitle={fmtVal(last?.rr, ' /min')}>
          <LineChart series={[{ name: 'RR', data: rr }]} yMin={6} yMax={36} />
        </Card>

        <Card title="Blood Pressure (mmHg)" subtitle={fmtBP(last?.bpSys, last?.bpDia)}>
          <LineChart
            series={[
              { name: 'Sys', data: bpSys },
              { name: 'Dia', data: bpDia },
            ]}
            yMin={40}
            yMax={200}
          />
        </Card>
      </div>

      <footer className="text-xs text-gray-500">
        Stream source: patient app (local). Open your consultation and start vitals to see real-time charts.
      </footer>
    </div>
  );
}

function fmtVal(x?: number, suffix = '') {
  return typeof x === 'number' && Number.isFinite(x) ? `${x.toFixed(1)}${suffix}` : 'â€”';
}
function fmtBP(sys?: number, dia?: number) {
  if (!Number.isFinite(sys!) || !Number.isFinite(dia!)) return 'â€”/â€” mmHg';
  return `${Math.round(sys!)} / ${Math.round(dia!)} mmHg`;
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-gray-500">{subtitle}</div>
      </div>
      <div className="h-40">
        {children}
      </div>
    </section>
  );
}

function LineChart({
  series,
  yMin,
  yMax,
}: {
  series: { name: string; data: SeriesPoint[] }[];
  yMin: number;
  yMax: number;
}) {
  // simple responsive SVG line chart (no external deps)
  const pad = 8;
  const [w, h] = [640, 160]; // viewBox; scales with CSS

  const paths = useMemo(() => {
    const xs = series.flatMap(s => s.data.map(p => p.x));
    const xmin = xs.length ? Math.min(...xs) : Date.now() - 60_000;
    const xmax = xs.length ? Math.max(...xs) : Date.now();

    const xscale = (x: number) => {
      const den = Math.max(1, xmax - xmin);
      return pad + ((x - xmin) / den) * (w - pad * 2);
    };
    const yscale = (y: number) => {
      const den = Math.max(0.0001, yMax - yMin);
      return h - pad - ((y - yMin) / den) * (h - pad * 2);
    };

    const toPath = (data: SeriesPoint[]) => {
      if (!data.length) return '';
      return data
        .map((p, i) => `${i ? 'L' : 'M'} ${xscale(p.x).toFixed(1)} ${yscale(p.y).toFixed(1)}`)
        .join(' ');
    };

    return series.map(s => toPath(s.data));
  }, [series, yMin, yMax]);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
      {/* background grid */}
      <Grid w={w} h={h} pad={pad} />
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" strokeWidth={2} strokeLinecap="round" />
      ))}
    </svg>
  );
}

function Grid({ w, h, pad }: { w: number; h: number; pad: number }) {
  const lines: JSX.Element[] = [];
  const rows = 4;
  for (let i = 0; i <= rows; i++) {
    const y = pad + (i * (h - pad * 2)) / rows;
    lines.push(<line key={i} x1={pad} x2={w - pad} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />);
  }
  return <g>{lines}</g>;
}
