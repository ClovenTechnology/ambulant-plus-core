// apps/patient-app/components/charts/ChartsClient.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type DeviceTab = 'wearable' | 'monitor' | 'stetho' | 'otoscope';
type StethoMode = 'heart' | 'lung' | 'off';

type Vitals = {
  ts: number;
  hr: number;      // bpm
  spo2: number;    // %
  sys: number;     // mmHg
  dia: number;     // mmHg
  map: number;     // mmHg
  rr: number;      // /min
  tempC: number;   // °C
  glucose: number; // mg/dL
};

/** ---------- tiny helpers ---------- */
const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Colours chosen to be readable on both light/dark */
const COLORS = {
  hr:       '#22D3EE', // cyan-400
  spo2:     '#60A5FA', // blue-400
  sys:      '#FB7185', // rose-400
  dia:      '#F59E0B', // amber-500
  map:      '#FDE047', // yellow-300
  rr:       '#A78BFA', // violet-400
  tempC:    '#67E8F9', // cyan-300
  glucose:  '#34D399', // emerald-400
  grid:     '#94a3b8', // slate-400
};

/** Broadcast to clinician SFU (and any listening workspace shells) without breaking anything */
function broadcastVitals(v: Vitals) {
  const payload = { type: 'vitals', vitals: v };
  try { window.postMessage(payload, '*'); } catch {}
  try { window.top && window.top !== window && window.top.postMessage(payload, '*'); } catch {}
  try { window.parent && window.parent !== window && window.parent.postMessage(payload, '*'); } catch {}
  try { window.opener && window.opener.postMessage(payload, '*'); } catch {}
  try {
    const bc = new BroadcastChannel('ambulant-iomt');
    bc.postMessage(payload);
    // close quickly to avoid leaks (Chrome keeps it until GC otherwise)
    setTimeout(() => bc.close(), 50);
  } catch {}
}

/** Simulated IoMT stream (stable, smooth, SA-flavoured baselines) */
function nextSample(prev?: Vitals): Vitals {
  const t = Date.now();

  // Baselines (adult in Gauteng, resting)
  const base = {
    hr: 72,
    spo2: 97.2,
    sys: 116,
    dia: 74,
    map: 88,
    rr: 16,
    tempC: 36.8,
    glucose: 94,
  };

  // Gentle random walk around baseline
  const jitter = (mean = 0, sd = 1) => (Math.random() - 0.5) * sd * 2 + mean;
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

  const v0 = prev ?? {
    ts: t - 1000,
    hr: base.hr,
    spo2: base.spo2,
    sys: base.sys,
    dia: base.dia,
    map: base.map,
    rr: base.rr,
    tempC: base.tempC,
    glucose: base.glucose,
  };

  const target = {
    hr: clamp(v0.hr + jitter(0, 1.6), 58, 135),
    spo2: clamp(v0.spo2 + jitter(0, 0.25), 93, 100),
    sys: clamp(v0.sys + jitter(0, 2.8), 90, 180),
    dia: clamp(v0.dia + jitter(0, 2.0), 55, 110),
    map: 0, // recompute below
    rr: clamp(v0.rr + jitter(0, 0.9), 8, 32),
    tempC: clamp(v0.tempC + jitter(0, 0.05), 35.0, 39.8),
    glucose: clamp(v0.glucose + jitter(0, 2.5), 60, 190),
  };
  target.map = Math.round((target.sys + 2 * target.dia) / 3);

  const k = 0.35; // smoothing
  const v: Vitals = {
    ts: t,
    hr: round1(lerp(v0.hr, target.hr, k)),
    spo2: round1(lerp(v0.spo2, target.spo2, k)),
    sys: round1(lerp(v0.sys, target.sys, k)),
    dia: round1(lerp(v0.dia, target.dia, k)),
    map: round1(lerp(v0.map, target.map, k)),
    rr: round1(lerp(v0.rr, target.rr, k)),
    tempC: round1(lerp(v0.tempC, target.tempC, k)),
    glucose: Math.round(lerp(v0.glucose, target.glucose, k)),
  };
  return v;
}

/** Draw the bedside canvas */
function drawBedside(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  series: Vitals[]
) {
  // padding and axes
  const px = 40, py = 28;
  const innerW = w - px * 2;
  const innerH = h - py * 2;

  ctx.clearRect(0, 0, w, h);

  // background panel
  ctx.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue('--tw-bg-opacity') ? 'rgba(2,6,23,0.7)' : '#0B1220';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(px, py, innerW, innerH);

  // subtle grid
  ctx.strokeStyle = 'rgba(148,163,184,0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 6; i++) {
    const y = py + (innerH * i) / 6;
    ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + innerW, y); ctx.stroke();
  }
  for (let i = 0; i <= 10; i++) {
    const x = px + (innerW * i) / 10;
    ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x, py + innerH); ctx.stroke();
  }

  if (series.length < 2) return;

  const xs = (i: number) => px + (innerW * i) / (series.length - 1);

  // metric scalers (rough, readable)
  const scale = {
    hr:  (v: number) => py + innerH - ((v - 40) / (160 - 40)) * innerH,
    spo2:(v: number) => py + innerH - ((v - 88) / (100 - 88)) * innerH,
    sys: (v: number) => py + innerH - ((v - 80) / (180 - 80)) * innerH,
    dia: (v: number) => py + innerH - ((v - 50) / (120 - 50)) * innerH,
    map: (v: number) => py + innerH - ((v - 60) / (120 - 60)) * innerH,
    rr:  (v: number) => py + innerH - ((v - 6) / (32 - 6)) * innerH,
    temp:(v: number) => py + innerH - ((v - 35) / (40 - 35)) * innerH,
    glu: (v: number) => py + innerH - ((v - 60) / (190 - 60)) * innerH,
  };

  const drawLine = (key: keyof Vitals, color: string, scaler: (v: number) => number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    series.forEach((s, i) => {
      const x = xs(i);
      const val =
        key === 'tempC' ? scaler(s.tempC) :
        key === 'glucose' ? scaler(s.glucose) :
        scaler(s[key] as unknown as number);
      if (i === 0) ctx.moveTo(x, val); else ctx.lineTo(x, val);
    });
    ctx.stroke();

    // glow
    ctx.strokeStyle = color + '55';
    ctx.lineWidth = 6;
    ctx.stroke();
  };

  drawLine('hr', COLORS.hr, scale.hr);
  drawLine('spo2', COLORS.spo2, scale.spo2);
  drawLine('sys', COLORS.sys, scale.sys);
  drawLine('dia', COLORS.dia, scale.dia);
  drawLine('map', COLORS.map, scale.map);
  drawLine('rr', COLORS.rr, scale.rr);
  drawLine('tempC', COLORS.tempC, scale.temp);
  drawLine('glucose', COLORS.glucose, scale.glu);
}

/** ---------- main component ---------- */
export default function ChartsClient() {
  // UI state
  const [tab, setTab] = useState<DeviceTab>('wearable');
  const [stetho, setStetho] = useState<StethoMode>('off');
  const [ecgOn, setEcgOn] = useState(false);
  const [liveOn, setLiveOn] = useState(true);

  // vitals stream
  const [latest, setLatest] = useState<Vitals | null>(null);
  const [series, setSeries] = useState<Vitals[]>([]);

  // device id / SA context
  const deviceId = useMemo(() => {
    const city = ['Johannesburg', 'CapeTown', 'Durban', 'Polokwane'][Math.floor(Math.random()*4)];
    return `NexRing-${city}-ZA-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  }, []);

  // canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // stream generator
  useEffect(() => {
    if (!liveOn) return;
    let cancelled = false;
    let v = latest ?? nextSample();

    const tick = () => {
      if (cancelled) return;

      // When particular tabs active, nudge baselines slightly (feels real)
      if (tab === 'stetho' && stetho !== 'off') {
        v.hr += (stetho === 'lung' ? 0.4 : 0.2);
      }
      if (tab === 'monitor' && ecgOn) {
        v.hr += 0.3;
      }

      v = nextSample(v);

      setLatest(v);
      setSeries((old) => {
        const maxPoints = 240; // ~3–4 minutes at ~750ms cadence
        const next = [...old, v];
        if (next.length > maxPoints) next.shift();
        return next;
      });

      // Broadcast for clinician SFU (no-op if nobody listens)
      broadcastVitals(v);

      // cadence ~800ms
      setTimeout(tick, 800);
    };

    tick();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveOn, tab, stetho, ecgOn]);

  // draw bedside chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = parent.clientWidth * dpr;
      canvas.height = Math.max(320, Math.round(parent.clientWidth * 0.42)) * dpr;
      canvas.style.width = parent.clientWidth + 'px';
      canvas.style.height = Math.max(320, Math.round(parent.clientWidth * 0.42)) + 'px';
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);

    const render = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawBedside(ctx, canvas.width, canvas.height, series);
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [series]);

  return (
    <div className="p-4 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live Vitals</h1>
          <div className="text-sm text-slate-600">
            Streaming from IoMT <span className="inline-flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${liveOn ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {liveOn ? 'live' : 'paused'}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Device ID: {deviceId}</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setLiveOn(v => !v)}
            className="px-3 py-1 border rounded"
          >
            {liveOn ? 'Pause' : 'Resume'}
          </button>
        </div>
      </header>

      {/* Device selectors */}
      <div className="flex flex-wrap gap-2">
        <TabBtn active={tab === 'wearable'} onClick={() => setTab('wearable')}>Wearable</TabBtn>
        <TabBtn active={tab === 'monitor'}  onClick={() => setTab('monitor')}>Health Monitor</TabBtn>
        <TabBtn active={tab === 'stetho'}   onClick={() => setTab('stetho')}>Digital Stethoscope</TabBtn>
        <TabBtn active={tab === 'otoscope'} onClick={() => setTab('otoscope')}>HD Otoscope</TabBtn>
      </div>

      {/* Controls row (contextual) */}
      <div className="flex flex-wrap gap-3">
        {tab === 'monitor' && (
          <>
            <CtlBtn onClick={() => setEcgOn(true)}  disabled={ecgOn}>ECG Start</CtlBtn>
            <CtlBtn onClick={() => setEcgOn(false)} disabled={!ecgOn}>ECG Stop</CtlBtn>
          </>
        )}
        {tab === 'stetho' && (
          <>
            <CtlBtn onClick={() => setStetho('heart')} disabled={stetho === 'heart'}>Stetho Heart</CtlBtn>
            <CtlBtn onClick={() => setStetho('lung')}  disabled={stetho === 'lung'}>Stetho Lung</CtlBtn>
            <CtlBtn onClick={() => setStetho('off')}   disabled={stetho === 'off'}>Stetho Stop</CtlBtn>
          </>
        )}
        {tab === 'otoscope' && (
          <>
            <CtlBtn onClick={() => alert('Capture: Otoscope Photo (stub)')}>Otoscope Photo</CtlBtn>
            <CtlBtn onClick={() => alert('Capture: Otoscope Video (stub)')}>Otoscope Video ▷</CtlBtn>
          </>
        )}
        {/* always visible quick reads */}
        <CtlBtn onClick={() => toast('BP reading received')}>BP</CtlBtn>
        <CtlBtn onClick={() => toast('SpO₂ reading received')}>SpO₂</CtlBtn>
        <CtlBtn onClick={() => toast('Temp reading received')}>Temp</CtlBtn>
        <CtlBtn onClick={() => toast('Glucose reading received')}>Glucose</CtlBtn>
      </div>

      {/* tiles */}
      <Tiles latest={latest} />

      {/* bedside monitor */}
      <section className="rounded-2xl border bg-black/90 overflow-hidden shadow-inner">
        <div className="p-3 text-slate-200 text-sm flex items-center gap-3">
          <span className="font-medium">Bedside Monitor</span>
          <span className="opacity-70">continuous stream</span>
        </div>
        <div className="px-3 pb-3">
          <canvas ref={canvasRef} className="w-full block rounded-xl" />
        </div>
      </section>
    </div>
  );
}

/** ---------- sub bits ---------- */

function TabBtn(props: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  const { active, onClick, children } = props;
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full border text-sm ${
        active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function CtlBtn(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = '', ...rest } = props;
  return (
    <button
      {...rest}
      className={`px-4 py-2 rounded-xl border shadow-sm bg-white hover:bg-slate-50 disabled:opacity-60 ${className}`}
    />
  );
}

function toast(msg: string) {
  // minimal, non-blocking cue
  try {
    console.log('[IoMT]', msg);
  } catch {}
}

function Tile({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold flex items-baseline gap-1" style={{ color }}>
        <span>{value}</span>
        {unit ? <span className="text-sm text-slate-500">{unit}</span> : null}
      </div>
    </div>
  );
}

function Tiles({ latest }: { latest: Vitals | null }) {
  const v = latest;
  return (
    <section className="grid gap-3 md:grid-cols-4">
      <Tile label="HR"      value={v ? String(v.hr) : '—'}      unit="bpm"  color={COLORS.hr} />
      <Tile label="SpO₂"    value={v ? String(v.spo2) : '—'}    unit="%"    color={COLORS.spo2} />
      <Tile label="SYS"     value={v ? String(v.sys) : '—'}     unit="mmHg" color={COLORS.sys} />
      <Tile label="DIA"     value={v ? String(v.dia) : '—'}     unit="mmHg" color={COLORS.dia} />
      <Tile label="MAP"     value={v ? String(v.map) : '—'}     unit="mmHg" color={COLORS.map} />
      <Tile label="RR"      value={v ? String(v.rr) : '—'}      unit="/min" color={COLORS.rr} />
      <Tile label="Temp"    value={v ? String(v.tempC) : '—'}   unit="°C"   color={COLORS.tempC} />
      <Tile label="Glucose" value={v ? String(v.glucose) : '—'} unit="mg/dL" color={COLORS.glucose} />
    </section>
  );
}
