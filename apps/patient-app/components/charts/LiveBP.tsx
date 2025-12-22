// apps/patient-app/components/charts/LiveBP.tsx
"use client";

import React, { useMemo } from "react";
import { Line } from "react-chartjs-2";
import ChartRegistry from "@/lib/chartRegistry"; // ensure registration

interface Props {
  labels: string[];
  sys: number[];
  dia: number[];
  map: number[];
}

export default function LiveBP({ labels, sys, dia, map }: Props) {
  const data = useMemo(
    () => ({
      labels,
      datasets: [
        { label: "SYS", data: sys, borderColor: "#FF6B6B", pointRadius: 0, tension: 0.25, borderWidth: 1.8 },
        { label: "DIA", data: dia, borderColor: "#F7B267", pointRadius: 0, tension: 0.25, borderWidth: 1.8 },
        { label: "MAP", data: map, borderColor: "#FFD93D", pointRadius: 0, tension: 0.25, borderDash: [6, 4], borderWidth: 1.4 },
      ],
    }),
    [labels, sys, dia, map]
  );

  const options = useMemo(
    () => ({
      animation: { duration: 0 },
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: {
        x: { display: false },
        y: {
          min: 40,
          max: 200,
          ticks: { color: "#94a3b8" },
          grid: { color: "rgba(148,163,184,0.06)" },
        },
      },
      elements: {
        line: { tension: 0.2, borderCapStyle: "round" },
      },
    }),
    []
  );

  return <Line data={data} options={options as any} />;
}
