'use client';

import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  ArcElement,
  Chart as ChartJS,
  Tooltip,
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip);

type WearableActivityRingsProps = {
  steps: number;
  stepsGoal: number;
  calories: number;
  caloriesGoal: number;
  distanceKm: number;
  distanceGoalKm: number;
};

export default function WearableActivityRings({
  steps,
  stepsGoal,
  calories,
  caloriesGoal,
  distanceKm,
  distanceGoalKm,
}: WearableActivityRingsProps) {
  const stepPct = Math.max(0, Math.min(1, stepsGoal > 0 ? steps / stepsGoal : 0));
  const calPct = Math.max(0, Math.min(1, caloriesGoal > 0 ? calories / caloriesGoal : 0));
  const distPct = Math.max(
    0,
    Math.min(1, distanceGoalKm > 0 ? distanceKm / distanceGoalKm : 0),
  );

  const data = useMemo(
    () => ({
      labels: ['Progress', 'Remaining'],
      datasets: [
        {
          data: [stepPct, 1 - stepPct],
          backgroundColor: ['#22c55e', 'rgba(34,197,94,0.16)'],
          borderWidth: 0,
          cutout: '72%',
          radius: '100%',
          rotation: -90,
          circumference: 360,
          borderRadius: 8,
        },
        {
          data: [calPct, 1 - calPct],
          backgroundColor: ['#fb923c', 'rgba(251,146,60,0.16)'],
          borderWidth: 0,
          cutout: '58%',
          radius: '84%',
          rotation: -90,
          circumference: 360,
          borderRadius: 8,
        },
        {
          data: [distPct, 1 - distPct],
          backgroundColor: ['#3b82f6', 'rgba(59,130,246,0.16)'],
          borderWidth: 0,
          cutout: '44%',
          radius: '68%',
          rotation: -90,
          circumference: 360,
          borderRadius: 8,
        },
      ],
    }),
    [stepPct, calPct, distPct],
  );

  const options: any = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
    }),
    [],
  );

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
      <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3">
        <div className="h-28">
          <Doughnut data={data} options={options} />
        </div>

        <div className="space-y-3">
          <MetricRow
            dotClass="bg-green-500"
            label="Steps"
            value={`${steps}`}
            goal={`${stepsGoal}`}
            unit="steps"
          />
          <MetricRow
            dotClass="bg-orange-400"
            label="Calories"
            value={`${calories}`}
            goal={`${caloriesGoal}`}
            unit="kcal"
          />
          <MetricRow
            dotClass="bg-blue-500"
            label="Distance"
            value={`${distanceKm.toFixed(1)}`}
            goal={`${distanceGoalKm.toFixed(1)}`}
            unit="km"
          />
        </div>
      </div>
    </div>
  );
}

function MetricRow(props: {
  dotClass: string;
  label: string;
  value: string;
  goal: string;
  unit: string;
}) {
  const { dotClass, label, value, goal, unit } = props;

  return (
    <div className="flex items-start gap-2">
      <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${dotClass}`} />
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-700">{label}</div>
        <div className="text-sm font-semibold text-slate-900">
          {value}
          <span className="ml-1 text-xs font-normal text-slate-500">
            / {goal} {unit}
          </span>
        </div>
      </div>
    </div>
  );
}