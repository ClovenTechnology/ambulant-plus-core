'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { clamp, fmt, prettyTs, type Point, type Series } from '../_lib/charts-ui';

export type TrendOverlay =
  | {
      kind: 'sleep';
      startTs: string;
      endTs: string;
      label?: string;
    }
  | {
      kind: 'med';
      atTs: string;
      label: string;
      note?: string;
    };

type TrendChartProps = {
  series: Series;
  discreet: boolean;
  compare: boolean;
  overlays?: TrendOverlay[];
};

export default function TrendChart(props: TrendChartProps) {
  const { series, discreet, compare, overlays = [] } = props;
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [tip, setTip] = useState<{
    open: boolean;
    x: number;
    y: number;
    idx: number;
    t?: string;
    v?: number | null;
    cv?: number | null;
    xSvg?: number;
    ySvg?: number;
  }>({ open: false, x: 0, y: 0, idx: 0 });

  const points = series.points || [];
  const comparePoints = compare ? (series.comparePoints || []) : [];

  const allVals = useMemo(() => {
    const a = points.map((p) => p.v).filter((v): v is number => typeof v === 'number');
    const b = comparePoints.map((p) => p.v).filter((v): v is number => typeof v === 'number');
    const vals = [...a, ...b];
    if (!vals.length) return { min: 0, max: 1 };

    let min = vals[0];
    let max = vals[0];
    for (const v of vals) {
      if (v < min) min = v;
      if (v > max) max = v;
    }

    if (min === max) {
      min -= 1;
      max += 1;
    } else {
      const pad = (max - min) * 0.08;
      min -= pad;
      max += pad;
    }

    return { min, max };
  }, [points, comparePoints]);

  const width = 720;
  const height = 240;
  const padX = 18;
  const padY = 16;

  const timelineBounds = useMemo(() => {
    const ts = points
      .map((p) => Date.parse(p.t))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);

    if (!ts.length) return null;
    const minTs = ts[0];
    const maxTs = ts[ts.length - 1];
    return { minTs, maxTs: maxTs === minTs ? maxTs + 1 : maxTs };
  }, [points]);

  const toX = useCallback(
    (i: number, n: number) => {
      if (n <= 1) return padX;
      const t = i / (n - 1);
      return padX + t * (width - padX * 2);
    },
    [padX, width],
  );

  const toY = useCallback(
    (v: number) => {
      const t = (v - allVals.min) / (allVals.max - allVals.min);
      return height - padY - t * (height - padY * 2);
    },
    [allVals.max, allVals.min, height, padY],
  );

  const tsToX = useCallback(
    (ts: string) => {
      if (!timelineBounds) return null;
      const n = Date.parse(ts);
      if (!Number.isFinite(n)) return null;
      const t = clamp(
        (n - timelineBounds.minTs) / (timelineBounds.maxTs - timelineBounds.minTs),
        0,
        1,
      );
      return padX + t * (width - padX * 2);
    },
    [timelineBounds, padX, width],
  );

  const mainSegments = useMemo(() => buildLineSegments(points, toX, toY), [points, toX, toY]);
  const compareSegments = useMemo(
    () => (compare ? buildLineSegments(comparePoints, toX, toY) : []),
    [compare, comparePoints, toX, toY],
  );
  const areaSegments = useMemo(
    () => buildAreaSegments(points, toX, toY, height - padY),
    [points, toX, toY, height, padY],
  );

  const overlayBands = useMemo(() => {
    return overlays
      .filter((o): o is Extract<TrendOverlay, { kind: 'sleep' }> => o.kind === 'sleep')
      .map((o) => {
        const x1 = tsToX(o.startTs);
        const x2 = tsToX(o.endTs);
        if (x1 == null || x2 == null) return null;
        return {
          ...o,
          x: Math.min(x1, x2),
          w: Math.max(2, Math.abs(x2 - x1)),
        };
      })
      .filter(Boolean) as Array<{ kind: 'sleep'; startTs: string; endTs: string; label?: string; x: number; w: number }>;
  }, [overlays, tsToX]);

  const overlayMeds = useMemo(() => {
    return overlays
      .filter((o): o is Extract<TrendOverlay, { kind: 'med' }> => o.kind === 'med')
      .map((o) => {
        const x = tsToX(o.atTs);
        if (x == null) return null;
        return { ...o, x };
      })
      .filter(Boolean) as Array<{ kind: 'med'; atTs: string; label: string; note?: string; x: number }>;
  }, [overlays, tsToX]);

  const nearestNonNullIndex = useCallback(
    (idx: number) => {
      const n = points.length;
      if (!n) return 0;
      if (points[idx]?.v != null) return idx;

      for (let r = 1; r < n; r++) {
        const a = idx - r;
        const b = idx + r;
        if (a >= 0 && points[a]?.v != null) return a;
        if (b < n && points[b]?.v != null) return b;
      }
      return idx;
    },
    [points],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (discreet) return;

      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;

      const n = points.length;
      if (!n) return;
      const t = clamp(px / rect.width, 0, 1);
      const rawIdx = Math.round(t * (n - 1));
      const idx = nearestNonNullIndex(rawIdx);

      const p = points[idx];
      const cp = comparePoints[idx];

      const v = p?.v ?? null;
      const xSvg = toX(idx, n);
      const ySvg = v == null ? undefined : toY(v);

      setTip({
        open: true,
        x: e.clientX,
        y: e.clientY,
        idx,
        t: p?.t,
        v,
        cv: compare && cp ? (cp.v ?? null) : null,
        xSvg,
        ySvg,
      });
    },
    [compare, comparePoints, discreet, nearestNonNullIndex, points, toX, toY],
  );

  const onPointerLeave = useCallback(() => {
    setTip((t) => ({ ...t, open: false }));
  }, []);

  const axisTop = discreet ? `— ${series.unit}` : `${fmt(allVals.max)} ${series.unit}`;
  const axisBottom = discreet ? `— ${series.unit}` : `${fmt(allVals.min)} ${series.unit}`;

  return (
    <div ref={wrapRef} className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[240px] w-full rounded-2xl border bg-gradient-to-b from-white to-slate-50"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <GridLines width={width} height={height} />

        {overlayBands.map((band, i) => (
          <g key={`sleep-${i}`}>
            <rect
              x={band.x}
              y={0}
              width={band.w}
              height={height}
              fill="rgba(99,102,241,0.10)"
            />
            <text
              x={band.x + 6}
              y={14}
              fontSize="10"
              fill="rgba(79,70,229,0.85)"
            >
              {band.label || 'Sleep'}
            </text>
          </g>
        ))}

        {areaSegments.map((d, i) => (
          <path key={`a-${i}`} d={d} fill="rgba(15, 23, 42, 0.06)" stroke="none" />
        ))}

        {compareSegments.map((d, i) => (
          <path
            key={`c-${i}`}
            d={d}
            fill="none"
            stroke="rgba(15, 23, 42, 0.28)"
            strokeWidth="2"
            strokeDasharray="6 6"
          />
        ))}

        {mainSegments.map((d, i) => (
          <path
            key={`m-${i}`}
            d={d}
            fill="none"
            stroke="rgba(15, 23, 42, 0.92)"
            strokeWidth="2.5"
          />
        ))}

        {overlayMeds.map((m, i) => (
          <g key={`med-${i}`}>
            <line
              x1={m.x}
              y1={0}
              x2={m.x}
              y2={height}
              stroke="rgba(245,158,11,0.45)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <circle
              cx={m.x}
              cy={20}
              r={5}
              fill="rgba(245,158,11,0.95)"
              stroke="white"
              strokeWidth="2"
            />
            <text
              x={m.x + 8}
              y={24}
              fontSize="10"
              fill="rgba(180,83,9,0.95)"
            >
              {m.label}
            </text>
          </g>
        ))}

        {tip.open && tip.xSvg != null ? (
          <g>
            <line
              x1={tip.xSvg}
              y1={0}
              x2={tip.xSvg}
              y2={height}
              stroke="rgba(148,163,184,0.35)"
              strokeWidth="1"
            />
            {tip.ySvg != null ? (
              <circle
                cx={tip.xSvg}
                cy={tip.ySvg}
                r={4}
                fill="white"
                stroke="rgba(15,23,42,0.9)"
                strokeWidth="2"
              />
            ) : null}
          </g>
        ) : null}

        <text x={padX} y={12} fontSize="10" fill="rgba(100,116,139,0.9)">
          {axisTop}
        </text>
        <text x={padX} y={height - 6} fontSize="10" fill="rgba(100,116,139,0.9)">
          {axisBottom}
        </text>
      </svg>

      <SafeTooltip
        open={tip.open}
        x={tip.x}
        y={tip.y}
        content={
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-slate-700">{prettyTs(tip.t)}</div>
            <div className="text-[12px] font-semibold text-slate-900">
              {tip.v == null ? '—' : `${fmt(tip.v)} ${series.unit}`}
            </div>
            {compare && (
              <div className="text-[11px] text-slate-600">
                Prev:{' '}
                <span className="font-medium text-slate-800">
                  {tip.cv == null ? '—' : `${fmt(tip.cv)} ${series.unit}`}
                </span>
              </div>
            )}
            <div className="text-[10px] text-slate-400">Nulls are gaps (not zeros).</div>
          </div>
        }
      />
    </div>
  );
}

function buildLineSegments(
  points: Point[],
  toX: (i: number, n: number) => number,
  toY: (v: number) => number,
) {
  const n = points.length;
  const segs: string[] = [];
  let cur: Array<{ x: number; y: number }> = [];

  const flush = () => {
    if (cur.length >= 2) {
      const d = cur
        .map((p, i) =>
          i === 0 ? `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}` : `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`,
        )
        .join(' ');
      segs.push(d);
    }
    cur = [];
  };

  for (let i = 0; i < n; i++) {
    const v = points[i]?.v ?? null;
    if (v == null) {
      flush();
      continue;
    }
    cur.push({ x: toX(i, n), y: toY(v) });
  }
  flush();

  return segs;
}

function buildAreaSegments(
  points: Point[],
  toX: (i: number, n: number) => number,
  toY: (v: number) => number,
  baseY: number,
) {
  const n = points.length;
  const segs: string[] = [];
  let cur: Array<{ x: number; y: number }> = [];

  const flush = () => {
    if (cur.length >= 2) {
      const first = cur[0];
      const last = cur[cur.length - 1];
      const d =
        `M ${first.x.toFixed(2)} ${baseY.toFixed(2)} ` +
        cur.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') +
        ` L ${last.x.toFixed(2)} ${baseY.toFixed(2)} Z`;
      segs.push(d);
    }
    cur = [];
  };

  for (let i = 0; i < n; i++) {
    const v = points[i]?.v ?? null;
    if (v == null) {
      flush();
      continue;
    }
    cur.push({ x: toX(i, n), y: toY(v) });
  }
  flush();

  return segs;
}

function GridLines(props: { width: number; height: number }) {
  const { width, height } = props;
  const rows = 4;
  const cols = 6;

  const h: React.ReactNode[] = [];
  for (let i = 1; i <= rows; i++) {
    const y = (i / (rows + 1)) * height;
    h.push(
      <line
        key={`h-${i}`}
        x1={0}
        y1={y}
        x2={width}
        y2={y}
        stroke="rgba(148,163,184,0.22)"
        strokeWidth="1"
      />,
    );
  }

  const v: React.ReactNode[] = [];
  for (let i = 1; i <= cols; i++) {
    const x = (i / (cols + 1)) * width;
    v.push(
      <line
        key={`v-${i}`}
        x1={x}
        y1={0}
        x2={x}
        y2={height}
        stroke="rgba(148,163,184,0.18)"
        strokeWidth="1"
      />,
    );
  }

  return <g>{h}{v}</g>;
}

function SafeTooltip(props: {
  open: boolean;
  x: number;
  y: number;
  content: React.ReactNode;
}) {
  const { open, x, y, content } = props;
  if (!open) return null;

  const w = 240;
  const h = 110;
  const pad = 12;

  const vx = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vy = typeof window !== 'undefined' ? window.innerHeight : 720;

  const left = clamp(x + 14, pad, vx - w - pad);
  const top = clamp(y + 14, pad, vy - h - pad);

  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{ left, top, width: w }}
      role="presentation"
      aria-hidden="true"
    >
      <div className="rounded-2xl border bg-white px-3 py-2 shadow-lg">{content}</div>
    </div>
  );
}