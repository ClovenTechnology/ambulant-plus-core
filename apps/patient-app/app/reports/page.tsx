// apps/patient-app/app/reports/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  HeartPulse,
  Moon,
  Activity,
  Brain,
  Download,
  Share2,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { generateHealthReport } from '@/src/analytics/report';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const REPORTS = [
  {
    href: '/reports/vitals',
    label: 'Vitals Report',
    desc: 'Blood pressure, heart rate, ECG, SpO₂, temperature, glucose',
    icon: HeartPulse,
    color: 'bg-red-500',
  },
  {
    href: '/reports/sleep',
    label: 'Sleep Report',
    desc: 'Sleep stages, efficiency, readiness, HR/HRV overnight',
    icon: Moon,
    color: 'bg-blue-500',
  },
  {
    href: '/reports/fertility',
    label: 'Fertility Report',
    desc: 'Cycle phase, ovulation prediction, temperature variation',
    icon: Activity,
    color: 'bg-pink-500',
  },
  {
    href: '/reports/stress',
    label: 'Stress & HRV Report',
    desc: 'Daytime stress index, HRV metrics, recovery trends',
    icon: Brain,
    color: 'bg-green-500',
  },
];

// Map IoMT data sources
const METRIC_SOURCES: Record<string, string> = {
  hr: 'NexRing',
  spo2: 'Health Monitor',
  temp_c: 'Health Monitor',
  sys: 'Health Monitor',
  dia: 'Health Monitor',
  glucose: 'DueCare CGM',
  bmi: 'DueCare Smart Scale',
};

export default function ReportsHub() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function fetchData() {
    try {
      const res = await fetch('/api/reports/vitals', { cache: 'no-store' });
      const data = await res.json();
      setReport(data);
    } catch {
      setReport(null);
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000); // refresh every 1 min
    return () => clearInterval(interval);
  }, []);

  const { summary, latest, trend } = report || {
    summary: {},
    latest: {},
    trend: [],
  };

  const chartData = {
    labels: trend.map((t: any) => new Date(t.ts).toLocaleTimeString()),
    datasets: [
      { label: 'Heart Rate (bpm)', data: trend.map((t: any) => t.hr), borderColor: '#ef4444' },
      { label: 'SpO₂ (%)', data: trend.map((t: any) => t.spo2), borderColor: '#22c55e' },
      { label: 'Temperature (°C)', data: trend.map((t: any) => t.temp_c), borderColor: '#3b82f6' },
      { label: 'Systolic BP (mmHg)', data: trend.map((t: any) => t.sys), borderColor: '#f97316' },
      { label: 'Diastolic BP (mmHg)', data: trend.map((t: any) => t.dia), borderColor: '#eab308' },
      { label: 'Glucose (mg/dL)', data: trend.map((t: any) => t.glucose), borderColor: '#8b5cf6' },
    ],
  };

  async function handleDownload() {
    setLoading(true);
    try {
      const { blob } = await generateHealthReport('current-user', {});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'health_report.pdf';
      link.click();
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    setLoading(true);
    try {
      const { blob } = await generateHealthReport('current-user', {});
      const file = new File([blob], 'health_report.pdf', { type: 'application/pdf' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'Health Report',
          text: 'Here is my latest health report.',
          files: [file],
        });
      } else {
        alert('Sharing is not supported on this device/browser.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-6xl mx-auto p-8 space-y-10">
      {/* New Reports Hub */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Reports</h1>
            <p className="text-gray-600 mt-1">
              Generate and preview your personalized health reports. Each section includes history, charts, and insights.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {loading ? 'Preparing…' : 'Download PDF'}
            </button>
            <button
              onClick={handleShare}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {REPORTS.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="flex flex-col rounded-xl border shadow-sm hover:shadow-md transition overflow-hidden"
            >
              <div className="flex items-center gap-4 p-6">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg text-white ${r.color}`}>
                  <r.icon className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{r.label}</h2>
                  <p className="text-sm text-gray-500">{r.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Vitals Summary + Trend + Latest */}
      <section className="p-6 bg-white border rounded-xl shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Vitals Summary</h2>
          <a href="/reports/print" className="px-3 py-2 border rounded bg-gray-50 hover:bg-gray-100">
            Print Summary
          </a>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Object.entries(summary || {}).map(([k, v]) => (
            <div key={k} className="p-4 bg-gray-50 border rounded-lg flex flex-col justify-between">
              <div className="text-xs text-gray-400">Last updated: {new Date(latest?.ts).toLocaleTimeString()}</div>
              <div>
                <div className="text-xs text-gray-500">{k}</div>
                <div className="text-xl font-semibold">{v}</div>
              </div>
              <div className="text-[10px] text-gray-400 mt-1">
                Source: {METRIC_SOURCES[k] || '—'}
              </div>
            </div>
          ))}
        </div>

        {/* Trend */}
        {trend.length > 0 && (
          <div className="p-4 border rounded-lg bg-gray-50">
            <h3 className="font-semibold mb-2">Trend</h3>
            <Line data={chartData} />
          </div>
        )}

        {/* Latest Reading */}
        <div className="p-4 border rounded-lg bg-gray-50">
          <h3 className="font-semibold mb-3">Latest Reading - {latest?.ts && new Date(latest.ts).toLocaleString()}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { k: 'hr', label: 'Heart Rate', unit: 'bpm' },
              { k: 'spo2', label: 'SpO₂', unit: '%' },
              { k: 'temp_c', label: 'Temperature', unit: '°C' },
              { k: 'sys', label: 'Systolic', unit: 'mmHg' },
              { k: 'dia', label: 'Diastolic', unit: 'mmHg' },
              { k: 'glucose', label: 'Glucose', unit: 'mg/dL' },
              { k: 'bmi', label: 'BMI' },
            ].map(({ k, label, unit }) => {
              const v = (latest as any)?.[k];
              return (
                <div key={k} className="p-3 border rounded-lg bg-white flex flex-col justify-between">
                  <div className="text-xs text-gray-400">Last updated: {latest?.ts ? new Date(latest.ts).toLocaleTimeString() : '—'}</div>
                  <div>
                    <div className="text-xs text-gray-500">{label}</div>
                    <div className="text-lg font-semibold">
                      {v ?? '—'}
                      {v != null && unit ? ` ${unit}` : ''}
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">Source: {METRIC_SOURCES[k] || '—'}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
