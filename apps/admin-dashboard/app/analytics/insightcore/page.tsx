// apps/admin-dashboard/app/analytics/insightcore/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

/* ---------- Types (adjust to match /api/admin/insight/risk-events) ---------- */

type RangeKey = '7d' | '30d' | '90d';
type SeverityKey = 'all' | 'low' | 'moderate' | 'high';

type RulePerformanceRow = {
  ruleId: string;
  ruleKey: string;
  name?: string | null;
  syndrome?: string | null;
  total: number;
  low: number;
  moderate: number;
  high: number;
  avgScore?: number | null;
  distinctPatients: number;
  defaultSeverity?: string | null;
  hardThreshold?: number | null;
};

type VolumePoint = {
  bucket: string; // e.g. "2025-03-10"
  total: number;
  low: number;
  moderate: number;
  high: number;
};

type InsightCoreAnalyticsPayload = {
  timeRangeLabel: string;
  from: string;
  to: string;
  rules: RulePerformanceRow[];
  volumeSeries?: VolumePoint[];
};

type Kpis = {
  totalAlerts: number;
  highSeverityPct: number;
  alertsPerDay: number;
  distinctPatients: number;
};

/* ---------- Small UI bits ---------- */

function MetricCard(props: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-medium text-gray-500">{props.label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900">
        {props.value}
      </div>
      {props.sub && (
        <div className="mt-1 text-[11px] text-gray-400">{props.sub}</div>
      )}
    </div>
  );
}

/** simple tiny line chart for total alerts over time */
function VolumeLineChart({ points }: { points: VolumePoint[] }) {
  if (!points.length) return null;

  const w = 360;
  const h = 120;
  const padX = 24;
  const padY = 18;
  const maxVal = Math.max(...points.map((p) => p.total), 1);
  const stepX =
    points.length === 1 ? 0 : (w - padX * 2) / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = padX + i * stepX;
    const y = h - padY - (p.total / maxVal) * (h - padY * 2);
    return { x, y };
  });

  const path = coords.map((c) => `${c.x},${c.y}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-[140px] w-full"
      aria-hidden="true"
    >
      {/* x-axis */}
      <polyline
        points={`${padX},${h - padY} ${w - padX},${h - padY}`}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={1}
      />
      {/* line */}
      <polyline
        points={path}
        fill="none"
        stroke="#0f766e"
        strokeWidth={2}
      />
      {/* dots */}
      {coords.map((c, i) => (
        <circle
          key={i}
          cx={c.x}
          cy={c.y}
          r={3}
          fill="#0f766e"
        />
      ))}
    </svg>
  );
}

/* ---------- Page ---------- */

const SEVERITIES: SeverityKey[] = ['all', 'low', 'moderate', 'high'];

export default function InsightcoreAnalyticsPage() {
  const [range, setRange] = useState<RangeKey>('30d');
  const [severity, setSeverity] = useState<SeverityKey>('all');
  const [syndrome, setSyndrome] = useState<string>('all');
  const [data, setData] =
    useState<InsightCoreAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const params = new URLSearchParams();
        params.set('range', range);
        if (severity !== 'all') params.set('severity', severity);
        if (syndrome !== 'all') params.set('syndrome', syndrome);

        const url = `/api/admin/insight/risk-events?${params.toString()}`;
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as InsightCoreAnalyticsPayload;
        if (!mounted) return;
        setData(j);
      } catch (e: any) {
        if (!mounted) return;
        console.error('insightcore analytics error', e);
        setErr(
          e?.message ||
            'Unable to load InsightCore analytics – check /api/admin/insight/risk-events.',
        );
        setData(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [range, severity, syndrome]);

  const kpis: Kpis | null = useMemo(() => {
    if (!data) return null;
    const totalAlerts = data.rules.reduce((sum, r) => sum + r.total, 0);
    const highAlerts = data.rules.reduce((sum, r) => sum + r.high, 0);
    const highSeverityPct =
      totalAlerts === 0 ? 0 : Math.round((highAlerts / totalAlerts) * 100);

    const distinctPatients = data.rules.reduce(
      (sum, r) => sum + r.distinctPatients,
      0,
    );

    const from = new Date(data.from);
    const to = new Date(data.to);
    const msPerDay = 1000 * 60 * 60 * 24;
    const days = Math.max(
      1,
      Math.round((to.getTime() - from.getTime()) / msPerDay),
    );
    const alertsPerDay = Math.round(totalAlerts / days);

    return {
      totalAlerts,
      highSeverityPct,
      alertsPerDay,
      distinctPatients,
    };
  }, [data]);

  const sortedRules = useMemo(() => {
    if (!data) return [];
    const filteredBySeverity = data.rules.filter((r) => {
      if (severity === 'all') return true;
      if (severity === 'low') return r.low > 0;
      if (severity === 'moderate') return r.moderate > 0;
      if (severity === 'high') return r.high > 0;
      return true;
    });

    const filteredBySyndrome =
      syndrome === 'all'
        ? filteredBySeverity
        : filteredBySeverity.filter((r) => r.syndrome === syndrome);

    return [...filteredBySyndrome].sort((a, b) => b.total - a.total);
  }, [data, severity, syndrome]);

  const series = data?.volumeSeries ?? [];

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      {/* HEADER */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Analytics — InsightCore Alerts
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Volume, severity mix and rule performance for clinical risk
            alerts across the Ambulant+ network.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Range selector */}
          <div className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-1">
            <span className="text-gray-500">Range</span>
            <select
              className="bg-transparent text-gray-900 outline-none"
              value={range}
              onChange={(e) => setRange(e.target.value as RangeKey)}
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>

          {/* Severity filter */}
          <div className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-1">
            <span className="text-gray-500">Severity</span>
            <select
              className="bg-transparent text-gray-900 outline-none"
              value={severity}
              onChange={(e) =>
                setSeverity(e.target.value as SeverityKey)
              }
            >
              <option value="all">All</option>
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Syndrome filter (wire to your actual list later) */}
          <div className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-1">
            <span className="text-gray-500">Syndrome</span>
            <select
              className="bg-transparent text-gray-900 outline-none"
              value={syndrome}
              onChange={(e) => setSyndrome(e.target.value)}
            >
              <option value="all">All</option>
              <option value="respiratory">Respiratory</option>
              <option value="systemicSepsis">Systemic sepsis</option>
              <option value="cardio">Cardio / chest pain</option>
              <option value="mental">Mental &amp; behavioural</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Cross-nav into settings */}
          <Link
            href="/settings/insightcore"
            className="rounded-full border bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
          >
            InsightCore settings
          </Link>
        </div>
      </header>

      {err && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {err}
        </div>
      )}
      {loading && (
        <div className="text-xs text-gray-500">
          Loading InsightCore analytics…
        </div>
      )}

      {/* KPI STRIP */}
      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard
          label="Total alerts"
          value={
            kpis ? kpis.totalAlerts.toLocaleString() : '—'
          }
          sub={data?.timeRangeLabel}
        />
        <MetricCard
          label="High severity mix"
          value={
            kpis ? `${kpis.highSeverityPct}%` : '—'
          }
          sub="Share of alerts marked as high severity"
        />
        <MetricCard
          label="Alerts per day"
          value={
            kpis ? `${kpis.alertsPerDay}` : '—'
          }
          sub="Average over selected window"
        />
        <MetricCard
          label="Patients touched"
          value={
            kpis ? kpis.distinctPatients.toLocaleString() : '—'
          }
          sub="Distinct patients with ≥1 alert"
        />
      </section>

      {/* TREND + SUMMARY */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-gray-900">
            Alert volume over time
          </h2>
          <p className="mt-1 text-[11px] text-gray-500">
            Total InsightCore alerts per day in the selected window.
          </p>
          <div className="mt-3">
            <VolumeLineChart points={series} />
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
          <h2 className="text-sm font-medium text-gray-900">
            Quick breakdown
          </h2>
          <p className="text-[11px] text-gray-500">
            Totals by severity across all rules in this view.
          </p>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Low</span>
              <span className="tabular-nums text-gray-900">
                {data
                  ? data.rules
                      .reduce((s, r) => s + r.low, 0)
                      .toLocaleString()
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Moderate</span>
              <span className="tabular-nums text-gray-900">
                {data
                  ? data.rules
                      .reduce((s, r) => s + r.moderate, 0)
                      .toLocaleString()
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">High</span>
              <span className="tabular-nums text-gray-900">
                {data
                  ? data.rules
                      .reduce((s, r) => s + r.high, 0)
                      .toLocaleString()
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* RULE PERFORMANCE TABLE */}
      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-medium text-gray-900">
              Rule performance
            </h2>
            <p className="text-[11px] text-gray-500">
              Aggregate volume, severity mix and average score per rule.
            </p>
          </div>
          <Link
            href="/settings/insightcore/rules"
            className="text-xs text-teal-700 underline"
          >
            Manage rules →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Rule</th>
                <th className="px-4 py-2 font-medium">Syndrome</th>
                <th className="px-4 py-2 font-medium text-right">
                  Alerts
                </th>
                <th className="px-4 py-2 font-medium text-right">
                  High %
                </th>
                <th className="px-4 py-2 font-medium text-right">
                  Avg score
                </th>
                <th className="px-4 py-2 font-medium text-right">
                  Patients
                </th>
                <th className="px-4 py-2 font-medium text-right">
                  Default severity
                </th>
                <th className="px-4 py-2 font-medium text-right">
                  Threshold
                </th>
              </tr>
            </thead>
            <tbody>
              {!sortedRules.length ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-4 text-center text-xs text-gray-500"
                  >
                    No InsightCore rules in this view.
                  </td>
                </tr>
              ) : (
                sortedRules.map((r) => {
                  const highPct =
                    r.total === 0
                      ? 0
                      : Math.round((r.high / r.total) * 100);
                  return (
                    <tr
                      key={r.ruleId}
                      className="border-t text-[11px] hover:bg-gray-50"
                    >
                      <td className="px-4 py-2 text-gray-900">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {r.name || r.ruleKey || r.ruleId}
                          </span>
                          <span className="font-mono text-[10px] text-gray-400">
                            {r.ruleKey || r.ruleId}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-gray-900">
                        {r.syndrome || '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900 tabular-nums">
                        {r.total.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900 tabular-nums">
                        {highPct}%
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900 tabular-nums">
                        {r.avgScore != null
                          ? r.avgScore.toFixed(2)
                          : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900 tabular-nums">
                        {r.distinctPatients.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900">
                        {r.defaultSeverity || '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900 tabular-nums">
                        {r.hardThreshold != null
                          ? r.hardThreshold.toFixed(1)
                          : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
