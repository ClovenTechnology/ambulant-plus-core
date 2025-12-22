// apps/patient-app/components/charts/Sparkline.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
  Filler,
  ChartOptions,
  ChartData,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip, Filler);

type MaybeNum = number | null | undefined;

type Props = {
  labels?: string[];
  values?: MaybeNum[];
  color?: string;
  height?: number;
  unit?: string;
  decimals?: number;
  tension?: number;
  maxPoints?: number;
  live?: boolean;
  showArea?: boolean;
  showLastValueBadge?: boolean;

  /** Optional redaction hook for discreet/sensitive modes */
  redactValues?: boolean;
};

export default function Sparkline({
  labels: initLabels = [],
  values: initValues = [],
  color = "#007AFF",
  height = 48,
  unit = "",
  decimals = 0,
  tension = 0.32,
  maxPoints = 40,
  live = false,
  showArea = true,
  showLastValueBadge = true,
  redactValues = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // defensive: ensure arrays
  const safeInitLabels = Array.isArray(initLabels) ? initLabels : [];
  const safeInitValues = Array.isArray(initValues) ? initValues : [];

  const [labels, setLabels] = useState<string[]>(() => [...safeInitLabels].slice(-maxPoints));
  const [values, setValues] = useState<MaybeNum[]>(() => [...safeInitValues].slice(-maxPoints));

  // Keep window size in sync when live / props change
  useEffect(() => {
    const incomingLabels = Array.isArray(initLabels) ? initLabels : [];
    const incomingValues = Array.isArray(initValues) ? initValues : [];

    if (!live) {
      setLabels([...incomingLabels].slice(-maxPoints));
      setValues([...incomingValues].slice(-maxPoints));
      return;
    }

    // live: append only when new timestamp appears
    const lastIncoming = incomingLabels[incomingLabels.length - 1];
    const lastKnown = labels[labels.length - 1];

    if (lastIncoming && lastIncoming !== lastKnown) {
      setLabels((prev) => [...prev, lastIncoming].slice(-maxPoints));
      setValues((prev) => {
        const lastVal = incomingValues[incomingValues.length - 1];
        const merged = [...prev, isFiniteNum(lastVal) ? lastVal : null].slice(-maxPoints);
        return merged;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initLabels, initValues, live, maxPoints]);

  // Tooltip div (external)
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    if (!tooltipRef.current) {
      const div = document.createElement("div");
      div.className = "sparkline-tooltip";
      Object.assign(div.style, {
        position: "absolute",
        pointerEvents: "none",
        whiteSpace: "pre-line",
        transform: "translate(-50%, -120%)",
        background: "rgba(2, 6, 23, 0.86)", // slate-950-ish
        color: "rgba(248,250,252,0.98)",
        padding: "6px 8px",
        borderRadius: "10px",
        border: "1px solid rgba(148,163,184,0.22)",
        fontSize: "12px",
        fontWeight: "650",
        letterSpacing: "0.01em",
        boxShadow: "0 18px 60px rgba(2,6,23,0.35)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        zIndex: "50",
        transition: "opacity 120ms ease, transform 120ms ease",
        opacity: "0",
      });
      tooltipRef.current = div;
      host.appendChild(div);
    }

    return () => {
      if (tooltipRef.current) {
        tooltipRef.current.remove();
        tooltipRef.current = null;
      }
    };
  }, []);

  const createGradient = useCallback(
    (ctx: CanvasRenderingContext2D, area: { top: number; bottom: number }) => {
      const g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
      g.addColorStop(0, `${hexToRgba(color, 0.16)}`);
      g.addColorStop(0.6, `${hexToRgba(color, 0.06)}`);
      g.addColorStop(1, `${hexToRgba(color, 0.0)}`);
      return g;
    },
    [color]
  );

  const slicedLabels = labels.slice(-maxPoints);
  const slicedValues = values.slice(-maxPoints);

  const numericSeries: (number | null)[] = useMemo(() => {
    // IMPORTANT: keep nulls so the line breaks (no fake 0s)
    return slicedValues.map((v) => (isFiniteNum(v) ? v : null));
  }, [slicedValues]);

  const hasAnyPoint = useMemo(() => numericSeries.some((v) => typeof v === "number"), [numericSeries]);
  const noData = slicedLabels.length === 0 || !hasAnyPoint;

  const lastValue = useMemo(() => {
    for (let i = numericSeries.length - 1; i >= 0; i--) {
      const v = numericSeries[i];
      if (typeof v === "number") return v;
    }
    return null;
  }, [numericSeries]);

  const data: ChartData<"line", (number | null)[], unknown> = useMemo(() => {
    return {
      labels: slicedLabels,
      datasets: [
        {
          label: "spark",
          data: numericSeries,
          borderColor: color,
          backgroundColor: (context: any) => {
            const chart = context.chart;
            const { chartArea } = chart;
            if (!chartArea) return undefined;
            return createGradient(chart.ctx, chartArea);
          },
          fill: showArea ? "start" : false,
          pointRadius: 0,
          tension,
          borderWidth: 2.1,
          spanGaps: false, // break on nulls
        },
      ],
    };
  }, [slicedLabels, numericSeries, color, createGradient, tension, showArea]);

  const options: ChartOptions<"line"> = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: live ? 0 : 260, easing: "easeOutCubic" },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false,
          external: (context) => {
            const tooltipEl = tooltipRef.current;
            const host = containerRef.current;
            const chart = context.chart;
            if (!tooltipEl || !host) return;

            const tooltipModel = context.tooltip;
            if (!tooltipModel || tooltipModel.opacity === 0) {
              tooltipEl.style.opacity = "0";
              return;
            }

            const idx = tooltipModel.dataPoints?.[0]?.dataIndex ?? -1;
            if (idx < 0) {
              tooltipEl.style.opacity = "0";
              return;
            }

            const label = String(chart.data.labels?.[idx] ?? "");
            const rawVal = (chart.data.datasets?.[0].data as (number | null)[])[idx] ?? null;

            const valStr = redactValues
              ? "—"
              : rawVal === null
                ? "—"
                : `${formatNumber(rawVal, decimals)}${unit ? ` ${unit}` : ""}`;

            tooltipEl.textContent = `${valStr}\n${label}`;

            // Correct positioning relative to container (not viewport)
            const canvasRect = chart.canvas.getBoundingClientRect();
            const hostRect = host.getBoundingClientRect();

            const caretX = tooltipModel.caretX ?? 0;
            const caretY = tooltipModel.caretY ?? 0;

            let x = (canvasRect.left - hostRect.left) + caretX;
            let y = (canvasRect.top - hostRect.top) + caretY;

            // clamp inside container
            const pad = 10;
            x = clamp(x, pad, hostRect.width - pad);
            y = clamp(y, pad, hostRect.height - pad);

            const preferAbove = y > 42;
            tooltipEl.style.left = `${x}px`;
            tooltipEl.style.top = `${y}px`;
            tooltipEl.style.opacity = "1";
            tooltipEl.style.transform = preferAbove ? "translate(-50%, -120%)" : "translate(-50%, 16px)";
          },
        },
      },
      scales: {
        x: { display: false },
        y: { display: false, beginAtZero: false, grid: { drawBorder: false, display: false } },
      },
      elements: {
        point: { radius: 0, hoverRadius: 4 },
        line: { tension, borderCapStyle: "round", borderJoinStyle: "round" },
      },
      interaction: { mode: "index", intersect: false },
    };
  }, [decimals, unit, tension, live, redactValues]);

  const plugins = useMemo(
    () => [
      {
        id: "lastPointGlow",
        afterDraw: (chart: any) => {
          if (!hasAnyPoint) return;
          const ctx: CanvasRenderingContext2D = chart.ctx;
          const meta = chart.getDatasetMeta(0);
          const pts = meta?.data ?? [];
          if (!pts.length) return;

          // find last rendered point (skipping nulls)
          let lastPoint = null as any;
          for (let i = pts.length - 1; i >= 0; i--) {
            const v = numericSeries[i];
            if (typeof v === "number") {
              lastPoint = pts[i];
              break;
            }
          }
          if (!lastPoint) return;

          const x = lastPoint.x;
          const y = lastPoint.y;

          ctx.save();
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(color, 0.14);
          ctx.fill();
          ctx.closePath();

          ctx.beginPath();
          ctx.arc(x, y, 3.1, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.restore();
        },
      },
    ],
    [hasAnyPoint, numericSeries, color]
  );

  if (noData) {
    return (
      <div
        ref={containerRef}
        style={{ position: "relative", height, width: "100%", userSelect: "none" }}
        className="rounded-xl"
      >
        <div className="w-full h-full rounded-xl bg-slate-200/60 dark:bg-slate-800/30 animate-pulse" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", height, width: "100%", userSelect: "none" }}
    >
      {showLastValueBadge ? (
        <div style={{ position: "absolute", right: 10, top: 8, zIndex: 5, pointerEvents: "none" }}>
          <div
            style={{
              background: "rgba(255,255,255,0.72)",
              border: "1px solid rgba(148,163,184,0.30)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              padding: "4px 9px",
              borderRadius: 999,
              boxShadow: "0 10px 30px rgba(2,6,23,0.10)",
              fontSize: 12,
              fontWeight: 750,
              color: "rgba(15,23,42,0.92)",
            }}
          >
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {redactValues ? "—" : lastValue === null ? "—" : `${formatNumber(lastValue, decimals)}${unit ? ` ${unit}` : ""}`}
            </span>
          </div>
        </div>
      ) : null}

      <Line data={data} options={options} plugins={plugins} />

      <style jsx>{`
        :global(.sparkline-tooltip) { /* override in global.css if desired */ }
      `}</style>
    </div>
  );
}

/* helpers */

function hexToRgba(hex: string, alpha = 1) {
  const h = (hex || "#000").replace("#", "");
  let r = 0, g = 0, b = 0;
  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16);
    g = parseInt(h[1] + h[1], 16);
    b = parseInt(h[2] + h[2], 16);
  } else {
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatNumber(n: number | null | undefined, decimals = 0) {
  if (n === null || n === undefined) return "";
  return Number(n).toFixed(decimals);
}

function isFiniteNum(v: any): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}
