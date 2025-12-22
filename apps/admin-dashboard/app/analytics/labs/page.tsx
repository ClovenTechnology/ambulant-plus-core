// apps/admin-dashboard/app/analytics/labs/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type RangeKey = 'today' | '7d' | '30d';

type TatBucket = { label: string; count: number };
type TrendPoint = { date: string; onTimePct: number };

type LabRow = {
  id: string;
  name: string;
  city?: string | null;
  orders: number;
  homeCollections: number;
  revenueZAR: number;
  avgTatHours: number;
  onTimePct: number;
  criticals: number;
  cancellations: number;

  tatBuckets?: TatBucket[];
  onTimeTrend?: TrendPoint[];
};

type TopTestRow = {
  code: string;
  name: string;
  orders: number;
  revenueZAR: number;
  avgTatHours: number;
};

type LabAnalyticsResponse = {
  range: RangeKey;
  generatedAt: string;
  totals: {
    orders: number;
    homeCollections: number;
    revenueZAR: number;
    onTimePct: number;
    avgTatHours: number;
    criticals: number;
  };
  labs: LabRow[];
  topTests: TopTestRow[];
};

export default function LabAnalyticsPage() {
  const [data, setData] = useState<LabAnalyticsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<RangeKey>('7d');
  const [labFilter, setLabFilter] = useState<string>('all');

  async function load(currentRange: RangeKey = range) {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      params.set('range', currentRange);
      const res = await fetch(`/api/analytics/labs?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const js = (await res.json()) as LabAnalyticsResponse;
      setData(js);
    } catch (e: any) {
      console.error('Lab analytics load failed', e);
      setErr(
        e?.message ||
          'Unable to load lab analytics. Check /api/analytics/labs implementation.',
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const labs = data?.labs ?? [];

  const labOptions = useMemo(() => {
    const uniq = new Map<string, string>();
    for (const l of labs) {
      uniq.set(l.id, l.name);
    }
    return Array.from(uniq.entries()).map(([id, name]) => ({ id, name }));
  }, [labs]);

  const filteredLabs = useMemo(() => {
    if (!labs.length) return [];
    if (labFilter === 'all') return labs;
    return labs.filter((l) => l.id === labFilter);
  }, [labs, labFilter]);

  const selectedLab =
    labFilter === 'all'
      ? null
      : labs.find((l) => l.id === labFilter) ?? null;

  const totals = data?.totals;

  const homeCollectionShare =
    totals && totals.orders > 0
      ? Math.round((totals.homeCollections / totals.orders) * 100)
      : 0;

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <header className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold">Lab Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Network-level view of lab order volume, turnaround times and
            MedReach performance across partner labs.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-xs">
          <div className="inline-flex overflow-hidden rounded-full border bg-white">
            <Link
              href="/labs"
              className="border-r px-3 py-1.5 hover:bg-gray-50"
            >
              Labs overview
            </Link>
            <Link
              href="/analytics/labs"
              className="bg-teal-50 px-3 py-1.5 text-teal-700"
            >
              Lab analytics
            </Link>
            <Link
              href="/medreach"
              className="border-l px-3 py-1.5 hover:bg-gray-50"
            >
              MedReach ops
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {/* Range selector */}
            <div className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-1">
              <span className="text-gray-500">Range</span>
              <select
                className="bg-transparent text-gray-900 outline-none"
                value={range}
                onChange={(e) => setRange(e.target.value as RangeKey)}
              >
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </div>
            <button
              onClick={() => load(range)}
              className="rounded border bg-white px-3 py-1 text-sm hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>

          {data?.generatedAt && (
            <div className="text-[11px] text-gray-500">
              Generated at{' '}
              {new Date(data.generatedAt).toLocaleString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: 'short',
              })}
            </div>
          )}
        </div>
      </header>

      {err && (
        <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          {err}
        </div>
      )}

      {/* KPI strip */}
      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-white px-4 py-3">
          <div className="text-xs text-gray-500">Lab orders</div>
          <div className="mt-1 text-xl font-semibold">
            {totals ? totals.orders.toLocaleString() : '—'}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            All lab orders in the selected range.
          </div>
        </div>
        <div className="rounded-xl border bg-white px-4 py-3">
          <div className="text-xs text-gray-500">Home collections</div>
          <div className="mt-1 text-xl font-semibold">
            {totals ? totals.homeCollections.toLocaleString() : '—'}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            {totals
              ? `${homeCollectionShare}% of all lab orders`
              : 'Share of lab orders routed via MedReach.'}
          </div>
        </div>
        <div className="rounded-xl border bg-white px-4 py-3">
          <div className="text-xs text-gray-500">On-time results</div>
          <div className="mt-1 text-xl font-semibold">
            {totals ? `${Math.round(totals.onTimePct)}%` : '—'}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            Results delivered within target TAT (lab SLA).
          </div>
        </div>
        <div className="rounded-xl border bg-white px-4 py-3">
          <div className="text-xs text-gray-500">Avg. lab TAT</div>
          <div className="mt-1 text-xl font-semibold">
            {totals ? `${totals.avgTatHours.toFixed(1)} h` : '—'}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            From sample received at lab to result available.
          </div>
        </div>
      </section>

      {/* Lab detail + filters + per-lab charts */}
      <section className="grid gap-4 md:grid-cols-3">
        {/* Labs table */}
        <div className="md:col-span-2 space-y-3 rounded-2xl border bg-white p-4">
          <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
            <h2 className="text-sm font-semibold text-gray-900">
              Labs performance
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-500">Filter lab:</span>
              <select
                value={labFilter}
                onChange={(e) => setLabFilter(e.target.value)}
                className="rounded-full border bg-white px-3 py-1 text-gray-900"
              >
                <option value="all">All labs</option>
                {labOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading && (
            <div className="text-sm text-gray-500">Loading analytics…</div>
          )}

          {!loading && filteredLabs.length === 0 && (
            <div className="text-sm text-gray-500">
              No labs found in this range.
            </div>
          )}

          {!loading && filteredLabs.length > 0 && (
            <div className="overflow-x-auto text-xs">
              <table className="min-w-full border">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="border-b px-2 py-1 text-left">Lab</th>
                    <th className="border-b px-2 py-1 text-right">Orders</th>
                    <th className="border-b px-2 py-1 text-right">
                      Home collections
                    </th>
                    <th className="border-b px-2 py-1 text-right">Revenue</th>
                    <th className="border-b px-2 py-1 text-right">
                      On-time %
                    </th>
                    <th className="border-b px-2 py-1 text-right">
                      Avg. TAT (h)
                    </th>
                    <th className="border-b px-2 py-1 text-right">
                      Critical flags
                    </th>
                    <th className="border-b px-2 py-1 text-right">
                      Cancellations
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLabs.map((l) => {
                    const homeShare =
                      l.orders > 0
                        ? Math.round(
                            (l.homeCollections / l.orders) * 100,
                          )
                        : 0;
                    return (
                      <tr key={l.id} className="border-t">
                        <td className="px-2 py-1 align-top">
                          <div className="font-medium text-gray-900">
                            {l.name}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {l.city || '—'} • Home collections {homeShare}%
                          </div>
                        </td>
                        <td className="px-2 py-1 text-right align-top">
                          {l.orders.toLocaleString()}
                        </td>
                        <td className="px-2 py-1 text-right align-top">
                          {l.homeCollections.toLocaleString()}
                        </td>
                        <td className="px-2 py-1 text-right align-top font-mono">
                          R {l.revenueZAR.toFixed(0)}
                        </td>
                        <td className="px-2 py-1 text-right align-top">
                          {Math.round(l.onTimePct)}%
                        </td>
                        <td className="px-2 py-1 text-right align-top">
                          {l.avgTatHours.toFixed(1)}
                        </td>
                        <td className="px-2 py-1 text-right align-top">
                          {l.criticals}
                        </td>
                        <td className="px-2 py-1 text-right align-top">
                          {l.cancellations}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-2 text-[11px] text-gray-500">
            Orders &amp; revenue are based on billable lab tests; MedReach
            fees, courier costs and refunds can be layered in a future view.
          </div>
        </div>

        {/* Right column: top tests + per-lab charts */}
        <div className="space-y-3">
          {/* Top tests */}
          <div className="space-y-3 rounded-2xl border bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">
              Top ordered tests
            </h2>
            {loading && (
              <div className="text-sm text-gray-500">Loading tests…</div>
            )}
            {!loading &&
              (!data?.topTests || data.topTests.length === 0) && (
                <div className="text-sm text-gray-500">
                  No tests in this range.
                </div>
              )}
            {!loading &&
              data?.topTests &&
              data.topTests.length > 0 && (
                <ul className="space-y-2 text-xs">
                  {data.topTests.slice(0, 6).map((t) => (
                    <li
                      key={t.code}
                      className="flex items-start justify-between gap-2 border-b pb-1 last:border-b-0 last:pb-0"
                    >
                      <div>
                        <div className="font-medium text-gray-900">
                          {t.name}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {t.code} • {t.orders.toLocaleString()} orders
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono">
                          R {t.revenueZAR.toFixed(0)}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {t.avgTatHours.toFixed(1)} h
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            <div className="mt-2 text-[11px] text-gray-500">
              Useful for kit curation, lab menu optimisation and MedReach
              route planning.
            </div>
          </div>

          {/* Per-lab charts */}
          <div className="space-y-3 rounded-2xl border bg-white p-4 text-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                Per-lab TAT &amp; on-time trend
              </h2>
              {selectedLab && (
                <span className="text-[11px] text-gray-500">
                  {selectedLab.name}
                </span>
              )}
            </div>

            {!selectedLab && (
              <div className="text-[11px] text-gray-500">
                Select a specific lab in the filter to see its TAT
                distribution and on-time trend.
              </div>
            )}

            {selectedLab && (
              <>
                {/* TAT distribution */}
                <div>
                  <div className="mb-1 text-[11px] font-semibold text-gray-800">
                    Turnaround time distribution
                  </div>
                  {selectedLab.tatBuckets &&
                  selectedLab.tatBuckets.length > 0 ? (
                    <div className="space-y-2">
                      {(() => {
                        const buckets = selectedLab.tatBuckets!;
                        const max = Math.max(
                          ...buckets.map((b) => b.count || 0),
                          1,
                        );
                        return buckets.map((b) => {
                          const pct = Math.round(
                            (b.count / max) * 100,
                          );
                          return (
                            <div
                              key={b.label}
                              className="flex items-center gap-2"
                            >
                              <span className="w-20 text-[11px] text-gray-600">
                                {b.label}
                              </span>
                              <div className="flex-1">
                                <div className="h-2 w-full rounded-full bg-gray-100">
                                  <div
                                    className="h-2 rounded-full bg-teal-600"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                              <span className="w-10 text-right text-[11px] text-gray-500">
                                {b.count}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-500">
                      No TAT bucket data for this lab.
                    </div>
                  )}
                </div>

                {/* On-time trend */}
                <div>
                  <div className="mb-1 mt-3 text-[11px] font-semibold text-gray-800">
                    On-time results trend
                  </div>
                  {selectedLab.onTimeTrend &&
                  selectedLab.onTimeTrend.length > 1 ? (
                    <div className="space-y-1">
                      <svg
                        viewBox="0 0 100 40"
                        preserveAspectRatio="none"
                        className="h-20 w-full rounded border bg-gray-50"
                      >
                        <polyline
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1"
                          className="text-teal-600"
                          points={buildTrendPoints(
                            selectedLab.onTimeTrend,
                          )}
                        />
                      </svg>
                      <div className="flex justify-between text-[10px] text-gray-500">
                        <span>
                          {formatTrendLabel(
                            selectedLab.onTimeTrend[0].date,
                          )}
                        </span>
                        <span>
                          {formatTrendLabel(
                            selectedLab.onTimeTrend[
                              selectedLab.onTimeTrend.length - 1
                            ].date,
                          )}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-500">
                      On-time trend not available for this lab in the
                      selected range.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function buildTrendPoints(points: TrendPoint[]): string {
  if (!points.length) return '';
  const maxY = 100;
  const minY = 0;
  const n = points.length;

  return points
    .map((p, idx) => {
      const x =
        n === 1 ? 0 : (idx / (n - 1)) * 100; // 0..100
      const clamped = Math.max(
        minY,
        Math.min(maxY, p.onTimePct),
      );
      const y =
        100 - ((clamped - minY) / (maxY - minY)) * 100; // invert for SVG
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function formatTrendLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
