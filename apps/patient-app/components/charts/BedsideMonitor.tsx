// apps/patient-app/components/charts/BedsideMonitor.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Line } from "react-chartjs-2";
import ChartRegistry from "../../lib/chartRegistry"; // ensures Chart.js registers once
import type { ChartDataset } from "chart.js";

/**
 * BedsideMonitor
 * - multiple channels (HR, SpO2, SYS, DIA, MAP, RR, Temp, Glucose)
 * - soft gradient area fills
 * - glowing last-value marker
 * - external HTML tooltip (class .bedside-tooltip)
 */

type Colors = Record<string, string>;

interface Props {
  labels: string[];
  hr: number[];
  spo2: number[];
  sys: number[];
  dia: number[];
  mapv: number[];
  rr: number[];
  temp: number[];
  glucose: number[];
  colors: Colors;
  height?: number; // px
}

export default function BedsideMonitor({
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
  height = 420,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipDiv = useRef<HTMLDivElement | null>(null);

  // external tooltip element
  useEffect(() => {
    if (!containerRef.current) return;
    let el = tooltipDiv.current;
    if (!el) {
      el = document.createElement("div");
      el.className = "bedside-tooltip";
      // base inline styling; override in global CSS if you want exact Apple look
      Object.assign(el.style, {
        position: "absolute",
        pointerEvents: "none",
        transform: "translate(-50%, -120%)",
        background: "linear-gradient(180deg, rgba(20,20,20,0.95), rgba(10,10,10,0.9))",
        color: "white",
        padding: "8px 10px",
        borderRadius: "10px",
        fontSize: "12px",
        fontWeight: "600",
        whiteSpace: "nowrap",
        boxShadow: "0 8px 30px rgba(2,6,23,0.6)",
        opacity: "0",
        transition: "opacity 140ms ease, transform 140ms ease",
        zIndex: "1000",
      });
      tooltipDiv.current = el;
      containerRef.current.appendChild(el);
    }
    return () => {
      if (tooltipDiv.current && containerRef.current) {
        containerRef.current.removeChild(tooltipDiv.current);
        tooltipDiv.current = null;
      }
    };
  }, []);

  // helper to build gradient for fills
  const makeGradient = useCallback(
    (ctx: CanvasRenderingContext2D, area: { top: number; bottom: number }) => {
      const g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
      g.addColorStop(0, "rgba(255,255,255,0.08)");
      g.addColorStop(1, "rgba(255,255,255,0.02)");
      return g;
    },
    []
  );

  // datasets
  const datasets = useMemo(() => {
    const basic = (label: string, data: number[], color: string, fill = true, dash?: number[]) =>
      ({
        label,
        data,
        borderColor: color,
        backgroundColor: (ctx: any) => {
          const chart = ctx.chart;
          const area = chart.chartArea;
          if (!area) return color;
          // lighter area of the color
          const g = ctx.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
          g.addColorStop(0, hexToRgba(color, 0.18));
          g.addColorStop(1, hexToRgba(color, 0.02));
          return g;
        },
        fill: fill ? "start" : false,
        tension: 0.34,
        pointRadius: 0,
        borderWidth: 2.2,
        borderDash: dash ?? [],
        spanGaps: true,
      } as ChartDataset<"line">);
    return [
      basic("HR (bpm)", hr, colors.hr),
      basic("SpO₂ (%)", spo2, colors.spo2),
      basic("SYS (mmHg)", sys, colors.sys),
      basic("DIA (mmHg)", dia, colors.dia),
      basic("MAP (mmHg)", mapv, colors.map, false, [6, 4]),
      basic("RR (rpm)", rr, colors.rr),
      basic("Temp (°C)", temp, colors.temp),
      basic("Glucose (mg/dL)", glucose, colors.glucose),
    ];
  }, [hr, spo2, sys, dia, mapv, rr, temp, glucose, colors]);

  // plugin: draw glowing last point
  const lastPointPlugin = useMemo(
    () => ({
      id: "bedside_last_point_glow",
      afterDatasetsDraw: (chart: any) => {
        const ctx: CanvasRenderingContext2D = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        const datasetCount = chart.data.datasets.length;
        // draw for each visible dataset (small glow behind)
        for (let di = 0; di < datasetCount; di++) {
          const dsMeta = chart.getDatasetMeta(di);
          if (!dsMeta || !dsMeta.data || dsMeta.data.length === 0) continue;
          const lastIndex = dsMeta.data.length - 1;
          const pt = dsMeta.data[lastIndex];
          if (!pt) continue;
          const x = pt.x;
          const y = pt.y;
          const color = chart.data.datasets[di].borderColor || "rgba(255,255,255,0.9)";
          ctx.save();
          ctx.beginPath();
          ctx.arc(x, y, 9, 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(color, 0.12);
          ctx.fill();
          ctx.closePath();
          ctx.beginPath();
          ctx.arc(x, y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.restore();
        }
      },
    }),
    []
  );

  // options with external tooltip
  const options = useMemo(
    () => ({
      animation: { duration: 220 },
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: "top" as const, labels: { color: "#cbd5e1" } },
        tooltip: {
          enabled: false,
          mode: "index",
          intersect: false,
          external: (context: any) => {
            const tooltipEl = tooltipDiv.current;
            const chart = context.chart;
            if (!tooltipEl) return;
            const tooltipModel = context.tooltip;
            if (tooltipModel.opacity === 0) {
              tooltipEl.style.opacity = "0";
              return;
            }
            // Build tooltip content
            const idx = tooltipModel.dataPoints?.[0]?.dataIndex ?? -1;
            if (idx < 0) {
              tooltipEl.style.opacity = "0";
              return;
            }
            const label = chart.data.labels[idx] ?? "";
            // assemble multi-line with colored bullets
            const lines: string[] = [];
            tooltipModel.dataPoints.forEach((dp: any) => {
              const lab = dp.dataset.label ?? "";
              const val = dp.formattedValue ?? dp.parsed?.y ?? "";
              const color = dp.dataset.borderColor ?? "#fff";
              // use small colored dot + label
              lines.push(`${lab}: ${val}`);
            });
            tooltipEl.innerHTML = `<div style="font-weight:700;margin-bottom:4px">${label}</div>` + lines.map(l => `<div>${l}</div>`).join("");
            // position
            const canvasRect = chart.canvas.getBoundingClientRect();
            const caretX = tooltipModel.caretX ?? 0;
            const caretY = tooltipModel.caretY ?? 0;
            // position relative to container
            tooltipEl.style.left = `${caretX}px`;
            tooltipEl.style.top = `${caretY}px`;
            tooltipEl.style.opacity = "1";
            tooltipEl.style.transform = "translate(-50%, -120%)";
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#94a3b8", maxRotation: 0, autoSkip: true },
          grid: { color: "rgba(148,163,184,0.06)" },
        },
        y: {
          ticks: { color: "#94a3b8" },
          grid: { color: "rgba(148,163,184,0.06)" },
        },
      },
      elements: {
        line: { borderCapStyle: "round", borderJoinStyle: "round" },
        point: { radius: 0, hoverRadius: 5 },
      },
      hover: {
        mode: "index",
        intersect: false,
      },
    }),
    []
  );

  return (
    <div ref={containerRef} className="rounded-3xl border border-slate-800/40 bg-slate-900/80 shadow-xl p-4" style={{ position: "relative" }}>
      <div style={{ height }} className="relative">
        <Line data={{ labels, datasets }} options={options as any} plugins={[lastPointPlugin]} />
      </div>

      {/* optional: global style for tooltip if you want to override in CSS */}
      <style jsx>{`
        :global(.bedside-tooltip) {
          /* override default JS styles here if desired */
        }
      `}</style>
    </div>
  );
}

/* ---------------- helper ---------------- */

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
