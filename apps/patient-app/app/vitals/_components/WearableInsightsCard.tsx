// apps/patient-app/app/vitals/_components/WearableInsightsCard.tsx
'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import MeterDonut from '@/components/charts/MeterDonut';
import VitalSparkline from './VitalSparkline';
import WearableActivityRings from './WearableActivityRings';
import type { Status } from '../_lib/vitals-ui';

type WearableInsightsCardProps = {
  discreet: boolean;
};

type WearableApiPayload = {
  generatedAt?: string | number | Date | null;

  sleep_score?: number | null;
  hrv_ms?: number | null;
  readiness?: number | null;

  steps?: number | null;
  steps_goal?: number | null;

  calories?: number | null;
  calories_goal?: number | null;

  distance_km?: number | null;
  distance_goal_km?: number | null;

  sleep_hours?: number | null;
  resting_hr?: number | null;
  stress_level?: number | null;
  temp_delta_c?: number | null;

  hrv_series?: Array<number | null> | null;
  hrvSeries?: Array<number | null> | null;
  trends?: {
    hrv_ms?: Array<number | null> | null;
    hrv?: Array<number | null> | null;
  } | null;
};

type WearableQueryResponse =
  | WearableApiPayload
  | {
      ok?: boolean;
      data?: WearableApiPayload | null;
      insights?: WearableApiPayload | null;
      wearable?: WearableApiPayload | null;
    }
  | null;

function toNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toNonNegativeNumber(value: unknown): number | null {
  const n = toNumber(value);
  if (n === null) return null;
  return Math.max(0, n);
}

function toPercent(value: unknown): number | null {
  const n = toNumber(value);
  if (n === null) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function formatGeneratedAt(value: unknown): string {
  if (!value) return '—';

  const date = value instanceof Date ? value : new Date(value as any);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString();
}

function normaliseWearablePayload(
  payload: WearableQueryResponse | undefined,
): WearableApiPayload | null {
  if (!payload || typeof payload !== 'object') return null;

  const wrapper = payload as {
    data?: WearableApiPayload | null;
    insights?: WearableApiPayload | null;
    wearable?: WearableApiPayload | null;
  };

  const candidate =
    wrapper.data && typeof wrapper.data === 'object'
      ? wrapper.data
      : wrapper.insights && typeof wrapper.insights === 'object'
        ? wrapper.insights
        : wrapper.wearable && typeof wrapper.wearable === 'object'
          ? wrapper.wearable
          : (payload as WearableApiPayload);

  if (!candidate || typeof candidate !== 'object') return null;

  const hasAny =
    candidate.sleep_score != null ||
    candidate.hrv_ms != null ||
    candidate.readiness != null ||
    candidate.steps != null ||
    candidate.calories != null ||
    candidate.distance_km != null ||
    candidate.sleep_hours != null ||
    candidate.resting_hr != null ||
    candidate.stress_level != null ||
    candidate.temp_delta_c != null ||
    candidate.hrv_series != null ||
    candidate.hrvSeries != null ||
    candidate.trends?.hrv_ms != null ||
    candidate.trends?.hrv != null;

  return hasAny ? candidate : null;
}

function normaliseSeries(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => toNumber(item))
    .filter((item): item is number => item !== null);
}

function firstNonEmptySeries(...series: number[][]): number[] {
  return series.find((items) => items.length > 0) ?? [];
}

function hrvStatus(value?: number): Status {
  if (value == null || !Number.isFinite(value)) return 'unknown';
  if (value < 20) return 'warning';
  return 'normal';
}

function EmptyWearableState() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            Wearable Insights
          </div>
          <div className="text-xs text-slate-500">NexRing summary</div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <div className="font-medium text-slate-800">
          No wearable insights available yet
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Connect or sync your supported wearable to populate readiness, HRV,
          sleep, stress and activity insights.
        </p>
      </div>
    </div>
  );
}

export default function WearableInsightsCard({
  discreet,
}: WearableInsightsCardProps) {
  const { data, isLoading, error } = useQuery<WearableQueryResponse, Error>({
    queryKey: ['wearable-insights'],
    queryFn: async () => {
      const response = await fetch('/api/wearable-insights', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`wearable_insights_http_${response.status}`);
      }

      return response.json();
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  const resolved = useMemo(() => normaliseWearablePayload(data), [data]);

  const hrvSeries = useMemo(() => {
    if (!resolved) return [];

    return firstNonEmptySeries(
      normaliseSeries(resolved.hrv_series),
      normaliseSeries(resolved.hrvSeries),
      normaliseSeries(resolved.trends?.hrv_ms),
      normaliseSeries(resolved.trends?.hrv),
    );
  }, [resolved]);

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
        Loading wearable insights…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
        Wearable insights are currently unavailable.
      </div>
    );
  }

  if (!resolved) {
    return <EmptyWearableState />;
  }

  const readiness = toPercent(resolved.readiness);
  const sleepScore = toPercent(resolved.sleep_score);

  const steps = toNonNegativeNumber(resolved.steps) ?? 0;
  const stepsGoal = toNonNegativeNumber(resolved.steps_goal) ?? 10_000;

  const calories = toNonNegativeNumber(resolved.calories) ?? 0;
  const caloriesGoal = toNonNegativeNumber(resolved.calories_goal) ?? 2_000;

  const distanceKm = toNonNegativeNumber(resolved.distance_km) ?? 0;
  const distanceGoalKm = toNonNegativeNumber(resolved.distance_goal_km) ?? 8;

  const hrvMs = toNumber(resolved.hrv_ms);
  const restingHr = toNumber(resolved.resting_hr);
  const sleepHours = toNumber(resolved.sleep_hours);
  const stressLevel = toNumber(resolved.stress_level);
  const tempDeltaC = toNumber(resolved.temp_delta_c);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">
            Wearable Insights
          </div>
          <div className="text-xs text-slate-500">NexRing summary</div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
              ◉ NexRing
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
              ◉ Health Monitor
            </span>
          </div>
        </div>

        <div className="shrink-0 text-right text-[11px] text-slate-500">
          {discreet ? '—' : formatGeneratedAt(resolved.generatedAt)}
        </div>
      </div>

      <div className="mt-4">
        {discreet ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="text-xs font-medium text-slate-500">Activity</div>
            <div className="mt-3 h-28 rounded-2xl border bg-slate-100" />
          </div>
        ) : (
          <WearableActivityRings
            steps={steps}
            stepsGoal={stepsGoal}
            calories={calories}
            caloriesGoal={caloriesGoal}
            distanceKm={distanceKm}
            distanceGoalKm={distanceGoalKm}
          />
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
          {discreet ? (
            <div className="mx-auto h-28 w-full rounded-2xl border bg-slate-100" />
          ) : readiness === null ? (
            <MetricEmpty label="Readiness unavailable" />
          ) : (
            <MeterDonut
              value={readiness}
              max={100}
              label="Readiness"
              color="#fb923c"
              unit="%"
            />
          )}
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
          <div className="text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            HRV
          </div>

          <div className="mt-2 h-20 overflow-hidden rounded-xl bg-white px-1 py-1">
            {hrvSeries.length > 1 ? (
              <VitalSparkline
                values={hrvSeries}
                statusFn={hrvStatus}
                width={180}
                height={56}
                tooltipDisabled={discreet}
                unit="ms"
                valueFormatter={(v) => (discreet ? '•••' : String(v))}
              />
            ) : (
              <div className="grid h-full place-items-center text-xs text-slate-400">
                No HRV trend
              </div>
            )}
          </div>

          <div className="mt-3 text-center">
            <div className="text-lg font-semibold text-slate-900">
              {discreet ? '•••' : hrvMs ?? '—'}
              {!discreet && hrvMs !== null && (
                <span className="ml-1 text-xs font-medium text-slate-500">
                  ms
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500">
              Heart rate variability
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
          {discreet ? (
            <div className="mx-auto h-28 w-full rounded-2xl border bg-slate-100" />
          ) : sleepScore === null ? (
            <MetricEmpty label="Sleep score unavailable" />
          ) : (
            <MeterDonut
              value={sleepScore}
              max={100}
              label="Sleep Score"
              color="#22c55e"
              unit="%"
            />
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <InfoTile
          label="Resting HR"
          value={discreet ? '•••' : restingHr === null ? '—' : `${restingHr} bpm`}
        />
        <InfoTile
          label="Sleep"
          value={
            discreet
              ? '•••'
              : sleepHours === null
                ? '—'
                : `${sleepHours.toFixed(1)} h`
          }
        />
        <InfoTile
          label="Stress"
          value={discreet ? '•••' : stressLevel === null ? '—' : `${stressLevel}`}
        />
        <InfoTile
          label="Temp Δ"
          value={
            discreet
              ? '•••'
              : tempDeltaC === null
                ? '—'
                : `${tempDeltaC > 0 ? '+' : ''}${tempDeltaC.toFixed(1)} °C`
          }
        />
      </div>
    </div>
  );
}

function MetricEmpty({ label }: { label: string }) {
  return (
    <div className="grid h-28 place-items-center rounded-2xl border border-dashed bg-white text-center text-xs text-slate-400">
      {label}
    </div>
  );
}

function InfoTile(props: { label: string; value: string }) {
  const { label, value } = props;

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
      <div className="text-[11px] uppercase tracking-[0.1em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}