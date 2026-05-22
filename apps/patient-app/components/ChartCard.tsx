'use client';

import { Line } from 'react-chartjs-2';
import {
  ensureChartRegistration,
  type ChartInstance,
} from '@/lib/chart';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChartData, ChartOptions } from 'chart.js';

type Sample = { t: number; hr: number; spo2: number };

export default function ChartCard() {
  ensureChartRegistration();

  const chartRef = useRef<ChartInstance<'line'> | null>(null);

  // keep raw state ONLY (no derived objects in render loop)
  const [series, setSeries] = useState<Sample[]>(() => seed());

  /**
   * ZERO-RENDER STRATEGY:
   * we NEVER rebuild chart data objects inside render cycles
   * we only mutate series; chart updates via memoized data ref
   */

  useEffect(() => {
    const id = setInterval(() => {
      setSeries((arr) => {
        const last = arr[arr.length - 1];

        const next: Sample = {
          t: (last?.t ?? Date.now()) + 2000,
          hr: clamp((last?.hr ?? 72) + (Math.random() * 4 - 2), 58, 102),
          spo2: clamp((last?.spo2 ?? 97) + (Math.random() * 1.5 - 0.7), 94, 99),
        };

        return [...arr.slice(-89), next];
      });
    }, 2000);

    return () => clearInterval(id);
  }, []);

  /**
   * IMPORTANT: stable reference (prevents Chart.js full rebuild)
   */
  const data = useMemo<ChartData<'line'>>(() => ({
    labels: series.map((s) => new Date(s.t).toLocaleTimeString()),
    datasets: [
      {
        label: 'Heart Rate',
        data: series.map((s) => s.hr),
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 0,
      },
      {
        label: 'SpO₂',
        data: series.map((s) => s.spo2),
        yAxisID: 'y1',
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 0,
      },
    ],
  }), [series]);

  /**
   * ✅ FIX: explicitly typed ChartOptions
   * prevents TS "animation boolean mismatch"
   */
  const options = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true,

    // FIXED: correct Chart.js typing
    animation: {
      duration: 0,
    },

    maintainAspectRatio: false,

    parsing: false,

    normalized: true,

    scales: {
      y: {
        beginAtZero: false,
        suggestedMin: 50,
        suggestedMax: 110,
      },
      y1: {
        position: 'right',
        suggestedMin: 92,
        suggestedMax: 100,
        grid: { drawOnChartArea: false },
      },
      x: {
        ticks: { maxRotation: 0 },
      },
    },

    plugins: {
      legend: {
        position: 'bottom',
      },
    },
  }), []);

  function exportPNG() {
    const chart = chartRef.current;
    if (!chart) return;

    const url = chart.toBase64Image();
    const a = document.createElement('a');
    a.href = url;
    a.download = `vitals_${Date.now()}.png`;
    a.click();
  }

  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Live IoMT Vitals</h2>

        <button onClick={exportPNG}>Export PNG</button>
      </div>

      <div className="mt-2 h-[260px]">
        <Line
          ref={(instance) => {
            chartRef.current =
              instance as ChartInstance<'line'> | null;
          }}
          data={data}
          options={options}
        />
      </div>
    </div>
  );
}

function seed(): Sample[] {
  const now = Date.now() - 180_000;

  let hr = 72;
  let spo2 = 97;

  return Array.from({ length: 90 }).map((_, i) => {
    hr = clamp(hr + (Math.random() * 4 - 2), 60, 100);
    spo2 = clamp(spo2 + (Math.random() * 1.2 - 0.6), 94, 99);

    return {
      t: now + i * 2000,
      hr,
      spo2,
    };
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}