// apps/medreach/app/lab/[labId]/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type LabMetricsResponse = {
  scope: 'lab';
  labId: string;
  summary: {
    ordersToday: number;
    ordersThisWeek: number;
    ordersThisMonth: number;
    marketplaceOpen: number;
    deliveredToLab: number;
    resultsPending: number;
    resultsReady: number;
    resultsSent: number;
  };
};

export default function LabDashboardPage() {
  const params = useParams<{ labId: string }>();
  const labId = params.labId;

  const [metrics, setMetrics] = useState<LabMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const niceLabName =
    labId
      .split('-')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/metrics?scope=lab&id=${encodeURIComponent(labId)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as LabMetricsResponse;
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
  }, [labId]);

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8 text-sm text-gray-500">
        Loading lab dashboard…
      </main>
    );
  }

  if (err || !metrics) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8 text-sm text-red-600">
        {err || 'Unable to load lab dashboard.'}
      </main>
    );
  }

  const s = metrics.summary;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            {niceLabName} — Dashboard
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Volume and results status overview for this lab. Backed by the same order
            stream as the lab workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href={`/lab/${encodeURIComponent(labId)}`}
            className="px-3 py-1 rounded-full border bg-white hover:bg-gray-50"
          >
            Open workspace
          </Link>
          <Link
            href={`/lab/${encodeURIComponent(labId)}/tests`}
            className="px-3 py-1 rounded-full border bg-white hover:bg-gray-50"
          >
            Test catalogue
          </Link>
          <Link
            href={`/lab/${encodeURIComponent(labId)}/settings`}
            className="px-3 py-1 rounded-full border bg-white hover:bg-gray-50"
          >
            Lab settings
          </Link>
        </div>
      </header>

      {/* Orders volume */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">Orders Today</div>
          <div className="text-2xl font-semibold mt-1">
            {s.ordersToday}
          </div>
        </div>
        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">Orders This Week</div>
          <div className="text-2xl font-semibold mt-1">
            {s.ordersThisWeek}
          </div>
        </div>
        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">Orders This Month</div>
          <div className="text-2xl font-semibold mt-1">
            {s.ordersThisMonth}
          </div>
        </div>
        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">Marketplace Open</div>
          <div className="text-2xl font-semibold mt-1">
            {s.marketplaceOpen}
          </div>
        </div>
      </section>

      {/* Results status */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">Delivered to Lab</div>
          <div className="text-2xl font-semibold mt-1">
            {s.deliveredToLab}
          </div>
        </div>
        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">Results Pending</div>
          <div className="text-2xl font-semibold mt-1">
            {s.resultsPending}
          </div>
        </div>
        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">Results Ready</div>
          <div className="text-2xl font-semibold mt-1">
            {s.resultsReady}
          </div>
        </div>
        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">Results Sent</div>
          <div className="text-2xl font-semibold mt-1">
            {s.resultsSent}
          </div>
        </div>
      </section>
    </main>
  );
}
