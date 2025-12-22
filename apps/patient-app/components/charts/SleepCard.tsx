// apps/patient-app/components/charts/SleepCard.tsx
'use client';

import React, { useMemo, useId, useRef, useState, useCallback } from 'react';

/**
 * SleepCard
 * - Accepts flexible shapes:
 *   A) SleepDay: { sessions: [{ startISO, endISO, efficiency?, minutes?, bands: [{start,end,stage}] }], totals? }
 *   B) { stages: [{ start, end, stage }], efficiency? }
 *   C) { segments: [{ t, durMin, stage }], efficiency? }
 *   D) Array<{ start, end, stage }>
 *
 * Renders one hypnogram card per session (Oura/Apple-like):
 * - accurate minute tally
 * - merged bands (less jitter)
 * - hour grid
 * - hover scrub (stage + time)
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

function SleepSessionCard({ s }: { s: Session }) {
  const totalMin = Math.max(0, Math.round((s.end - s.start) / 60000));
  const hhmm = minutesToHhMm(totalMin);

  const startStr = formatClock(s.start);
  const endStr = formatClock(s.end);

  const pct = (m: number) => (totalMin ? Math.round((m / totalMin) * 100) : 0);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f172a]/70 p-4 sci-glow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-300">Sleep</div>
          <div className="mt-1 text-3xl font-semibold text-slate-50 tabular-nums">
            {hhmm.h}&nbsp;<span className="text-slate-300 text-xl">h</span>&nbsp;
            {hhmm.m}&nbsp;<span className="text-slate-300 text-xl">m</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {startStr} — {endStr}
          </div>
        </div>

        {/* Efficiency pill (simple “score-like” signal) */}
        <div className="shrink-0">
          <div className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur text-xs text-slate-200 tabular-nums">
            {Math.round(s.efficiency)}% <span className="text-slate-400">efficiency</span>
          </div>
        </div>
      </div>

      {/* Hypnogram */}
      <div className="mt-4">
        <Hypnogram bands={s.bands} start={s.start} end={s.end} />
      </div>

      {/* Stage summary (Apple/Oura vibe: compact, tabular, % shown) */}
      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
        <LegendRow label="Awake" color="#cbd5e1" valueMin={s.minutes.awake} pct={pct(s.minutes.awake)} />
        <LegendRow label="REM" color="#22d3ee" valueMin={s.minutes.rem} pct={pct(s.minutes.rem)} />
        <LegendRow label="Light" color="#60a5fa" valueMin={s.minutes.light} pct={pct(s.minutes.light)} />
        <LegendRow label="Deep" color="#3b82f6" valueMin={s.minutes.deep} pct={pct(s.minutes.deep)} />
      </div>
    </div>
  );
}

function Hypnogram({ bands, start, end }: { bands: Band[]; start: number; end: number }) {
  const uid = useId();
  const glowId = `sleep-glow-${uid}`;
  const bgId = `sleep-bg-${uid}`;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<null | { x: number; t: number; stage: Stage | null }>(null);

  const H = 96;
  const PADX = 10;
  const W = 560;
  const midY = H * 0.52;
  const total = Math.max(1, end - start);

  const STY: Record<Stage, { y: number; h: number; color: string; label: string }> = {
    awake: { y: midY - 34, h: 18, color: '#cbd5e1', label: 'Awake' },
    rem: { y: midY - 18, h: 16, color: '#22d3ee', label: 'REM' },
    light: { y: midY - 4, h: 14, color: '#60a5fa', label: 'Light' },
    deep: { y: midY + 18, h: 18, color: '#3b82f6', label: 'Deep' },
  };

  // Merge & clean bands for visual stability (Apple/Oura feel)
  const cleanBands = useMemo(() => {
    const merged = mergeBands(bands)
      .map((b) => ({
        start: clamp(b.start, start, end),
        end: clamp(b.end, start, end),
        stage: b.stage,
      }))
      .filter((b) => b.end > b.start);

    // Ensure coverage stays in range and sorted
    merged.sort((a, b) => a.start - b.start);
    return merged;
  }, [bands, start, end]);

  // Hour gridlines (subtle time discipline)
  const hourLines = useMemo(() => {
    const out: { x: number; label: string }[] = [];
    const startHour = nextWholeHour(start);
    for (let t = startHour; t < end; t += 60 * 60 * 1000) {
      const x = PADX + ((t - start) / total) * (W - PADX * 2);
      // label every 2 hours (avoid clutter)
      const label = shouldLabelHour(t, start) ? formatClock(t) : '';
      out.push({ x, label });
    }
    return out;
  }, [start, end, total]);

  const rects = useMemo(() => {
    return cleanBands.map((b, i) => {
      const x = PADX + ((b.start - start) / total) * (W - PADX * 2);
      const w = Math.max(2, ((b.end - b.start) / total) * (W - PADX * 2));
      const { y, h, color } = STY[b.stage];
      return (
        <rect
          key={i}
          x={x}
          y={y}
          width={w}
          height={h}
          rx={6}
          fill={color}
          opacity={0.92}
        />
      );
    });
  }, [cleanBands, start, total]);

  const stageAt = useCallback(
    (t: number): Stage | null => {
      // Bands count is typically small; linear scan is fine.
      for (let i = cleanBands.length - 1; i >= 0; i--) {
        const b = cleanBands[i];
        if (t >= b.start && t < b.end) return b.stage;
      }
      return null;
    },
    [cleanBands]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = clamp(e.clientX - r.left, 0, r.width);
      const ratio = r.width > 0 ? px / r.width : 0;
      const t = start + ratio * total;

      // Map to SVG x for cursor line
      const x = clamp(PADX + ratio * (W - PADX * 2), PADX, W - PADX);
      setHover({ x, t, stage: stageAt(t) });
    },
    [start, total, stageAt]
  );

  const onPointerLeave = useCallback(() => setHover(null), []);

  const hoverLabel = hover?.stage ? STY[hover.stage].label : '—';
  const hoverTime = hover ? formatClock(hover.t) : '';

  return (
    <div
      ref={containerRef}
      className="w-full relative select-none"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      {/* Tooltip pill (outside SVG, Apple-like frosted bubble) */}
      {hover ? (
        <div
          style={{
            position: 'absolute',
            left: `${(hover.x / W) * 100}%`,
            top: 6,
            transform: 'translate(-50%, 0)',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.72)',
              border: '1px solid rgba(148,163,184,0.28)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderRadius: 999,
              padding: '6px 10px',
              boxShadow: '0 10px 28px rgba(2,6,23,0.14)',
              color: 'rgba(15,23,42,0.92)',
              fontSize: 12,
              fontWeight: 750,
              lineHeight: 1.05,
              whiteSpace: 'nowrap',
            }}
          >
            <span className="tabular-nums">{hoverTime}</span>
            <span style={{ marginLeft: 8, fontWeight: 800 }}>{hoverLabel}</span>
          </div>
        </div>
      ) : null}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-24 rounded-xl border border-slate-800/40"
        aria-label="Sleep stages timeline"
      >
        <defs>
          <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0b1224" />
            <stop offset="100%" stopColor="#081023" />
          </linearGradient>

          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* background */}
        <rect x="0" y="0" width={W} height={H} rx="12" fill={`url(#${bgId})`} />

        {/* baseline */}
        <line x1={PADX} y1={midY} x2={W - PADX} y2={midY} stroke="white" strokeOpacity="0.06" />

        {/* hour grid */}
        {hourLines.map((h, i) => (
          <g key={i}>
            <line x1={h.x} y1={10} x2={h.x} y2={H - 14} stroke="white" strokeOpacity="0.06" strokeWidth={1} />
            {h.label ? (
              <text
                x={h.x}
                y={H - 4}
                textAnchor="middle"
                fontSize="9"
                fill="rgba(148,163,184,0.9)"
              >
                {h.label}
              </text>
            ) : null}
          </g>
        ))}

        {/* stages */}
        <g filter={`url(#${glowId})`}>{rects}</g>

        {/* hover cursor */}
        {hover ? (
          <line
            x1={hover.x}
            y1={8}
            x2={hover.x}
            y2={H - 8}
            stroke="rgba(255,255,255,0.28)"
            strokeWidth={1}
          />
        ) : null}
      </svg>

      {/* end labels (subtle) */}
      <div className="flex text-[10px] text-slate-400 justify-between mt-1">
        <span>{formatClock(start)}</span>
        <span>{formatClock(end)}</span>
      </div>
    </div>
  );
}

function LegendRow({ label, color, valueMin, pct }: { label: string; color: string; valueMin: number; pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-slate-300">{label}</span>
      <span className="ml-auto text-slate-400 tabular-nums">
        {minutesToText(valueMin)} {pct ? `${pct}%` : ''}
      </span>
    </div>
  );
}

/* -------------------- Normalization -------------------- */

function normalizeToSessions(input: any): Session[] {
  // A) SleepDay sessions
  if (Array.isArray(input?.sessions) && input.sessions.length) {
    return input.sessions
      .map((s: any) => {
        const start = toMs(s.startISO ?? s.start);
        const end = toMs(s.endISO ?? s.end);

        const rawBands: Band[] = (s.bands ?? s.stages ?? []).map((b: any) => ({
          start: toMs(b.start),
          end: toMs(b.end),
          stage: toStage(b.stage),
        }));

        const bands = mergeBands(rawBands).filter((b) => b.end > b.start);
        const minutes = s.minutes ?? tallyMinutes(bands);
        const eff =
          typeof s.efficiency === 'number'
            ? s.efficiency * (s.efficiency <= 1 ? 100 : 1)
            : estimateEfficiency(bands, start, end);

        return { start, end, bands, minutes, efficiency: eff };
      })
      .filter((s: Session) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start);
  }

  // B/C/D) flat arrays
  const raw =
    Array.isArray(input) ? input :
    Array.isArray(input?.stages) ? input.stages :
    Array.isArray(input?.segments) ? input.segments.map((seg: any) => ({
      start: toMs(seg.t),
      end: toMs(seg.t) + (seg.durMin ?? 1) * 60000,
      stage: seg.stage,
    })) :
    [];

  if (!raw.length) return [];

  const bands: Band[] = mergeBands(
    raw.map((r: any) => ({
      start: toMs(r.start),
      end: toMs(r.end),
      stage: toStage(r.stage),
    }))
  ).filter((b) => b.end > b.start);

  // Determine session boundaries from bands (more robust)
  const start = Math.min(...bands.map((b) => b.start));
  const end = Math.max(...bands.map((b) => b.end));

  const minutes = tallyMinutes(bands);
  const eff =
    typeof input?.efficiency === 'number'
      ? input.efficiency * (input.efficiency <= 1 ? 100 : 1)
      : estimateEfficiency(bands, start, end);

  return [{ start, end, bands, minutes, efficiency: eff }];
}

/** Accurate tally: sum ms per stage, then round minutes */
function tallyMinutes(bands: Band[]) {
  const ms = { awake: 0, rem: 0, light: 0, deep: 0 } as Record<Stage, number>;
  for (const b of bands) {
    const dur = Math.max(0, b.end - b.start);
    ms[b.stage] += dur;
  }
  return {
    awake: Math.round(ms.awake / 60000),
    rem: Math.round(ms.rem / 60000),
    light: Math.round(ms.light / 60000),
    deep: Math.round(ms.deep / 60000),
  };
}

function estimateEfficiency(bands: Band[], start: number, end: number) {
  const total = Math.max(1, end - start);
  const awakeMs = bands.filter((b) => b.stage === 'awake').reduce((a, b) => a + (b.end - b.start), 0);
  return ((total - awakeMs) / total) * 100;
}

function toStage(x: any): Stage {
  const s = String(x ?? '').toLowerCase();
  if (s.startsWith('aw')) return 'awake';
  if (s.startsWith('re')) return 'rem';
  if (s.startsWith('de')) return 'deep';
  return 'light';
}

/** Merge consecutive same-stage segments + sort */
function mergeBands(input: Band[]) {
  const arr = [...(input ?? [])]
    .filter((b) => b && Number.isFinite(b.start) && Number.isFinite(b.end))
    .sort((a, b) => a.start - b.start);

  const out: Band[] = [];
  for (const b of arr) {
    const stage = toStage(b.stage);
    const start = b.start;
    const end = b.end;
    if (!(end > start)) continue;

    const last = out[out.length - 1];
    if (last && last.stage === stage && start <= last.end + 1000) {
      // merge tiny gaps <= 1s
      last.end = Math.max(last.end, end);
    } else {
      out.push({ start, end, stage });
    }
  }
  return out;
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
  const parts: string[] = [];
  if (h) parts.push(`${h} h`);
  parts.push(`${m} m`);
  return parts.join(' ');
}

function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}

function formatClock(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function nextWholeHour(ms: number) {
  const d = new Date(ms);
  d.setMinutes(0, 0, 0);
  const base = d.getTime();
  return base <= ms ? base + 60 * 60 * 1000 : base;
}

function shouldLabelHour(hourMs: number, startMs: number) {
  // label every 2 hours relative to start hour
  const h0 = new Date(startMs).getHours();
  const h = new Date(hourMs).getHours();
  const diff = (h - h0 + 24) % 24;
  return diff % 2 === 0;
}
