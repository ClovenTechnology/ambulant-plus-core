// apps/patient-app/components/ChartCard.tsx
'use client';

import { Line } from 'react-chartjs-2';
import { ensureChartRegistration } from '@/lib/chart';
import { useEffect, useMemo, useRef, useState } from 'react';

type Sample = { t: number; hr: number; spo2: number };

export default function ChartCard() {
  ensureChartRegistration();
  const chartRef = useRef<any>(null);
  const [series, setSeries] = useState<Sample[]>(() => seed());

  // Fake streaming: append a point every 2s
  useEffect(() => {
    const id = setInterval(() => {
      setSeries((arr) => {
        const last = arr[arr.length - 1];
        const next: Sample = {
          t: (last?.t ?? Date.now()) + 2000,
          hr: clamp((last?.hr ?? 72) + (Math.random() * 4 - 2), 58, 102),
          spo2: clamp((last?.spo2 ?? 97) + (Math.random() * 1.5 - 0.7), 94, 99),
        };
        const out = [...arr.slice(-89), next]; // keep last ~90 points
        return out;
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const data = useMemo(() => {
    const labels = series.map((s) => new Date(s.t).toLocaleTimeString());
    return {
      labels,
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
    };
  }, [series]);

  const options = useMemo(
    () => ({
      responsive: true,
      animation: false,
      scales: {
        y: { beginAtZero: false, suggestedMin: 50, suggestedMax: 110, title: { display: true, text: 'HR (bpm)' } },
        y1: {
          position: 'right' as const,
          suggestedMin: 92,
          suggestedMax: 100,
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'SpO₂ (%)' },
        },
        x: { ticks: { maxRotation: 0 } },
      },
      plugins: { legend: { position: 'bottom' as const } },
    }),
    []
  );

  function exportPNG() {
    const chart = chartRef.current;
    if (!chart) return;
    const url = chart.toBase64Image();
    const a = document.createElement('a');
    a.href = url;
    a.download = `vitals_${new Date().toISOString()}.png`;
    a.click();
  }

  function exportCSV() {
    const rows = [['timestamp', 'heart_rate', 'spo2']];
    for (const s of series) {
      rows.push([new Date(s.t).toISOString(), s.hr.toFixed(0), s.spo2.toFixed(0)]);
    }
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vitals_${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-2xl border p-4 bg-white">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Live IoMT Vitals</h2>
        <div className="flex gap-2">
          <button onClick={exportPNG} className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm">
            Export PNG
          </button>
          <button onClick={exportCSV} className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm">
            Export CSV
          </button>
        </div>
      </div>
      <div className="mt-2">
        {/* @ts-ignore */}
        <Line ref={chartRef} data={data} options={options} />
      </div>
    </div>
  );
}

function seed(): Sample[] {
  const now = Date.now() - 180_000; // start 3 min ago
  const arr: Sample[] = [];
  let hr = 72;
  let spo2 = 97;
  for (let i = 0; i < 90; i++) {
    hr = clamp(hr + (Math.random() * 4 - 2), 60, 100);
    spo2 = clamp(spo2 + (Math.random() * 1.2 - 0.6), 94, 99);
    arr.push({ t: now + i * 2000, hr, spo2 });
  }
  return arr;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
