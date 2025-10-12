"use client";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip,
} from "chart.js";
import React, { useMemo } from "react";
ChartJS.register(ArcElement, Tooltip);

const CenterText = {
  id: "centerText",
  afterDraw(chart: any, _args: any, opts: any) {
    const { ctx, chartArea: { width, height } } = chart;
    ctx.save();
    ctx.font = `600 ${opts.fontSize || 18}px ui-sans-serif,system-ui`;
    ctx.fillStyle = opts.color || "#e2e8f0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(opts.text || "", width / 2, height / 2);
    ctx.restore();
  }
};

type Props = {
  value: number; // 0..100-ish for % meters; any scale is OK if you set max
  max?: number;
  label: string;
  color: string;
  unit?: string;
};

export default function MeterDonut({ value, max = 100, label, color, unit }: Props) {
  const pct = Math.max(0, Math.min(1, value / max));
  const data = useMemo(() => ({
    labels: [label],
    datasets: [{
      data: [pct, 1 - pct],
      backgroundColor: [color, "rgba(148,163,184,0.15)"],
      borderWidth: 0,
      hoverOffset: 0,
      cutout: "72%",
      circumference: 300,
      rotation: 210,
    }],
  }), [pct, color, label]);

  const options: any = useMemo(() => ({
    animation: { duration: 0 },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
      centerText: { text: `${Math.round(value)}${unit ?? ""}`, color: "#e2e8f0", fontSize: 18 }
    },
  }), [value, unit]);

  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur sci-glow">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="h-40">
        <Doughnut data={data} options={options} plugins={[CenterText]} />
      </div>
    </div>
  );
}
