// apps/admin-dashboard/app/medreach/analytics/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/* ---------- Types ---------- */

type BarItem = { label: string; value: number };
type TrendPoint = { label: string; value: number };

type DrawLogRow = {
  drawId: string;
  orderId: string;
  phleb: string;
  lab: string;
  feeZAR: number;
  status: string;
  payoutZAR: number;
};

type MedreachAnalyticsPayload = {
  timeRangeLabel: string; // e.g. "Last 30 days"
  totalDraws: number;
  completionRatePct: number;
  rescheduleRatePct: number;
  avgTatHours: number;

  breakdown: {
    completed: number;
    rescheduled: number;
    cancelled: number;
  };

  topLabs: BarItem[];
  avgTatTrend: TrendPoint[];
  phlebEarningsByRegion: BarItem[];
  drawLogs: DrawLogRow[];
};

/* ---------- Tiny chart primitives (no deps) ---------- */

function MetricCard(props: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-white px-4 py-3">
      <div className="text-xs font-medium text-gray-500">{props.label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900">
        {props.value}
      </div>
      {props.sub ? (
        <div className="mt-1 text-[11px] text-gray-400">{props.sub}</div>
      ) : null}
    </div>
  );
}

// multi-segment donut for Completed vs Rescheduled vs Cancelled
function MultiDonut({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const size = 180;
  const stroke = 26;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const total = Math.max(
    segments.reduce((s, seg) => s + seg.value, 0),
    1,
  );

  let acc = 0;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-[190px] w-[190px]"
    >
      {/* background ring */}
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={stroke}
      />
      {segments.map((seg) => {
        const segLen = (seg.value / total) * circ;
        const offset = circ - acc - segLen;
        acc += segLen;
        return (
          <circle
            key={seg.label}
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={`${segLen} ${circ - segLen}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${c} ${c})`}
          >
            <title>
              {seg.label}: {seg.value}
            </title>
          </circle>
        );
      })}
      <text
        x="50%"
        y="48%"
        textAnchor="middle"
        className="fill-gray-900 text-[20px] font-semibold"
      >
        {Math.round(((segments[0]?.value ?? 0) / total) * 100)}%
      </text>
      <text
        x="50%"
        y="62%"
        textAnchor="middle"
        className="fill-gray-500 text-[11px]"
      >
        Completed
      </text>
    </svg>
  );
}

// simple line for TAT trend
function LineChart({ points }: { points: TrendPoint[] }) {
  if (!points.length) return null;
  const w = 320;
  const h = 140;
  const pad = 20;
  const max = Math.max(...points.map((p) => p.value), 1);
  const stepX =
    points.length === 1 ? 0 : (w - pad * 2) / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = pad + i * stepX;
      const y = h - pad - (p.value / max) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-[160px] w-full"
    >
      <polyline
        points={`${pad},${h - pad} ${w - pad},${h - pad}`}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={1}
      />
      <polyline
        points={path}
        fill="none"
        stroke="#0f766e"
        strokeWidth={2}
      />
      <title>
        {points
          .map((p) => `${p.label}: ${p.value}h`)
          .join(' • ')}
      </title>
    </svg>
  );
}

// horizontal bar for Top Labs
function HBar({ item, max }: { item: BarItem; max: number }) {
  const pct = max ? (item.value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-gray-800">
        <span className="truncate">{item.label}</span>
        <span className="text-gray-500">{item.value}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100">
        <div
          className="h-2 rounded-full bg-teal-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// vertical bar for Phleb earnings by region
function VBarChart({ items }: { items: BarItem[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex h-[180px] items-end gap-4">
      {items.map((i) => {
        const pct = (i.value / max) * 100;
        return (
          <div
            key={i.label}
            className="flex flex-1 flex-col items-center justify-end gap-2"
          >
            <div
              className="w-8 rounded-md bg-teal-500"
              style={{ height: `${pct}%` }}
              title={`${i.label}: R${i.value.toFixed(0)}`}
            />
            <div className="w-12 text-center text-[11px] text-gray-500">
              {i.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Demo fallback ---------- */

const DEMO_DATA: MedreachAnalyticsPayload = {
  timeRangeLabel: 'Last 30 days',
  totalDraws: 864,
  completionRatePct: 82,
  rescheduleRatePct: 9,
  avgTatHours: 36,
  breakdown: {
    completed: 710,
    rescheduled: 80,
    cancelled: 74,
  },
  topLabs: [
    { label: 'Ambulant Labs — Cape Town', value: 210 },
    { label: 'Ambulant Labs — Johannesburg', value: 190 },
    { label: 'Lancet Partner Site', value: 160 },
    { label: 'PathCare Sandton', value: 130 },
    { label: 'NHLS Partner Hub', value: 100 },
  ],
  avgTatTrend: [
    { label: 'Mar', value: 40 },
    { label: 'Apr', value: 34 },
    { label: 'May', value: 32 },
    { label: 'Jun', value: 36 },
  ],
  phlebEarningsByRegion: [
    { label: 'Gauteng', value: 35200 },
    { label: 'Western Cape', value: 26500 },
    { label: 'KZN', value: 18750 },
    { label: 'Eastern Cape', value: 13200 },
  ],
  drawLogs: [
    {
      drawId: 'DR-00432',
      orderId: 'LAB-00137',
      phleb: 'Isaac N.',
      lab: 'Ambulant Labs — Cape Town',
      feeZAR: 180,
      status: 'Completed',
      payoutZAR: 126,
    },
    {
      drawId: 'DR-00431',
      orderId: 'LAB-00187',
      phleb: 'Thandi S.',
      lab: 'Ambulant Labs — Cape Town',
      feeZAR: 180,
      status: 'Completed',
      payoutZAR: 126,
    },
    {
      drawId: 'DR-00429',
      orderId: 'LAB-00209',
      phleb: 'Jacob M.',
      lab: 'PathCare Sandton',
      feeZAR: 190,
      status: 'Completed',
      payoutZAR: 133,
    },
    {
      drawId: 'DR-00418',
      orderId: 'LAB-00418',
      phleb: 'Jacob M.',
      lab: 'Ambulant Labs — Johannesburg',
      feeZAR: 175,
      status: 'Rescheduled',
      payoutZAR: 80,
    },
    {
      drawId: 'DR-00417',
      orderId: 'LAB-00417',
      phleb: 'Ethan K.',
      lab: 'NHLS Partner Hub',
      feeZAR: 160,
      status: 'Completed',
      payoutZAR: 112,
    },
  ],
};

/* ---------- Page ---------- */

type RangeKey = '7d' | '30d' | '90d';

export default function MedreachAnalyticsPage() {
  const [data, setData] = useState<MedreachAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>('30d');

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const url = new URL('/api/medreach/analytics', window.location.origin);
        url.searchParams.set('range', range);

        const r = await fetch(url.toString(), {
          cache: 'no-store',
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as MedreachAnalyticsPayload;
        if (!mounted) return;
        setData(j);
      } catch (e: any) {
        if (!mounted) return;
        setErr(
          e?.message || 'Using demo MedReach analytics snapshot.',
        );
        setData(DEMO_DATA);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [range]);

  const d = data ?? DEMO_DATA;
  const totalBreakdown =
    d.breakdown.completed +
      d.breakdown.rescheduled +
      d.breakdown.cancelled || 1;

  const completedPct = Math.round(
    (d.breakdown.completed / totalBreakdown) * 100,
  );
  const rescheduledPct = Math.round(
    (d.breakdown.rescheduled / totalBreakdown) * 100,
  );

  const maxTopLabs = Math.max(...d.topLabs.map((p) => p.value), 1);

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">MedReach — Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Home draw volumes, turnaround times, partner lab performance and
            phleb earnings across MedReach.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Range selector */}
          <div className="inline-flex items-center gap-1 rounded-lg border bg-white px-2 py-1">
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

          {/* MedReach view switcher */}
          <div className="inline-flex rounded-full border bg-white overflow-hidden text-[11px]">
            <Link
              href="/medreach"
              className="px-3 py-1.5 border-r hover:bg-gray-50"
            >
              Dashboard
            </Link>
            <Link
              href="/medreach/orders"
              className="px-3 py-1.5 border-r hover:bg-gray-50"
            >
              Phleb timelines
            </Link>
            <Link
              href="/medreach/analytics"
              className="px-3 py-1.5 bg-teal-50 text-teal-700"
            >
              Analytics
            </Link>
          </div>

          <Link
            href="/settings/medreach"
            className="rounded-lg border bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
          >
            Settings
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
          Loading analytics…
        </div>
      )}

      {/* KPI strip */}
      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard
          label="Total Draws"
          value={d.totalDraws.toLocaleString()}
        />
        <MetricCard
          label="Completion Rate"
          value={`${d.completionRatePct}%`}
          sub={`${completedPct}% of draws completed this period`}
        />
        <MetricCard
          label="Reschedule Rate"
          value={`${d.rescheduleRatePct}%`}
          sub={`${rescheduledPct}% rescheduled at least once`}
        />
        <MetricCard
          label="Avg Result TAT"
          value={`${d.avgTatHours}h`}
          sub="From scheduled draw to result ingested"
        />
      </section>

      {/* Breakdown + Top labs */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="text-sm font-medium">
            Completed vs Rescheduled vs Cancelled
          </h2>
          <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-center">
            <MultiDonut
              segments={[
                {
                  label: 'Completed',
                  value: d.breakdown.completed,
                  color: '#0f766e',
                },
                {
                  label: 'Rescheduled',
                  value: d.breakdown.rescheduled,
                  color: '#f97316',
                },
                {
                  label: 'Cancelled',
                  value: d.breakdown.cancelled,
                  color: '#e11d48',
                },
              ]}
            />
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-teal-500" />
                  <span>Completed</span>
                </div>
                <span className="text-gray-700">
                  {completedPct}% ({d.breakdown.completed.toLocaleString()})
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-400" />
                  <span>Rescheduled</span>
                </div>
                <span className="text-gray-700">
                  {rescheduledPct}% ({d.breakdown.rescheduled.toLocaleString()})
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  <span>Cancelled</span>
                </div>
                <span className="text-gray-700">
                  {d.breakdown.cancelled.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <h2 className="text-sm font-medium">Top Labs by Volume</h2>
          <div className="mt-4 space-y-3">
            {d.topLabs.length ? (
              d.topLabs.map((lab) => (
                <HBar key={lab.label} item={lab} max={maxTopLabs} />
              ))
            ) : (
              <div className="text-sm text-gray-500">
                No lab data.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* TAT trend + Phleb earnings */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="text-sm font-medium">Result Turnaround Trend</h2>
          <p className="mt-1 text-[11px] text-gray-500">
            Average hours from home draw to result ingestion over the selected
            period.
          </p>
          <div className="mt-3">
            <LineChart points={d.avgTatTrend} />
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <h2 className="text-sm font-medium">
            Phleb Earnings by Region
          </h2>
          <p className="mt-1 text-[11px] text-gray-500">
            Total payouts to MedReach phlebs grouped by region.
          </p>
          <div className="mt-4">
            <VBarChart items={d.phlebEarningsByRegion} />
          </div>
        </div>
      </section>

      {/* Draw logs table */}
      <section className="rounded-2xl border bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-medium">Draw Logs</h2>
          <button className="rounded-md border bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
            Export
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Draw ID</th>
                <th className="px-4 py-2 font-medium">Order ID</th>
                <th className="px-4 py-2 font-medium">Phleb</th>
                <th className="px-4 py-2 font-medium">Lab</th>
                <th className="px-4 py-2 font-medium">Fee</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Payout</th>
              </tr>
            </thead>
            <tbody>
              {d.drawLogs.length ? (
                d.drawLogs.map((row) => (
                  <tr key={row.drawId} className="border-t text-[11px]">
                    <td className="px-4 py-2 font-mono text-gray-900">
                      {row.drawId}
                    </td>
                    <td className="px-4 py-2 font-mono text-gray-900">
                      {row.orderId}
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      {row.phleb}
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      {row.lab}
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      R {row.feeZAR.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      {row.status}
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      R {row.payoutZAR.toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-4 text-center text-gray-500"
                  >
                    No draw logs in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
