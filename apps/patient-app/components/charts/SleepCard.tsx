'use client';

import React, { useMemo } from 'react';

/**
 * SleepCard
 * - Accepts flexible shapes:
 *   A) SleepDay: { sessions: [{ startISO, endISO, efficiency?, minutes?, bands: [{start,end,stage}] }], totals? }
 *   B) { stages: [{ start, end, stage }], efficiency? }
 *   C) { segments: [{ t, durMin, stage }], efficiency? }
 *   D) Array<{ start, end, stage }>
 *
 * Renders one NexRing-style hypnogram card per session.
 */

type Stage = 'awake' | 'rem' | 'light' | 'deep';

type Band = { start: number; end: number; stage: Stage };
type Session = {
  start: number;      // ms
  end: number;        // ms
  efficiency: number; // 0..100
  bands: Band[];
  minutes: { awake: number; rem: number; light: number; deep: number };
};

export default function SleepCard({ sleep }: { sleep: any }) {
  const sessions = useMemo(() => normalizeToSessions(sleep), [sleep]);

  if (!sessions.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
        <div className="text-sm text-slate-300">Sleep</div>
        <div className="text-slate-300 text-xs mt-2">No sleep data</div>
      </div>
    );
  }

  return (
    <>
      {sessions.map((s, idx) => (
        <SleepSessionCard key={idx} s={s} />
      ))}
    </>
  );
}

/* -------------------- Session Card -------------------- */

function SleepSessionCard({ s }: { s: Session }) {
  const totalMin = Math.round((s.end - s.start) / 60000);
  const hhmm = minutesToHhMm(totalMin);
  const startStr = new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endStr = new Date(s.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const pct = (m: number) => (totalMin ? Math.round((m / totalMin) * 100) : 0);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f172a]/70 p-4 sci-glow">
      {/* Header */}
      <div className="text-sm text-slate-300">Sleep time</div>
      <div className="mt-1 text-3xl font-semibold text-slate-50 tabular-nums">
        {hhmm.h}&nbsp;<span className="text-slate-300 text-xl">h</span>&nbsp;
        {hhmm.m}&nbsp;<span className="text-slate-300 text-xl">m</span>
      </div>
      <div className="text-xs text-slate-400 mt-1">{startStr} — {endStr}</div>
      <div className="text-xs text-emerald-300 mt-1">
        Total duration {minutesToText(totalMin)}, {Math.round(s.efficiency)}% efficiency
      </div>

      {/* Hypnogram */}
      <div className="mt-4">
        <Hypnogram bands={s.bands} start={s.start} end={s.end} />
        <div className="flex text-[10px] text-slate-400 justify-between mt-1">
          <span>{startStr}</span>
          <span>{endStr}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
        <LegendRow label="Awake"  color="#cbd5e1" valueMin={s.minutes.awake}  pct={pct(s.minutes.awake)} />
        <LegendRow label="REM"    color="#22d3ee" valueMin={s.minutes.rem}    pct={pct(s.minutes.rem)} />
        <LegendRow label="Light"  color="#60a5fa" valueMin={s.minutes.light}  pct={pct(s.minutes.light)} />
        <LegendRow label="Deep"   color="#3b82f6" valueMin={s.minutes.deep}   pct={pct(s.minutes.deep)} />
      </div>
    </div>
  );
}

/* -------------------- Hypnogram (NexRing-style) -------------------- */

function Hypnogram({ bands, start, end }: { bands: Band[]; start: number; end: number }) {
  // SVG dims
  const H = 96;                // total height
  const PADX = 8;              // left/right padding
  const W = 560;               // logical width; will scale to container width
  const midY = H * 0.52;       // thin baseline
  const total = Math.max(1, end - start);

  // Map stage -> y position & bar height (awake high, deep low)
  const STY: Record<Stage, { y: number; h: number; color: string }> = {
    awake: { y: midY - 34, h: 18, color: '#cbd5e1' },  // slate-300
    rem:   { y: midY - 18, h: 16, color: '#22d3ee' },  // cyan-400
    light: { y: midY - 4,  h: 14, color: '#60a5fa' },  // blue-400
    deep:  { y: midY + 18, h: 18, color: '#3b82f6' },  // blue-600
  };

  // Build rects for each segment; small rounding makes it premium
  const rects = bands.map((b, i) => {
    const x = PADX + ((b.start - start) / total) * (W - PADX * 2);
    const w = Math.max(2, ((b.end - b.start) / total) * (W - PADX * 2));
    const { y, h, color } = STY[b.stage];
    return <rect key={i} x={x} y={y} width={w} height={h} rx={4} fill={color} opacity={0.9} />;
  });

  // Vertical “transition ticks” at stage changes (subtle)
  const ticks: number[] = [];
  for (let i = 1; i < bands.length; i++) {
    if (bands[i].stage !== bands[i - 1].stage) ticks.push(bands[i].start);
  }
  const tickEls = ticks.map((t, i) => {
    const x = PADX + ((t - start) / total) * (W - PADX * 2);
    return <line key={i} x1={x} y1={10} x2={x} y2={H - 10} stroke="white" strokeOpacity="0.07" strokeWidth={1} />;
  });

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24 rounded-xl border border-slate-800/40 bg-[#0b1224]">
        {/* glow */}
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* baseline */}
        <line x1={PADX} y1={midY} x2={W - PADX} y2={midY} stroke="white" strokeOpacity="0.08" />

        {/* transition ticks */}
        {tickEls}

        {/* bars */}
        <g filter="url(#glow)">{rects}</g>
      </svg>
    </div>
  );
}

/* -------------------- Legend row -------------------- */

function LegendRow({ label, color, valueMin, pct }: { label: string; color: string; valueMin: number; pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-slate-300">{label}</span>
      <span className="ml-auto text-slate-400">
        {minutesToText(valueMin)} {pct ? `${pct}%` : ''}
      </span>
    </div>
  );
}

/* -------------------- Normalization -------------------- */

function normalizeToSessions(input: any): Session[] {
  // Case: SleepDay with sessions
  if (Array.isArray(input?.sessions) && input.sessions.length) {
    return input.sessions.map((s: any) => {
      const start = toMs(s.startISO ?? s.start);
      const end = toMs(s.endISO ?? s.end);
      const bands: Band[] = (s.bands ?? s.stages ?? []).map((b: any) => ({
        start: toMs(b.start),
        end: toMs(b.end),
        stage: toStage(b.stage),
      }));
      const minutes = s.minutes ?? tallyMinutes(bands);
      const eff = typeof s.efficiency === 'number' ? s.efficiency * (s.efficiency <= 1 ? 100 : 1) // allow 0..1 or %
                                                  : estimateEfficiency(bands, start, end);
      return { start, end, bands, minutes, efficiency: eff };
    });
  }

  // Case: flat arrays or {stages}/ {segments}
  const raw =
    Array.isArray(input) ? input :
    Array.isArray(input?.stages) ? input.stages :
    Array.isArray(input?.segments) ? input.segments.map((s: any) => ({
      start: toMs(s.t),
      end: toMs(s.t) + (s.durMin ?? 1) * 60000,
      stage: s.stage,
    })) :
    [];

  const start = raw.length ? toMs(raw[0].start) : Date.now();
  const end   = raw.length ? toMs(raw[raw.length - 1].end) : start;
  const bands: Band[] = raw.map((r: any) => ({
    start: toMs(r.start),
    end: toMs(r.end),
    stage: toStage(r.stage),
  }));
  const minutes = tallyMinutes(bands);
  const eff = typeof input?.efficiency === 'number'
    ? input.efficiency * (input.efficiency <= 1 ? 100 : 1)
    : estimateEfficiency(bands, start, end);

  return bands.length ? [{ start, end, bands, minutes, efficiency: eff }] : [];
}

function tallyMinutes(bands: Band[]) {
  const out = { awake: 0, rem: 0, light: 0, deep: 0 } as Record<Stage, number>;
  for (const b of bands) out[b.stage] += Math.max(1, Math.round((b.end - b.start) / 60000));
  return out;
}

function estimateEfficiency(bands: Band[], start: number, end: number) {
  const total = Math.max(1, end - start);
  const awakeMs = bands.filter(b => b.stage === 'awake').reduce((a, b) => a + (b.end - b.start), 0);
  return ((total - awakeMs) / total) * 100;
}

function toStage(x: any): Stage {
  const s = String(x ?? '').toLowerCase();
  if (s.startsWith('aw')) return 'awake';
  if (s.startsWith('re')) return 'rem';
  if (s.startsWith('de')) return 'deep';
  return 'light';
}

/* -------------------- Small helpers -------------------- */

function toMs(x: number | string) {
  if (typeof x === 'number') return x > 1e12 ? x : x * 1000;
  const n = Date.parse(x);
  return Number.isFinite(n) ? n : Date.now();
}
function minutesToHhMm(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return { h, m };
}
function minutesToText(min: number) {
  const { h, m } = minutesToHhMm(min);
  const parts = [];
  if (h) parts.push(`${h} h`);
  parts.push(`${m} m`);
  return parts.join(' ');
}
