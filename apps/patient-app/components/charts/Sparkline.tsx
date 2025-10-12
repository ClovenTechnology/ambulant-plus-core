"use client";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip,
} from "chart.js";
import React, { useMemo } from "react";
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

export default function Sparkline({ labels, values, color, height = 36 }: { labels: string[]; values: number[]; color: string; height?: number; }) {
  const data = useMemo(() => ({
    labels,
    datasets: [{ data: values, borderColor: color, pointRadius: 0, tension: 0.25 }]
  }), [labels, values, color]);

  const options = useMemo(() => ({
    animation: { duration: 0 },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false },
      y: { display: false },
    },
    elements: { line: { borderWidth: 2 } },
    maintainAspectRatio: false,
  }), []);

  return <div style={{ height }}><Line data={data} options={options} /></div>;
}
