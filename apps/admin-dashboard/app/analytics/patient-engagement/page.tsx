// apps/admin-dashboard/app/analytics/patient-engagement/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type {
  PatientEngagementApiResponse,
  PatientEngagementPayload,
  PatientEngagementSummary,
  PlanEngagementSnapshot,
  ActivationFunnelStage,
  RetentionCohortRow,
  FeatureUsageItem,
  DeviceUsageItem,
  MedicationAdherenceStats,
  SegmentRow,
  StepsAndCaloriesAggregate,
  PlanTier,
  Gender,
  AgeBand,
} from '@/lib/analytics/patientEngagementTypes';

type RangeKey = '30d' | '90d' | '180d' | '365d';

const RANGE_LABEL: Record<RangeKey, string> = {
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '180d': 'Last 6 months',
  '365d': 'Last 12 months',
};

const PLAN_LABEL: Record<PlanTier | 'all', string> = {
  all: 'All plans',
  free: 'Free',
  premium: 'Premium',
  enterprise: 'Enterprise',
  unknown: 'Unknown',
};

const GENDER_LABEL: Record<Gender | 'all', string> = {
  all: 'All genders',
  male: 'Male',
  female: 'Female',
  other: 'Other',
  unknown: 'Unknown',
};

const AGE_LABEL: Record<AgeBand | 'all', string> = {
  all: 'All ages',
  '0-12': '0–12',
  '13-17': '13–17',
  '18-24': '18–24',
  '25-34': '25–34',
  '35-44': '35–44',
  '45-54': '45–54',
  '55-64': '55–64',
  '65+': '65+',
  unknown: 'Unknown',
};

// Use API gateway base URL if provided (e.g. http://localhost:3010)
const RAW_API_BASE = process.env.NEXT_PUBLIC_APIGW_BASE ?? '';
const API_BASE =
  RAW_API_BASE && RAW_API_BASE.endsWith('/')
    ? RAW_API_BASE.slice(0, -1)
    : RAW_API_BASE;

/* ------------ Small helpers ------------ */

function pct(value: number | undefined | null, ds: number = 1): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${(value * 100 * ds).toFixed(1)}%`;
}

function fmtNumber(value: number | undefined | null, fractionDigits = 0): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  });
}

function fmtCurrency(value: number | undefined | null, currency = 'ZAR'): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function MetricCard(props: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: 'normal' | 'good' | 'bad';
}) {
  const emphasisClasses =
    props.emphasis === 'good'
      ? 'border-emerald-200 bg-emerald-50'
      : props.emphasis === 'bad'
      ? 'border-rose-200 bg-rose-50'
      : 'border-gray-100 bg-white';

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${emphasisClasses}`}>
      <div className="text-xs text-gray-500">{props.label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">
        {props.value}
      </div>
      {props.sub && (
        <div className="mt-1 text-[11px] text-gray-400">{props.sub}</div>
      )}
    </div>
  );
}

/* ------------ Main page ------------ */

export default function PatientEngagementAnalyticsPage() {
  const [range, setRange] = useState<RangeKey>('90d');
  const [plan, setPlan] = useState<PlanTier | 'all'>('all');
  const [gender, setGender] = useState<Gender | 'all'>('all');
  const [ageBand, setAgeBand] = useState<AgeBand | 'all'>('all');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [payload, setPayload] = useState<PatientEngagementPayload | null>(null);
  const [asAt, setAsAt] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ range });
        const endpoint =
          (API_BASE || '') +
          '/api/admin/analytics/patient-engagement?' +
          params.toString();

        const res = await fetch(endpoint, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as PatientEngagementApiResponse;
        if (!json.ok) throw new Error('API returned ok = false');

        if (aborted) return;
        setPayload(json.data);
        setAsAt(json.asAt);
      } catch (e: any) {
        if (aborted) return;
        console.error('patient engagement analytics fetch failed', e);
        setError(e?.message || 'Failed to load patient engagement analytics.');
        setPayload(null);
        setAsAt(null);
      } finally {
        if (!aborted) setLoading(false);
      }
    })();

    return () => {
      aborted = true;
    };
  }, [range]);

  const summary: PatientEngagementSummary | null = payload?.summary ?? null;
  const plans: PlanEngagementSnapshot[] = payload?.planSnapshots ?? [];
  const funnel: ActivationFunnelStage[] = payload?.funnelStages ?? [];
  const cohorts: RetentionCohortRow[] = payload?.retentionCohorts ?? [];
  const features: FeatureUsageItem[] = payload?.featureUsage ?? [];
  const devices: DeviceUsageItem[] = payload?.deviceUsage ?? [];
  const adherence: MedicationAdherenceStats | null = payload?.adherence ?? null;
  const segments: SegmentRow[] = payload?.segments ?? [];
  const stepsAgg: StepsAndCaloriesAggregate[] = payload?.stepsAndCalories ?? [];

  /* ------------ Apply local filters to segments ------------ */

  const filteredSegments = useMemo(() => {
    if (!segments.length) return segments;
    return segments.filter((row) => {
      if (plan !== 'all' && row.key.plan !== plan) return false;
      if (gender !== 'all' && row.key.gender !== gender) return false;
      if (ageBand !== 'all' && row.key.ageBand !== ageBand) return false;
      return true;
    });
  }, [segments, plan, gender, ageBand]);

  const filteredStepsAgg = useMemo(() => {
    if (!stepsAgg.length) return stepsAgg;
    return stepsAgg.filter((row) => {
      if (plan !== 'all' && row.segmentKey.plan !== plan) return false;
      if (gender !== 'all' && row.segmentKey.gender !== gender) return false;
      if (ageBand !== 'all' && row.segmentKey.ageBand !== ageBand) return false;
      return true;
    });
  }, [stepsAgg, plan, gender, ageBand]);

  /* ------------ Derived insights ------------ */

  const mostUsedFeature: FeatureUsageItem | undefined = useMemo(() => {
    if (!features.length) return undefined;
    return [...features].sort(
      (a, b) => (b.penetrationActive30d || 0) - (a.penetrationActive30d || 0),
    )[0];
  }, [features]);

  const leastUsedFeature: FeatureUsageItem | undefined = useMemo(() => {
    if (!features.length) return undefined;
    return [...features]
      .filter((f) => f.penetrationActive30d > 0)
      .sort(
        (a, b) => (a.penetrationActive30d || 0) - (b.penetrationActive30d || 0),
      )[0];
  }, [features]);

  const mostUsedDevice: DeviceUsageItem | undefined = useMemo(() => {
    if (!devices.length) return undefined;
    return [...devices].sort(
      (a, b) => (b.penetrationActive30d || 0) - (a.penetrationActive30d || 0),
    )[0];
  }, [devices]);

  const topSegmentsByEngagement = useMemo(() => {
    if (!filteredSegments.length) return [];
    return [...filteredSegments]
      .sort(
        (a, b) =>
          (b.metrics.sessionsPerActive30d || 0) -
          (a.metrics.sessionsPerActive30d || 0),
      )
      .slice(0, 5);
  }, [filteredSegments]);

  const topSegmentsBySteps = useMemo(() => {
    if (!filteredStepsAgg.length) return [];
    return [...filteredStepsAgg]
      .sort(
        (a, b) => (b.avgDailySteps || 0) - (a.avgDailySteps || 0),
      )
      .slice(0, 5);
  }, [filteredStepsAgg]);

  /* ------------ Layout ------------ */

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      {/* HEADER */}
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Patient engagement &amp; retention
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            End-to-end view of how patients discover, activate, and keep using
            Ambulant+ across contactless consults, IoMT, and care flows. Use
            this to tune onboarding, pricing, and long-term outcomes.
          </p>
          {asAt && (
            <p className="mt-1 text-[11px] text-gray-400">
              As at {new Date(asAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 text-xs">
          <div className="inline-flex overflow-hidden rounded-full border bg-white">
            <Link
              href="/analytics/medical"
              className="border-r px-3 py-1.5 hover:bg-gray-50"
            >
              Medical KPIs
            </Link>
            <Link
              href="/analytics/monthly"
              className="border-r px-3 py-1.5 hover:bg-gray-50"
            >
              Monthly trends
            </Link>
            <Link
              href="/analytics/patient-engagement"
              className="bg-gray-900 px-3 py-1.5 text-white"
            >
              Engagement
            </Link>
          </div>
          {loading && (
            <div className="text-[11px] text-gray-400">
              Loading patient analytics…
            </div>
          )}
        </div>
      </header>

      {error && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {error}
        </div>
      )}

      {/* GLOBAL FILTERS */}
      <section className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm text-xs">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Range:</span>
              <div className="inline-flex overflow-hidden rounded-full border bg-white">
                {(Object.keys(RANGE_LABEL) as RangeKey[]).map((rk) => (
                  <button
                    key={rk}
                    type="button"
                    onClick={() => setRange(rk)}
                    className={`px-3 py-1.5 border-r last:border-r-0 ${
                      range === rk
                        ? 'bg-gray-900 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {RANGE_LABEL[rk]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-500">Plan:</span>
              <select
                className="rounded border px-2 py-1"
                value={plan}
                onChange={(e) =>
                  setPlan(e.target.value as PlanTier | 'all')
                }
              >
                {Object.entries(PLAN_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-500">Gender:</span>
              <select
                className="rounded border px-2 py-1"
                value={gender}
                onChange={(e) =>
                  setGender(e.target.value as Gender | 'all')
                }
              >
                {Object.entries(GENDER_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-500">Age:</span>
              <select
                className="rounded border px-2 py-1"
                value={ageBand}
                onChange={(e) =>
                  setAgeBand(e.target.value as AgeBand | 'all')
                }
              >
                {Object.entries(AGE_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPlan('all');
                setGender('all');
                setAgeBand('all');
              }}
              className="rounded border px-2.5 py-1 text-gray-600 hover:bg-gray-50"
            >
              Reset filters
            </button>
            <button
              type="button"
              onClick={() => setRange((prev) => prev)}
              className="rounded border bg-white px-3 py-1 text-gray-700 hover:bg-gray-50"
            >
              Refresh data
            </button>
          </div>
        </div>
      </section>

      {/* KPI STRIP */}
      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard
          label="Active patients (30d)"
          value={fmtNumber(summary?.activePatients30d)}
          sub={`${fmtNumber(summary?.totalPatients)} total registered`}
        />
        <MetricCard
          label="30-day retention"
          value={pct(summary?.retention30d)}
          sub="Share of patients still active 30 days after activation"
          emphasis="good"
        />
        <MetricCard
          label="Avg sessions / active (30d)"
          value={fmtNumber(summary?.avgSessionsPerActive30d, 1)}
          sub={`${fmtNumber(
            summary?.avgMinutesPerActive30d,
            1,
          )} min / active`}
        />
        <MetricCard
          label="Avg revenue / active (30d)"
          value={fmtCurrency(summary?.avgRevenuePerActive30d)}
          sub={`LTV: ${fmtCurrency(summary?.avgRevenuePerPatientLTV)}`}
        />
      </section>

      {/* MAIN GRID */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* LEFT COLUMN: Engagement & funnel */}
        <div className="space-y-4 lg:col-span-2">
          {/* ENGAGEMENT OVERVIEW / COHORTS */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm text-xs">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Engagement &amp; retention cohorts
                </h2>
                <p className="mt-1 text-[11px] text-gray-500">
                  How different signup cohorts retain over {RANGE_LABEL[range]}.
                </p>
              </div>
              <span className="text-[11px] text-gray-400">
                Heatmap placeholder – wired to chart component later
              </span>
            </div>

            <div className="mb-3 flex h-40 items-center justify-center rounded-xl border border-dashed bg-gray-50/60 text-center text-[11px] text-gray-400">
              Cohort retention heatmap (cohort vs D7 / D30 / D60 / D90)
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border text-[11px]">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="border-b px-2 py-1 text-left">Cohort</th>
                    <th className="border-b px-2 py-1 text-right">Size</th>
                    <th className="border-b px-2 py-1 text-right">D7</th>
                    <th className="border-b px-2 py-1 text-right">D30</th>
                    <th className="border-b px-2 py-1 text-right">D60</th>
                    <th className="border-b px-2 py-1 text-right">D90</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-4 text-center text-gray-500"
                      >
                        No cohort data yet.
                      </td>
                    </tr>
                  )}
                  {cohorts.map((c) => (
                    <tr key={c.cohortKey} className="border-t">
                      <td className="px-2 py-1 text-left text-gray-900">
                        {c.cohortLabel}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-[10px] text-gray-600">
                        {fmtNumber(c.cohortSize)}
                      </td>
                      <td className="px-2 py-1 text-right text-gray-700">
                        {pct(c.d7Retained)}
                      </td>
                      <td className="px-2 py-1 text-right text-gray-700">
                        {pct(c.d30Retained)}
                      </td>
                      <td className="px-2 py-1 text-right text-gray-700">
                        {pct(c.d60Retained)}
                      </td>
                      <td className="px-2 py-1 text-right text-gray-700">
                        {pct(c.d90Retained)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ACTIVATION FUNNEL */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm text-xs">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Activation funnel
                </h2>
                <p className="mt-1 text-[11px] text-gray-500">
                  From registration to first consult / order and repeat
                  behaviour, filtered by plan / gender / age.
                </p>
              </div>
              <span className="text-[11px] text-gray-400">
                Funnel chart placeholder
              </span>
            </div>

            <div className="mb-3 flex h-32 items-center justify-center rounded-xl border border-dashed bg-gray-50/60 text-center text-[11px] text-gray-400">
              Funnel chart (bars or vertical funnel)
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              {funnel.map((stage, idx) => (
                <div
                  key={stage.key}
                  className="rounded-xl border bg-gray-50 px-3 py-2"
                >
                  <div className="text-[11px] font-medium text-gray-800">
                    {stage.label}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-gray-900">
                    {fmtNumber(stage.count)}
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    {idx === 0
                      ? 'Entry cohort'
                      : `→ ${pct(stage.conversionFromPrevious)} from previous`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: quick insights */}
        <div className="space-y-4">
          <div className="rounded-2xl border bg-white p-4 shadow-sm text-xs">
            <h2 className="text-sm font-semibold text-gray-900">
              Quick insights
            </h2>
            <ul className="mt-2 space-y-2 text-[11px] text-gray-700">
              <li>
                <span className="font-medium text-gray-900">
                  Best performing plan:{' '}
                </span>
                {plans.length
                  ? plans
                      .slice()
                      .sort(
                        (a, b) =>
                          (b.avgRevenuePerActive30d || 0) -
                          (a.avgRevenuePerActive30d || 0),
                      )[0].label
                  : '—'}
              </li>
              <li>
                <span className="font-medium text-gray-900">
                  High-risk non-adherent share:{' '}
                </span>
                {pct(adherence?.highRiskLowAdherentShare)}
              </li>
              <li>
                <span className="font-medium text-gray-900">
                  Most used feature:{' '}
                </span>
                {mostUsedFeature ? mostUsedFeature.label : '—'}
              </li>
              <li>
                <span className="font-medium text-gray-900">
                  Least used feature:{' '}
                </span>
                {leastUsedFeature ? leastUsedFeature.label : '—'}
              </li>
              <li>
                <span className="font-medium text-gray-900">
                  Most used IoMT:{' '}
                </span>
                {mostUsedDevice ? mostUsedDevice.label : '—'}
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm text-xs">
            <h2 className="text-sm font-semibold text-gray-900">
              Segment hotspots
            </h2>
            <p className="mt-1 text-[11px] text-gray-500">
              Top segments by intensity of use and lifestyle metrics under the
              current filters.
            </p>

            <div className="mt-2 grid gap-3">
              <div>
                <div className="mb-1 text-[11px] font-medium text-gray-700">
                  Highest engagement segments (sessions / active)
                </div>
                <ul className="space-y-1 text-[11px] text-gray-700">
                  {topSegmentsByEngagement.length === 0 && (
                    <li className="text-gray-400">No segment data yet.</li>
                  )}
                  {topSegmentsByEngagement.map((s) => (
                    <li key={`${s.key.ageBand}-${s.key.gender}-${s.key.plan}`}>
                      <span className="font-medium text-gray-900">
                        {AGE_LABEL[s.key.ageBand]} •{' '}
                        {GENDER_LABEL[s.key.gender]} •{' '}
                        {PLAN_LABEL[s.key.plan]}
                      </span>{' '}
                      – {fmtNumber(
                        s.metrics.sessionsPerActive30d,
                        1,
                      )}{' '}
                      sessions / active,{' '}
                      {fmtNumber(
                        s.metrics.minutesPerActive30d,
                        1,
                      )}{' '}
                      min / active
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-medium text-gray-700">
                  Highest lifestyle activity (steps)
                </div>
                <ul className="space-y-1 text-[11px] text-gray-700">
                  {topSegmentsBySteps.length === 0 && (
                    <li className="text-gray-400">No step data yet.</li>
                  )}
                  {topSegmentsBySteps.map((s) => (
                    <li
                      key={`${s.segmentKey.ageBand}-${s.segmentKey.gender}-${s.segmentKey.plan}`}
                    >
                      <span className="font-medium text-gray-900">
                        {AGE_LABEL[s.segmentKey.ageBand]} •{' '}
                        {GENDER_LABEL[s.segmentKey.gender]} •{' '}
                        {PLAN_LABEL[s.segmentKey.plan]}
                      </span>{' '}
                      – {fmtNumber(s.avgDailySteps)} steps / day,{' '}
                      {fmtNumber(s.avgDailyCalories)} kcal / day
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PLAN & REVENUE + ADHERENCE / OUTCOMES */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Plan & revenue */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm text-xs">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Plan mix &amp; revenue
              </h2>
              <p className="mt-1 text-[11px] text-gray-500">
                How free vs premium vs enterprise patients behave, spend, and
                stay.
              </p>
            </div>
            <span className="text-[11px] text-gray-400">
              Stacked bar chart placeholder
            </span>
          </div>

          <div className="mb-3 flex h-32 items-center justify-center rounded-xl border border-dashed bg-gray-50/60 text-center text-[11px] text-gray-400">
            Plan breakdown chart (patients &amp; revenue)
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border text-[11px]">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="border-b px-2 py-1 text-left">Plan</th>
                  <th className="border-b px-2 py-1 text-right">
                    Active (30d)
                  </th>
                  <th className="border-b px-2 py-1 text-right">
                    Sessions / active
                  </th>
                  <th className="border-b px-2 py-1 text-right">
                    Revenue / active (30d)
                  </th>
                  <th className="border-b px-2 py-1 text-right">
                    Total revenue (30d)
                  </th>
                  <th className="border-b px-2 py-1 text-right">
                    Adherence score
                  </th>
                </tr>
              </thead>
              <tbody>
                {plans.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-4 text-center text-gray-500"
                    >
                      No plan data yet.
                    </td>
                  </tr>
                )}
                {plans.map((p) => (
                  <tr key={p.plan} className="border-t">
                    <td className="px-2 py-1 text-left text-gray-900">
                      {p.label}
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-[10px] text-gray-700">
                      {fmtNumber(p.activePatients30d)}
                    </td>
                    <td className="px-2 py-1 text-right text-gray-700">
                      {fmtNumber(p.avgSessionsPerActive30d, 1)}
                    </td>
                    <td className="px-2 py-1 text-right text-gray-700">
                      {fmtCurrency(p.avgRevenuePerActive30d)}
                    </td>
                    <td className="px-2 py-1 text-right text-gray-700">
                      {fmtCurrency(p.totalRevenue30d)}
                    </td>
                    <td className="px-2 py-1 text-right text-gray-700">
                      {pct(p.medicationAdherenceScore)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Adherence & outcomes */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm text-xs">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Medication adherence &amp; outcomes
              </h2>
              <p className="mt-1 text-[11px] text-gray-500">
                How well patients stick to prescribed regimes across plans and
                segments.
              </p>
            </div>
            <span className="text-[11px] text-gray-400">
              Donut chart placeholder
            </span>
          </div>

          <div className="mb-3 flex h-32 items-center justify-center rounded-xl border border-dashed bg-gray-50/60 text-center text-[11px] text-gray-400">
            Adherence bucket distribution
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <MetricCard
              label="Avg adherence (overall)"
              value={pct(adherence?.avgScoreOverall)}
              sub=""
            />
            <MetricCard
              label="Avg adherence (premium)"
              value={pct(adherence?.avgScorePremium)}
              sub=""
              emphasis="good"
            />
            <MetricCard
              label="Avg adherence (free)"
              value={pct(adherence?.avgScoreFree)}
              sub=""
            />
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border text-[11px]">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="border-b px-2 py-1 text-left">Bucket</th>
                  <th className="border-b px-2 py-1 text-right">Patients</th>
                  <th className="border-b px-2 py-1 text-right">
                    Avg score
                  </th>
                </tr>
              </thead>
              <tbody>
                {adherence?.buckets?.length ? (
                  adherence.buckets.map((b) => (
                    <tr key={b.bucketKey} className="border-t">
                      <td className="px-2 py-1 text-left text-gray-900">
                        {b.label}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-[10px] text-gray-700">
                        {fmtNumber(b.patients)}
                      </td>
                      <td className="px-2 py-1 text-right text-gray-700">
                        {pct(b.avgScore)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-3 py-4 text-center text-gray-500"
                    >
                      No adherence data yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FEATURES & IOMT USAGE */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Feature usage */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm text-xs">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Feature usage
              </h2>
              <p className="mt-1 text-[11px] text-gray-500">
                Which parts of Ambulant+ patients actually use – consult, self
                checks, eRx, care plans, shop, rewards, etc.
              </p>
            </div>
            <span className="text-[11px] text-gray-400">
              Horizontal bar chart placeholder
            </span>
          </div>

          <div className="mb-3 flex h-32 items-center justify-center rounded-xl border border-dashed bg-gray-50/60 text-center text-[11px] text-gray-400">
            Feature usage chart
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border text-[11px]">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="border-b px-2 py-1 text-left">Feature</th>
                  <th className="border-b px-2 py-1 text-right">DAU</th>
                  <th className="border-b px-2 py-1 text-right">WAU</th>
                  <th className="border-b px-2 py-1 text-right">MAU</th>
                  <th className="border-b px-2 py-1 text-right">
                    Penetration (30d)
                  </th>
                </tr>
              </thead>
              <tbody>
                {features.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-4 text-center text-gray-500"
                    >
                      No feature usage data yet.
                    </td>
                  </tr>
                )}
                {features.map((f) => (
                  <tr key={f.key} className="border-t">
                    <td className="px-2 py-1 text-left text-gray-900">
                      {f.label}
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-[10px] text-gray-700">
                      {fmtNumber(f.dailyActiveUsers)}
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-[10px] text-gray-700">
                      {fmtNumber(f.weeklyActiveUsers)}
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-[10px] text-gray-700">
                      {fmtNumber(f.monthlyActiveUsers)}
                    </td>
                    <td className="px-2 py-1 text-right text-gray-700">
                      {pct(f.penetrationActive30d)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* IoMT usage */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm text-xs">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                IoMT usage
              </h2>
              <p className="mt-1 text-[11px] text-gray-500">
                Which connected devices patients rely on most – NexRing, Health
                Monitor, Digital Stethoscope, etc.
              </p>
            </div>
            <span className="text-[11px] text-gray-400">
              Combo chart placeholder
            </span>
          </div>

          <div className="mb-3 flex h-32 items-center justify-center rounded-xl border border-dashed bg-gray-50/60 text-center text-[11px] text-gray-400">
            Device usage chart
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border text-[11px]">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="border-b px-2 py-1 text-left">Device</th>
                  <th className="border-b px-2 py-1 text-right">Active users</th>
                  <th className="border-b px-2 py-1 text-right">
                    Measurements (30d)
                  </th>
                  <th className="border-b px-2 py-1 text-right">
                    Measurements / user
                  </th>
                  <th className="border-b px-2 py-1 text-right">
                    Penetration (30d)
                  </th>
                </tr>
              </thead>
              <tbody>
                {devices.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-4 text-center text-gray-500"
                    >
                      No device data yet.
                    </td>
                  </tr>
                )}
                {devices.map((d) => (
                  <tr key={d.deviceSlug} className="border-t">
                    <td className="px-2 py-1 text-left text-gray-900">
                      {d.label}
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-[10px] text-gray-700">
                      {fmtNumber(d.activeUsers30d)}
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-[10px] text-gray-700">
                      {fmtNumber(d.measurements30d)}
                    </td>
                    <td className="px-2 py-1 text-right text-gray-700">
                      {fmtNumber(d.avgMeasurementsPerUser30d, 1)}
                    </td>
                    <td className="px-2 py-1 text-right text-gray-700">
                      {pct(d.penetrationActive30d)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* DEMOGRAPHICS & LIFESTYLE */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm text-xs">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Demographic &amp; lifestyle picture
            </h2>
            <p className="mt-1 text-[11px] text-gray-500">
              Average steps, calories, and sleep across segments. Use this to
              understand behaviour by age, gender, and plan.
            </p>
          </div>
          <span className="text-[11px] text-gray-400">
            Scatter / radar chart placeholder
          </span>
        </div>

        <div className="mb-3 flex h-40 items-center justify-center rounded-xl border border-dashed bg-gray-50/60 text-center text-[11px] text-gray-400">
          Steps &amp; calories by age / gender chart
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border text-[11px]">
            <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="border-b px-2 py-1 text-left">Segment</th>
                <th className="border-b px-2 py-1 text-right">Steps / day</th>
                <th className="border-b px-2 py-1 text-right">
                  Calories / day
                </th>
                <th className="border-b px-2 py-1 text-right">Sample size</th>
              </tr>
            </thead>
            <tbody>
              {filteredStepsAgg.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-4 text-center text-gray-500"
                  >
                    No lifestyle data for this filter set yet.
                  </td>
                </tr>
              )}
              {filteredStepsAgg.map((r) => (
                <tr
                  key={`${r.segmentKey.ageBand}-${r.segmentKey.gender}-${r.segmentKey.plan}`}
                  className="border-t"
                >
                  <td className="px-2 py-1 text-left text-gray-900">
                    {AGE_LABEL[r.segmentKey.ageBand]} •{' '}
                    {GENDER_LABEL[r.segmentKey.gender]} •{' '}
                    {PLAN_LABEL[r.segmentKey.plan]}
                  </td>
                  <td className="px-2 py-1 text-right text-gray-700">
                    {fmtNumber(r.avgDailySteps)}
                  </td>
                  <td className="px-2 py-1 text-right text-gray-700">
                    {fmtNumber(r.avgDailyCalories)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-[10px] text-gray-700">
                    {fmtNumber(r.sampleSize)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
