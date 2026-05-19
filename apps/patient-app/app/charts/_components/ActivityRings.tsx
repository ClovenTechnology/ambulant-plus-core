'use client';

import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  ArcElement,
  Chart as ChartJS,
  Tooltip,
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip);

type ActivityRingsProps = {
  steps: number;
  stepsGoal: number;
  calories: number;
  caloriesGoal: number;
  distanceKm: number;
  distanceGoalKm: number;
  discreet?: boolean;
};

export default function ActivityRings(props: ActivityRingsProps) {
  const {
    steps,
    stepsGoal,
    calories,
    caloriesGoal,
    distanceKm,
    distanceGoalKm,
    discreet = false,
  } = props;

  const stepPct = clampPct(stepsGoal > 0 ? steps / stepsGoal : 0);
  const calPct = clampPct(caloriesGoal > 0 ? calories / caloriesGoal : 0);
  const distPct = clampPct(distanceGoalKm > 0 ? distanceKm / distanceGoalKm : 0);

  const data = useMemo(
    () => ({
      labels: ['Progress', 'Remaining'],
      datasets: [
        {
          data: [stepPct, 1 - stepPct],
          backgroundColor: ['#22c55e', 'rgba(34,197,94,0.14)'],
          borderWidth: 0,
          cutout: '72%',
          radius: '100%',
          rotation: -90,
          circumference: 360,
          borderRadius: 8,
        },
        {
          data: [calPct, 1 - calPct],
          backgroundColor: ['#fb923c', 'rgba(251,146,60,0.14)'],
          borderWidth: 0,
          cutout: '58%',
          radius: '84%',
          rotation: -90,
          circumference: 360,
          borderRadius: 8,
        },
        {
          data: [distPct, 1 - distPct],
          backgroundColor: ['#3b82f6', 'rgba(59,130,246,0.14)'],
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
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:items-center">
        <div className="mx-auto h-40 w-40">
          {discreet ? (
            <div className="h-full w-full rounded-full border border-slate-200 bg-slate-50" />
          ) : (
            <Doughnut data={data} options={options} />
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricTile
            dotClass="bg-green-500"
            label="Steps"
            value={discreet ? 'Hidden' : formatInt(steps)}
            goal={discreet ? undefined : `${formatInt(stepsGoal)} goal`}
            tone="text-slate-900"
          />
          <MetricTile
            dotClass="bg-orange-400"
            label="Calories"
            value={discreet ? 'Hidden' : `${formatInt(calories)} kcal`}
            goal={discreet ? undefined : `${formatInt(caloriesGoal)} goal`}
            tone="text-slate-900"
          />
          <MetricTile
            dotClass="bg-blue-500"
            label="Distance"
            value={discreet ? 'Hidden' : `${format1(distanceKm)} km`}
            goal={discreet ? undefined : `${format1(distanceGoalKm)} km goal`}
            tone="text-slate-900"
          />
        </div>
      </div>
    </div>
  );
}

function MetricTile(props: {
  dotClass: string;
  label: string;
  value: string;
  goal?: string;
  tone?: string;
}) {
  const { dotClass, label, value, goal, tone = 'text-slate-900' } = props;

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
        <span className="text-xs font-medium text-slate-600">{label}</span>
      </div>
      <div className={`mt-2 text-lg font-semibold ${tone}`}>{value}</div>
      {goal ? <div className="mt-1 text-xs text-slate-500">{goal}</div> : null}
    </div>
  );
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function formatInt(n: number) {
  return Math.round(n).toLocaleString();
}

function format1(n: number) {
  return (Math.round(n * 10) / 10).toFixed(1);
}