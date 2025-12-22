'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Timeline, { TimelineItem } from '@/components/Timeline';
import StatusLegend from '@/components/StatusLegend';

type OrderRow = {
  id: string;
  kind: 'pharmacy' | 'lab';
  encounterId: string;
  sessionId: string;
  caseId: string;
  createdAt?: string;
  title?: string;
  details?: string;
  priceZAR?: number;
  status?: 'pending' | 'in-progress' | 'done' | 'failed';
};

type StatusFilter = 'all' | 'pending' | 'in-progress' | 'done' | 'failed';

export default function CarePortDashboard() {
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch('/api/orders/index?scope=all', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setRows(Array.isArray(json) ? json : []);
    } catch (e: any) {
      setRows([
        {
          id: 'rx-10021',
          kind: 'pharmacy',
          encounterId: 'enc-za-001',
          sessionId: 'sess-01',
          caseId: 'case-01',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
          title: 'Atorvastatin 20mg',
          details: '1 tab nightly × 30',
          priceZAR: 189.99,
          status: 'done',
        },
        {
          id: 'rx-10022',
          kind: 'pharmacy',
          encounterId: 'enc-za-003',
          sessionId: 'sess-12',
          caseId: 'case-05',
          createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
          title: 'Amlodipine 5mg',
          details: '1 tab daily × 30',
          priceZAR: 142.5,
          status: 'in-progress',
        },
      ]);
      setErr(e?.message || 'Fell back to demo data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const pharm = useMemo(
    () => (Array.isArray(rows) ? rows.filter((r) => r.kind === 'pharmacy') : []),
    [rows],
  );

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return pharm;
    return pharm.filter((r) => (r.status ?? 'pending') === statusFilter);
  }, [pharm, statusFilter]);

  const timeline: TimelineItem[] = filtered.map((r) => ({
    id: r.id,
    when: r.createdAt || new Date(),
    title: r.title || r.id,
    description: r.details
      ? `${r.details} • ${r.encounterId} • ${r.sessionId}`
      : `${r.encounterId} • ${r.sessionId}`,
    meta: r.priceZAR != null ? `R${r.priceZAR.toFixed(2)}` : undefined,
    status: r.status ?? 'pending',
    href: `/careport/orders/${r.id}`,
  }));

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">CarePort — Pharmacy Ops</h1>
          <p className="text-sm text-gray-500 mt-1">
            Central view of pharmacy eRx orders flowing through CarePort riders.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* Product switcher (CarePort vs MedReach vs merged) */}
          <div className="inline-flex rounded-full border bg-white overflow-hidden text-xs">
            <Link
              href="/careport"
              className="px-3 py-1.5 border-r bg-indigo-50 text-indigo-700"
            >
              Pharmacy
            </Link>
            <Link
              href="/medreach"
              className="px-3 py-1.5 border-r hover:bg-gray-50"
            >
              Lab
            </Link>
            <Link
              href="/orders"
              className="px-3 py-1.5 hover:bg-gray-50"
            >
              Merged orders
            </Link>
          </div>

          {/* CarePort local nav + refresh */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={load}
              className="px-3 py-1 rounded border bg-white hover:bg-gray-50 text-sm"
            >
              Refresh
            </button>
            <div className="inline-flex rounded-full border bg-white overflow-hidden text-xs">
              <Link
                href="/careport"
                className="px-3 py-1.5 border-r bg-indigo-50 text-indigo-700"
              >
                Dashboard
              </Link>
              <Link
                href="/careport/analytics"
                className="px-3 py-1.5 border-r hover:bg-gray-50"
              >
                Analytics
              </Link>
              <Link
                href="/careport/orders"
                className="px-3 py-1.5 hover:bg-gray-50"
              >
                Rider timelines
              </Link>
            </div>
          </div>
        </div>
      </header>

      {err ? (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
          {err}
        </div>
      ) : null}

      {/* KPIs + TIMELINE + LEGEND */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* KPIs + legend */}
        <div className="lg:col-span-1 space-y-3">
          <div className="border rounded-lg p-4 bg-white">
            <div className="text-xs text-gray-500">Fulfillment (24h)</div>
            <div className="text-2xl font-semibold">92%</div>
            <div className="text-xs text-gray-400 mt-1">
              Jobs completed vs dispatched in the last 24h.
            </div>
          </div>
          <div className="border rounded-lg p-4 bg-white">
            <div className="text-xs text-gray-500">Avg. TAT</div>
            <div className="text-2xl font-semibold">3h 20m</div>
            <div className="text-xs text-gray-400 mt-1">
              From eRx created to delivery marked as complete.
            </div>
          </div>
          <div className="border rounded-lg p-4 bg-white">
            <div className="text-xs text-gray-500">Open Issues</div>
            <div className="text-2xl font-semibold">4</div>
            <div className="text-xs text-gray-400 mt-1">
              Orders stuck in exception / manual review.
            </div>
          </div>

          <StatusLegend variant="careport" />
        </div>

        {/* Timeline + filters */}
        <div className="lg:col-span-2 border rounded-lg p-4 bg-white space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <h2 className="font-medium">Recent Pharmacy Orders</h2>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">Filter status:</span>
                <div className="inline-flex rounded-full border bg-white overflow-hidden">
                  {(['all', 'pending', 'in-progress', 'done'] as StatusFilter[]).map(
                    (s) => (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-2.5 py-1 border-r last:border-r-0 ${
                          statusFilter === s
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-white'
                        }`}
                      >
                        {s === 'all'
                          ? 'All'
                          : s === 'in-progress'
                          ? 'In progress'
                          : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ),
                  )}
                </div>
              </div>
              <StatusLegend variant="careport" compact />
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-gray-500 mt-1">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-gray-500 mt-1">
              No pharmacy orders in this view. Try clearing filters or refresh.
            </div>
          ) : (
            <Timeline items={timeline} />
          )}

          <div className="mt-3 flex justify-between items-center text-xs text-gray-500">
            <div>
              Showing {filtered.length} of {pharm.length} pharmacy orders
              {rows && ` (total: ${rows.length} including lab)`}.
            </div>
            <Link
              href="/careport/orders"
              className="underline text-indigo-700"
            >
              Open rider timelines →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
