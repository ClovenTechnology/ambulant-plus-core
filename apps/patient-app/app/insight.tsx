'use client';
import React from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import { Chart, LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, ArcElement } from 'chart.js';
Chart.register(LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, ArcElement);

export default function InsightCoreDashboard() {
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-3xl font-bold text-blue-900">ðŸ“Š InsightCoreâ„¢ Analytics</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MetricCard label="Live Consults" value="12" unit="active" />
        <MetricCard label="Avg HR (Today)" value="76" unit="bpm" />
        <MetricCard label="Adherence Score" value="89%" unit="" />
        <MetricCard label="Flagged Labs" value="5" unit="critical" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="bg-white rounded-xl p-4 shadow border">
          <h3 className="text-xl font-semibold text-purple-700 mb-2">ðŸ¦  Top Diagnoses</h3>
          <Doughnut
            data={{
              labels: ['Hypertension', 'Flu', 'Diabetes', 'STIs'],
              datasets: [{ data: [45, 25, 20, 10], backgroundColor: ['#7c3aed', '#38bdf8', '#22c55e', '#f97316'] }]
            }}
          />
        </div>

        <div className="bg-white rounded-xl p-4 shadow border">
          <h3 className="text-xl font-semibold text-purple-700 mb-2">ðŸ“ˆ Consults (Last 7 Days)</h3>
          <Line
            data={{
              labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
              datasets: [
                {
                  label: 'Consults',
                  data: [12, 17, 14, 20, 23, 21, 19],
                  backgroundColor: '#6366f1',
                  borderColor: '#6366f1',
                  tension: 0.3
                }
              ]
            }}
            options={{ responsive: true, plugins: { legend: { display: false } } }}
          />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border shadow-sm text-center">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-purple-800">
        {value} <span className="text-sm font-normal text-gray-400">{unit}</span>
      </p>
    </div>
  );
}
