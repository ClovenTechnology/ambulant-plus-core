// apps/patient-app/components/charts/LiveVitals.tsx
"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { Line } from "react-chartjs-2";
import ChartRegistry from "../../lib/chartRegistry";

/**
 * LiveVitals - compact, configurable multi-channel micro-chart
 * - accepts a map of named channels; choose which channels to show via `channels` prop
 * - small height (default 72) suitable for card micro-charts
 * - gradients, last-point glow, external tooltip (same class .livev-tooltip)
 */

type ChannelMap = Record<string, number[]>; // e.g. { hr: [..], spo2: [..] }
type Colors = Record<string, string>;

interface Props {
  labels: string[];
  channels: ChannelMap;
  colors: Colors;
  show?: string[]; // which channel keys to render (defaults to all)
  height?: number;
  compact?: boolean; // slightly thinner styling
}

export default function LiveVitals({ labels, channels, colors, show, height = 72, compact = true }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // create tooltip container
  useEffect(() => {
    if (!containerRef.current) return;
    if (!tooltipRef.current) {
      const el = document.createElement("div");
      el.className = "livev-tooltip";
      Object.assign(el.style, {
        position: "absolute",
        pointerEvents: "none",
        transform: "translate(-50%, -120%)",
        background: "rgba(12,12,12,0.9)",
        color: "white",
        padding: "6px 8px",
        borderRadius: "8px",
        fontSize: "11px",
        fontWeight: "600",
        opacity: "0",
        zIndex: "800",
        transition: "opacity 120ms ease",
      });
      tooltipRef.current = el;
      containerRef.current.appendChild(el);
    }
    return () => {
      if (tooltipRef.current && containerRef.current) {
        containerRef.current.removeChild(tooltipRef.current);
        tooltipRef.current = null;
      }
    };
  }, []);

  const keys = useMemo(() => (show && show.length ? show : Object.keys(channels)), [channels, show]);

  const datasets = useMemo(() => {
    return keys.map((k) => {
      const data = channels[k] || [];
      const color = colors[k] || "#fff";
      return {
        label: k,
        data,
        borderColor: color,
        backgroundColor: (ctx: any) => {
          const chart = ctx.chart;
          const area = chart.chartArea;
          if (!area) return color;
          const g = ctx.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
          g.addColorStop(0, hexToRgba(color, 0.16));
          g.addColorStop(1, hexToRgba(color, 0.02));
          return g;
        },
        fill: "start",
        tension: 0.32,
        pointRadius: 0,
        borderWidth: compact ? 1.6 : 2,
      };
    });
  }, [keys, channels, colors, compact]);

  // plugin: small glow for last dataset's last point
  const lastGlow = useMemo(
    () => ({
      id: "livev_last_glow",
      afterDatasetsDraw: (chart: any) => {
        const ctx: CanvasRenderingContext2D = chart.ctx;
        for (let di = 0; di < chart.data.datasets.length; di++) {
          const meta = chart.getDatasetMeta(di);
          if (!meta || meta.data.length === 0) continue;
          const last = meta.data[meta.data.length - 1];
          if (!last) continue;
          const x = last.x;
          const y = last.y;
          ctx.save();
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(chart.data.datasets[di].borderColor, 0.12);
          ctx.fill();
          ctx.closePath();
          ctx.beginPath();
          ctx.arc(x, y, 2.6, 0, Math.PI * 2);
          ctx.fillStyle = chart.data.datasets[di].borderColor;
          ctx.fill();
          ctx.restore();
        }
      },
    }),
    []
  );

  const options = useMemo(
    () => ({
      animation: { duration: 160 },
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false,
          mode: "index",
          intersect: false,
          external: (ctx: any) => {
            const el = tooltipRef.current;
            if (!el) return;
            const tooltip = ctx.tooltip;
            if (tooltip.opacity === 0) {
              el.style.opacity = "0";
              return;
            }
            const idx = tooltip.dataPoints?.[0]?.dataIndex ?? -1;
            if (idx < 0) {
              el.style.opacity = "0";
              return;
            }
            const label = ctx.chart.data.labels[idx] ?? "";
            const lines: string[] = tooltip.dataPoints.map((dp: any) => `${dp.dataset.label}: ${dp.formattedValue ?? dp.parsed?.y ?? ""}`);
            el.innerHTML = `<div style="font-weight:700;margin-bottom:4px">${label}</div>${lines.map(l => `<div>${l}</div>`).join("")}`;
            const caretX = tooltip.caretX ?? 0;
            const caretY = tooltip.caretY ?? 0;
            el.style.left = `${caretX}px`;
            el.style.top = `${caretY}px`;
            el.style.opacity = "1";
          },
        },
      },
      scales: {
        x: { display: false },
        y: { display: false },
      },
      elements: {
        line: { borderCapStyle: "round", borderJoinStyle: "round" },
        point: { radius: 0 },
      },
      hover: { mode: "index", intersect: false },
    }),
    []
  );

  return (
    <div ref={containerRef} style={{ height }} className="relative">
      <Line
        data={{
          labels,
          datasets,
        }}
        options={options as any}
        plugins={[lastGlow]}
      />
    </div>
  );
}

/* ---------------- helpers ---------------- */

function hexToRgba(hex: string | undefined, alpha = 1) {
  if (!hex) return `rgba(255,255,255,${alpha})`;
  const h = hex.replace("#", "");
  let r = 0,
    g = 0,
    b = 0;
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
