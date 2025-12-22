// apps/medreach/components/ChartSample.tsx
'use client';

import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from 'chart.js';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

type ChartSampleProps = {
  labels?: string[];
  values?: number[];
  title?: string;
};

export default function ChartSample({
  labels = [],
  values = [],
  title = 'Orders',
}: ChartSampleProps) {
  const safeLabels = Array.isArray(labels) ? labels : [];
  const safeValues = Array.isArray(values) ? values : [];
  const paddedValues =
    safeValues.length === safeLabels.length
      ? safeValues
      : safeLabels.map((_, idx) => safeValues[idx] ?? 0);

  const data = {
    labels: safeLabels,
    datasets: [
      {
        label: 'Orders',
        data: paddedValues,
        backgroundColor: 'rgba(99, 102, 241, 0.6)',
      },
    ],
  };

  return (
    <div className="bg-white p-6 border rounded-xl shadow-sm">
      <h4 className="text-sm font-medium text-gray-500 mb-2">{title}</h4>
      <Bar data={data} />
    </div>
  );
}
