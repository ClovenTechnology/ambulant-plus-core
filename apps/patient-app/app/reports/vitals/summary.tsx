'use client';

import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip, Legend
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function VitalsSummary() {
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/reports/vitals", { cache: "no-store" });
        const data = await res.json();
        setReport(data);
      } catch {
        setReport(null);
      }
    })();
  }, []);

  if (!report) return (
    <div className="text-gray-600 mt-4">Loading…</div>
  );

  const { summary, latest, trend } = report;

  const chartData = {
    labels: trend.map((t:any) => new Date(t.ts).toLocaleTimeString()),
    datasets: [
      {
        label: "Heart Rate",
        data: trend.map((t:any) => t.hr),
        borderColor: "rgb(239, 68, 68)", // red
      },
      {
        label: "SpO₂",
        data: trend.map((t:any) => t.spo2),
        borderColor: "rgb(34, 197, 94)", // green
      },
    ],
  };

  return (
    <section className="space-y-6">
      <section className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {Object.entries(summary).map(([k,v]) => (
          <div key={k} className="p-4 bg-white border rounded-lg">
            <div className="text-xs text-gray-500">{k}</div>
            <div className="text-xl font-semibold">{v}</div>
          </div>
        ))}
      </section>

      <section className="p-4 border rounded-lg bg-white">
        <h2 className="font-semibold mb-2">Trend</h2>
        <Line data={chartData} />
      </section>

      <section className="p-4 border rounded-lg bg-white">
        <h2 className="font-semibold mb-3">Latest Reading</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { k: 'ts', label: 'Timestamp' },
            { k: 'hr', label: 'Heart Rate', unit: 'bpm' },
            { k: 'spo2', label: 'SpO₂', unit: '%' },
            { k: 'temp_c', label: 'Temperature', unit: '°C' },
            { k: 'sys', label: 'Systolic', unit: 'mmHg' },
            { k: 'dia', label: 'Diastolic', unit: 'mmHg' },
            { k: 'bmi', label: 'BMI' },
          ].map(({k,label,unit}) => {
            const v = (latest as any)?.[k];
            const val = k === 'ts' && v ? new Date(v).toLocaleString() : (v ?? '—');
            return (
              <div key={k} className="p-3 border rounded-lg">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="text-lg font-semibold">
                  {val}{v != null && unit ? ` ${unit}` : ''}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}
