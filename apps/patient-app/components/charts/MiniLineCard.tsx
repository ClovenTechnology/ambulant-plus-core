"use client";
import React from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend,
} from "chart.js";
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function MiniLineCard({
  title, unit, labels, values, color, min, max, flagText,
}: {
  title: string; unit?: string; labels: string[]; values: number[]; color: string; min?: number; max?: number; flagText?: string;
}) {
  const data = {
    labels,
    datasets: [{ label: title, data: values, borderColor: color, pointRadius: 0, tension: 0.25 }],
  };
  const options: any = {
    animation: { duration: 0 },
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      x: { display: false },
      y: { min, max, ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.08)" } },
    },
    maintainAspectRatio: false,
  };
  const latest = values.length ? values[values.length - 1] : undefined;

  return (
    <div className={`relative rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur sci-glow ${flagText ? "sci-flag" : ""}`}>
      <div className="flex items-baseline justify-between">
        <div className="text-xs text-slate-400">{title}</div>
        <div className="text-sm font-semibold text-slate-200">{latest !== undefined ? `${latest}${unit ?? ""}` : "—"}</div>
      </div>
      {flagText ? <div className="mt-1 text-[10px] text-rose-300/90">{flagText}</div> : null}
      <div className="h-28 mt-2">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
