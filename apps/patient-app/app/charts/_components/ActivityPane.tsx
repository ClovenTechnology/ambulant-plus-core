'use client';

import React from 'react';
import Sparkline from '@/components/charts/Sparkline';
import { cn, safeNum } from '../_lib/charts-ui';
import ActivityRings from './ActivityRings';

type ActivityPaneProps = {
  liveData: any;
  discreet: boolean;
  isPremium: boolean;
  onRequirePremium: () => void;
};

export default function ActivityPane(props: ActivityPaneProps) {
  const { liveData, discreet, isPremium, onRequirePremium } = props;

  const latest = liveData?.latest || {};
  const labelsRaw = Array.isArray(liveData?.labels)
    ? liveData.labels.map((x: any) => String(x))
    : [];

  const locked = !isPremium;

  const readSeries = (arr: any) =>
    Array.isArray(arr) ? arr.map((p: any) => safeNum(p?.v)) : [];

  const stepsSeries = readSeries(liveData?.steps);
  const caloriesSeries = readSeries(liveData?.calories);
  const distanceSeries = readSeries(liveData?.distance);

  const align = (labels: string[], values: Array<number | null>) => {
    const n = Math.min(labels.length, values.length);
    return { labels: labels.slice(-n), values: values.slice(-n) };
  };

  const steps = typeof latest?.steps === 'number' ? latest.steps : 0;
  const calories = typeof latest?.calories === 'number' ? latest.calories : 0;
  const distanceKm = typeof latest?.distance === 'number' ? latest.distance : 0;

  // pragmatic defaults for now; later these can come from profile/goals/preferences API
  const stepsGoal = 8000;
  const caloriesGoal = 500;
  const distanceGoalKm = 5;

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className={cn(locked && 'pointer-events-none select-none opacity-70')}>
          <ActivityRings
            steps={steps}
            stepsGoal={stepsGoal}
            calories={calories}
            caloriesGoal={caloriesGoal}
            distanceKm={distanceKm}
            distanceGoalKm={distanceGoalKm}
            discreet={discreet}
          />
        </div>

        {locked && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={onRequirePremium}
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm"
              type="button"
            >
              Unlock Premium
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ActivityTrendCard
          title="Steps trend"
          value={discreet ? 'Hidden' : steps.toLocaleString()}
          labels={align(labelsRaw, stepsSeries).labels}
          values={align(labelsRaw, stepsSeries).values}
          discreet={discreet}
          locked={locked}
        />

        <ActivityTrendCard
          title="Calories trend"
          value={discreet ? 'Hidden' : `${calories} kcal`}
          labels={align(labelsRaw, caloriesSeries).labels}
          values={align(labelsRaw, caloriesSeries).values}
          discreet={discreet}
          locked={locked}
        />

        <ActivityTrendCard
          title="Distance trend"
          value={discreet ? 'Hidden' : `${distanceKm} km`}
          labels={align(labelsRaw, distanceSeries).labels}
          values={align(labelsRaw, distanceSeries).values}
          discreet={discreet}
          locked={locked}
        />
      </div>
    </div>
  );
}

function ActivityTrendCard(props: {
  title: string;
  value: string;
  labels: string[];
  values: Array<number | null>;
  discreet: boolean;
  locked: boolean;
}) {
  const { title, value, labels, values, discreet, locked } = props;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-slate-500">{title}</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            {discreet ? <span className="text-slate-400">Hidden</span> : value}
          </div>
        </div>
        {locked ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-500">
            Premium
          </span>
        ) : null}
      </div>

      <div className={cn('mt-3', locked && 'pointer-events-none select-none opacity-70')}>
        <Sparkline
          labels={labels}
          values={values}
          color="#0f172a"
          live={false}
          showArea
          showLastValueBadge={false}
          redactValues={discreet}
        />
      </div>
    </div>
  );
}