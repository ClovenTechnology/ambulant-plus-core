'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import type { JobStatus } from '@shared/fsm';
import { getStatusLabel, getStatusClasses } from '@shared/fsm';

type MetricsResponse = {
  scope: 'phleb';
  phlebId: string;
  config: {
    baseCalloutFeeZAR: number;
    perKmAfterFreeZAR: number;
    freeKm: number;
  };
  summary: {
    jobsToday: number;
    jobsThisWeek: number;
    jobsThisMonth: number;
    activeJobs: number;
  };
  earnings: {
    todayZAR: number;
    thisWeekZAR: number;
    thisMonthZAR: number;
    allTimeZAR: number;
  };
  perJob: {
    jobId: string;
    displayId: string;
    status: JobStatus;
    createdAt: string;
    deliveredAt?: string | null;
    distanceKm?: number;
    earningsZAR: number;
  }[];
};

type RangeFilter = '7d' | '30d' | 'all';

export default function PhlebDashboardPage() {
  const params = useParams<{ phlebId: string }>();
  const phlebId = params.phlebId;

  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [range, setRange] = useState<RangeFilter>('7d');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/metrics?scope=phleb&id=${encodeURIComponent(phlebId)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as MetricsResponse;
        if (!mounted) return;
        setMetrics(data);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || 'Unable to load metrics');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [phlebId]);

  const name =
    phlebId
      .split('-')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');

  const filteredJobs = useMemo(() => {
    if (!metrics) return [];
    const jobs = metrics.perJob;
    if (range === 'all') return jobs;

    const now = new Date();
    let cutoff = new Date(now);
    if (range === '7d') {
      cutoff.setDate(now.getDate() - 7);
    } else if (range === '30d') {
      cutoff.setDate(now.getDate() - 30);
    }
    const cutoffMs = cutoff.getTime();

    return jobs.filter(
      (job) => new Date(job.createdAt).getTime() >= cutoffMs,
    );
  }, [metrics, range]);

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8 text-sm text-gray-500">
        Loading dashboard…
      </main>
    );
  }

  if (err || !metrics) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8 text-sm text-red-600">
        {err || 'Unable to load dashboard.'}
      </main>
    );
  }

  const { summary, earnings, config } = metrics;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            {name} — Dashboard
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Performance, earnings, and job history. Callout fee rules: base R
            {config.baseCalloutFeeZAR.toFixed(2)} + R
            {config.perKmAfterFreeZAR.toFixed(2)} per km after the first{' '}
            {config.freeKm} km.
          </p>
        </div>
      </header>

      {/* Top metrics */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">Jobs Today</div>
          <div className="text-2xl font-semibold mt-1">
            {summary.jobsToday}
          </div>
        </div>
        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">Jobs This Week</div>
          <div className="text-2xl font-semibold mt-1">
            {summary.jobsThisWeek}
          </div>
        </div>
        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">Jobs This Month</div>
          <div className="text-2xl font-semibold mt-1">
            {summary.jobsThisMonth}
          </div>
        </div>
        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">Active Jobs</div>
          <div className="text-2xl font-semibold mt-1">
            {summary.activeJobs}
          </div>
        </div>
      </section>

      {/* Earnings summary */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">Earnings Today</div>
          <div className="text-2xl font-semibold mt-1">
            R {earnings.todayZAR.toFixed(2)}
          </div>
        </div>
        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">This Week</div>
          <div className="text-2xl font-semibold mt-1">
            R {earnings.thisWeekZAR.toFixed(2)}
          </div>
        </div>
        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">This Month</div>
          <div className="text-2xl font-semibold mt-1">
            R {earnings.thisMonthZAR.toFixed(2)}
          </div>
        </div>
        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">All Time</div>
          <div className="text-2xl font-semibold mt-1">
            R {earnings.allTimeZAR.toFixed(2)}
          </div>
        </div>
      </section>

      {/* Past jobs & earnings */}
      <section className="bg-white border rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Past Jobs & Earnings
          </h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">Range:</span>
            <button
              type="button"
              onClick={() => setRange('7d')}
              className={
                'px-2 py-1 rounded border text-xs ' +
                (range === '7d'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700')
              }
            >
              Last 7 days
            </button>
            <button
              type="button"
              onClick={() => setRange('30d')}
              className={
                'px-2 py-1 rounded border text-xs ' +
                (range === '30d'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700')
              }
            >
              Last 30 days
            </button>
            <button
              type="button"
              onClick={() => setRange('all')}
              className={
                'px-2 py-1 rounded border text-xs ' +
                (range === 'all'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700')
              }
            >
              All time
            </button>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-500">
                  Order
                </th>
                <th className="text-left px-3 py-2 font-medium text-gray-500">
                  Status
                </th>
                <th className="text-left px-3 py-2 font-medium text-gray-500">
                  Created
                </th>
                <th className="text-right px-3 py-2 font-medium text-gray-500">
                  Distance
                </th>
                <th className="text-right px-3 py-2 font-medium text-gray-500">
                  Earnings
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-4 text-center text-gray-500"
                  >
                    No jobs in this range.
                  </td>
                </tr>
              )}
              {filteredJobs.map((job) => (
                <tr
                  key={job.jobId}
                  className="border-t hover:bg-gray-50"
                >
                  <td className="px-3 py-2 align-middle">
                    <div className="font-medium text-gray-900">
                      {job.displayId}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {job.jobId}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <span
                      className={
                        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ' +
                        getStatusClasses(job.status)
                      }
                    >
                      {getStatusLabel(job.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle text-gray-700">
                    {new Date(job.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 align-middle text-right text-gray-700">
                    {job.distanceKm != null
                      ? `${job.distanceKm.toFixed(1)} km`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 align-middle text-right font-semibold text-gray-900">
                    R {job.earningsZAR.toFixed(2)}
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
