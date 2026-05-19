'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

type VitalsReport = {
  summary?: Record<string, unknown>;
  latest?: Record<string, unknown>;
  trend?: Array<Record<string, unknown>>;
};

function formatValue(value: unknown): string {
  if (value == null) return '—';

  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)
      : '—';
  }

  if (typeof value === 'string') return value.trim() || '—';

  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '—' : value.toLocaleString();

  if (Array.isArray(value)) return value.length ? `${value.length} item${value.length === 1 ? '' : 's'}` : '—';

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '—';
    }
  }

  return String(value);
}

function toFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatTimestamp(value: unknown): string {
  if (!value) return '—';

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

export default function VitalsSummary() {
  const [report, setReport] = useState<VitalsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadVitalsReport() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/reports/vitals', { cache: 'no-store' });
        const data = (await res.json().catch(() => null)) as VitalsReport | null;

        if (cancelled) return;

        if (!res.ok || !data) {
          setReport(null);
          setError('Could not load vitals summary right now.');
          return;
        }

        setReport(data);
      } catch {
        if (!cancelled) {
          setReport(null);
          setError('Could not load vitals summary right now.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadVitalsReport();

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = report?.summary && typeof report.summary === 'object' ? report.summary : {};
  const latest = report?.latest && typeof report.latest === 'object' ? report.latest : {};
  const trend = Array.isArray(report?.trend) ? report.trend : [];

  const chartData = useMemo(() => {
    const labels = trend.map((point) => formatTimestamp(point.ts));

    return {
      labels,
      datasets: [
        {
          label: 'Heart Rate',
          data: trend.map((point) => toFiniteNumber(point.hr)),
          borderColor: 'rgb(239, 68, 68)',
          pointRadius: 0,
          tension: 0.25,
        },
        {
          label: 'SpO₂',
          data: trend.map((point) => toFiniteNumber(point.spo2)),
          borderColor: 'rgb(34, 197, 94)',
          pointRadius: 0,
          tension: 0.25,
        },
      ],
    };
  }, [trend]);

  if (loading) {
    return <div className="mt-4 text-gray-600">Loading…</div>;
  }

  if (error) {
    return <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</div>;
  }

  if (!report) {
    return <div className="mt-4 rounded-lg border bg-white p-4 text-sm text-gray-600">No vitals report is available yet.</div>;
  }

  return (
    <section className="space-y-6">
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Object.entries(summary).length > 0 ? (
          Object.entries(summary).map(([key, value]) => (
            <div key={key} className="rounded-lg border bg-white p-4">
              <div className="text-xs text-gray-500">{key}</div>
              <div className="text-xl font-semibold">{formatValue(value)}</div>
            </div>
          ))
        ) : (
          <div className="col-span-full rounded-lg border bg-white p-4 text-sm text-gray-600">
            No summary values are available yet.
          </div>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-2 font-semibold">Trend</h2>
        {trend.length > 0 ? (
          <Line data={chartData} />
        ) : (
          <div className="rounded-lg border border-dashed bg-gray-50 p-4 text-sm text-gray-600">
            No trend data is available yet.
          </div>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-semibold">Latest Reading</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { k: 'ts', label: 'Timestamp' },
            { k: 'hr', label: 'Heart Rate', unit: 'bpm' },
            { k: 'spo2', label: 'SpO₂', unit: '%' },
            { k: 'temp_c', label: 'Temperature', unit: '°C' },
            { k: 'sys', label: 'Systolic', unit: 'mmHg' },
            { k: 'dia', label: 'Diastolic', unit: 'mmHg' },
            { k: 'bmi', label: 'BMI' },
          ].map(({ k, label, unit }) => {
            const rawValue = latest[k];
            const value = k === 'ts' ? formatTimestamp(rawValue) : formatValue(rawValue);

            return (
              <div key={k} className="rounded-lg border p-3">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="text-lg font-semibold">
                  {value}
                  {rawValue != null && unit ? ` ${unit}` : ''}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}
