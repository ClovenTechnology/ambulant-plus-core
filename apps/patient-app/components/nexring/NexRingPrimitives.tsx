'use client';

import React, { useRef } from 'react';
import {
  clamp,
  formatClock,
  normalizePoints,
} from '@/src/devices/nexring/nexring-view-model';

export function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function ActionButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'good' | 'bad' | 'muted';
}) {
  const toneMap = {
    good: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
    bad: 'bg-red-500/15 text-red-300 border-red-400/20',
    muted: 'bg-white/10 text-slate-200 border-white/10',
  };

  return (
    <div className={`rounded-full border px-3 py-1 text-xs font-medium ${toneMap[tone]}`}>
      {label}
    </div>
  );
}

export function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 break-all text-sm font-semibold text-slate-900">{value || '—'}</div>
    </div>
  );
}

export function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  tone: 'emerald' | 'orange' | 'violet' | 'cyan';
}) {
  const toneMap: Record<string, string> = {
    emerald: 'from-emerald-50 to-white text-emerald-700',
    orange: 'from-orange-50 to-white text-orange-700',
    violet: 'from-violet-50 to-white text-violet-700',
    cyan: 'from-cyan-50 to-white text-cyan-700',
  };

  return (
    <div className={`rounded-3xl border border-slate-200 bg-gradient-to-br p-4 ${toneMap[tone]}`}>
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 flex items-end gap-1">
        <div className="text-3xl font-semibold text-slate-900">{value}</div>
        <div className="pb-1 text-sm text-slate-500">{unit}</div>
      </div>
    </div>
  );
}

export function SummaryPanel({
  title,
  value,
  suffix,
  blurb,
}: {
  title: string;
  value: string;
  suffix: string;
  blurb: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <div className="mt-2 flex items-end gap-1">
        <div className="text-4xl font-semibold text-slate-900">{value}</div>
        <div className="pb-1 text-sm text-slate-500">{suffix}</div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{blurb}</p>
    </div>
  );
}

export function MetricHint({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

export function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

export function MiniStatGrid({
  stats,
}: {
  stats: Array<{ label: string; value: string; unit: string }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {stats.map((s) => (
        <MiniStat
          key={s.label}
          label={s.label}
          value={s.unit ? `${s.value} ${s.unit}` : s.value}
        />
      ))}
    </div>
  );
}

export function SleepBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value?: number;
  total: number;
  color: string;
}) {
  const pct =
    total > 0 && typeof value === 'number'
      ? Math.max(0, Math.min(100, (value / total) * 100))
      : 0;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span>{typeof value === 'number' ? `${Math.round(value)} min` : '—'}</span>
      </div>
      <div className="h-2.5 rounded-full bg-white/10">
        <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function LineHealthChart({
  points,
  valueSuffix,
  lineClassName,
  glowClassName,
  fillId,
  hoverIndex,
  onHoverIndexChange,
  minY,
  maxY,
  gradientFrom,
  gradientTo,
}: {
  points: Array<{ ts: number; value: number }>;
  valueSuffix: string;
  lineClassName: string;
  glowClassName: string;
  fillId: string;
  hoverIndex: number | null;
  onHoverIndexChange: (index: number | null) => void;
  minY: number;
  maxY: number;
  gradientFrom: string;
  gradientTo: string;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const width = 720;
  const height = 220;
  const padX = 12;
  const padTop = 14;
  const padBottom = 24;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;

  const normalized = normalizePoints(points, minY, maxY, innerW, innerH, padX, padTop);

  const path = normalized.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = normalized.length
    ? `${path} L ${normalized[normalized.length - 1].x} ${height - padBottom} L ${normalized[0].x} ${height - padBottom} Z`
    : '';

  const activePoint = hoverIndex != null ? normalized[hoverIndex] ?? null : null;

  function handleMove(clientX: number) {
    if (!svgRef.current || normalized.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < normalized.length; i += 1) {
      const dist = Math.abs(normalized[i].x - x);
      if (dist < best) {
        best = dist;
        nearest = i;
      }
    }
    onHoverIndexChange(nearest);
  }

  return (
    <div className="relative rounded-[24px] border border-white/10 bg-slate-950/20 p-2">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="h-52 w-full"
        onMouseLeave={() => onHoverIndexChange(null)}
        onMouseMove={(e) => handleMove(e.clientX)}
        onTouchMove={(e) => {
          const touch = e.touches[0];
          if (touch) handleMove(touch.clientX);
        }}
      >
        <defs>
          <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={gradientFrom} />
            <stop offset="100%" stopColor={gradientTo} />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padTop + innerH * ratio;
          return (
            <line
              key={ratio}
              x1={padX}
              x2={width - padX}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="4 6"
            />
          );
        })}

        {area ? <path d={area} fill={`url(#${fillId})`} /> : null}
        {path ? <path d={path} fill="none" className={glowClassName} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" /> : null}
        {path ? <path d={path} fill="none" className={lineClassName} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /> : null}

        {activePoint ? (
          <>
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={padTop}
              y2={height - padBottom}
              stroke="rgba(255,255,255,0.24)"
              strokeDasharray="4 4"
            />
            <circle cx={activePoint.x} cy={activePoint.y} r={6} fill="white" />
            <circle cx={activePoint.x} cy={activePoint.y} r={10} fill="rgba(255,255,255,0.18)" />
          </>
        ) : null}
      </svg>

      {activePoint ? (
        <div
          className="pointer-events-none absolute rounded-2xl border border-white/10 bg-slate-950/90 px-3 py-2 text-xs text-white shadow-2xl"
          style={{
            left: `${Math.max(8, Math.min(82, (activePoint.x / width) * 100))}%`,
            top: '10px',
            transform: 'translateX(-50%)',
          }}
        >
          <div className="font-semibold">
            {Math.round(activePoint.value)}
            {valueSuffix}
          </div>
          <div className="mt-1 text-slate-300">{formatClock(activePoint.ts)}</div>
        </div>
      ) : null}
    </div>
  );
}