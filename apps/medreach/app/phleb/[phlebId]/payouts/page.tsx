// apps/medreach/app/phleb/[phlebId]/payouts/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { JobStatus } from '@shared/fsm';

type PerJob = {
  jobId: string;
  displayId: string;
  status: JobStatus;
  createdAt: string;
  deliveredAt?: string | null;
  distanceKm?: number;
  earningsZAR: number;
};

type PhlebMetricsResponse = {
  scope: 'phleb';
  phlebId: string;
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
  perJob: PerJob[];
};

export default function PhlebPayoutsPage() {
  const params = useParams<{ phlebId: string }>();
  const phlebId = params.phlebId;

  const [metrics, setMetrics] = useState<PhlebMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/metrics?scope=phleb&id=${encodeURIComponent(phlebId)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as PhlebMetricsResponse;
        if (!mounted) return;
        setMetrics(data);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || 'Unable to load payouts');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [phlebId]);

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8 text-sm text-gray-500">
        Loading payouts…
      </main>
    );
  }

  if (err || !metrics) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8 text-sm text-red-600">
        {err || 'Unable to load payouts.'}
      </main>
    );
  }

  const payoutRate = 0.7;
  const platformRate = 0.3;

  const payoutToday = metrics.earnings.todayZAR * payoutRate;
  const payoutWeek = metrics.earnings.thisWeekZAR * payoutRate;
  const payoutMonth = metrics.earnings.thisMonthZAR * payoutRate;
  const payoutAllTime = metrics.earnings.allTimeZAR * payoutRate;

  const perJobWithPayout = metrics.perJob.map((j) => ({
    ...j,
    payoutZAR: j.earningsZAR * payoutRate,
    platformShareZAR: j.earningsZAR * platformRate,
  }));

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            Payouts — {phlebId}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Earnings are based on completed delivery fees. Your payout share is 70% of the
            total delivery fee; 30% goes to the platform.
          </p>
        </div>
      </header>

      {/* Summary cards */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">Payout Today</div>
          <div className="text-2xl font-semibold mt-1">
            R {payoutToday.toFixed(2)}
          </div>
        </div>
        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">This Week</div>
          <div className="text-2xl font-semibold mt-1">
            R {payoutWeek.toFixed(2)}
          </div>
        </div>
        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">This Month</div>
          <div className="text-2xl font-semibold mt-1">
            R {payoutMonth.toFixed(2)}
          </div>
        </div>
        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">All Time</div>
          <div className="text-2xl font-semibold mt-1">
            R {payoutAllTime.toFixed(2)}
          </div>
        </div>
      </section>

      {/* Per-job breakdown */}
      <section className="bg-white border rounded-xl p-6 shadow-sm text-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Per-Job Payouts</h2>
        {perJobWithPayout.length === 0 ? (
          <div className="text-xs text-gray-500">
            No jobs yet. Once you complete MedReach jobs, payouts will be calculated here.
          </div>
        ) : (
          <div className="border rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-2 py-1 text-left">Job</th>
                  <th className="px-2 py-1 text-left">Created</th>
                  <th className="px-2 py-1 text-right">Distance (km)</th>
                  <th className="px-2 py-1 text-right">Delivery fee</th>
                  <th className="px-2 py-1 text-right">Your payout (70%)</th>
                  <th className="px-2 py-1 text-right">Platform share (30%)</th>
                  <th className="px-2 py-1 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {perJobWithPayout.map((j) => (
                  <tr key={j.jobId} className="border-t">
                    <td className="px-2 py-1 font-mono text-[11px]">
                      {j.displayId}
                    </td>
                    <td className="px-2 py-1">
                      {new Date(j.createdAt).toLocaleString()}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {j.distanceKm != null ? j.distanceKm.toFixed(1) : '—'}
                    </td>
                    <td className="px-2 py-1 text-right">
                      R {j.earningsZAR.toFixed(2)}
                    </td>
                    <td className="px-2 py-1 text-right font-semibold text-emerald-600">
                      R {j.payoutZAR.toFixed(2)}
                    </td>
                    <td className="px-2 py-1 text-right text-gray-500">
                      R {j.platformShareZAR.toFixed(2)}
                    </td>
                    <td className="px-2 py-1">
                      {j.status === 'DELIVERED_TO_LAB'
                        ? 'Completed'
                        : j.status.replace(/_/g, ' ').toLowerCase()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-gray-400">
          Actual payout timing (weekly / monthly) and bank settlement rules can be wired
          later via the payments provider / API gateway. This page focuses on the
          calculation logic and per-job transparency.
        </p>
      </section>
    </main>
  );
}
