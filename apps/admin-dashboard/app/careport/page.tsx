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
  site?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
};

type StatusFilter = 'all' | 'pending' | 'in-progress' | 'done' | 'failed';

export default function CarePortDashboard() {
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  async function load() {
    setLoading(true);
    setErr(null);
    setWarnings([]);

    try {
      const response = await fetch('/api/orders/index?scope=all', {
        cache: 'no-store',
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.error || 'CarePort request failed with HTTP ' + response.status,
        );
      }

      const nextRows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.rows)
          ? payload.rows
          : [];

      const nextWarnings = Array.isArray(payload?.warnings)
        ? payload.warnings
            .map((warning: unknown) => String(warning || '').trim())
            .filter(Boolean)
        : [];

      setRows(nextRows);
      setWarnings(nextWarnings);
    } catch (error: any) {
      setRows([]);
      setWarnings([]);
      setErr(
        error?.message ||
          'Live CarePort orders could not be loaded. Please retry.',
      );
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

  const carePortKpis = useMemo(() => {
    const now = Date.now();
    const last24Hours = now - 24 * 60 * 60 * 1000;

    const recentOrders = pharm.filter((row) => {
      if (!row.createdAt) return false;

      const timestamp = new Date(row.createdAt).getTime();

      return (
        Number.isFinite(timestamp) &&
        timestamp >= last24Hours &&
        timestamp <= now
      );
    });

    const completedRecent = recentOrders.filter(
      (row) => row.status === 'done',
    ).length;

    const tatHours = pharm
      .map((row) => {
        if (!row.createdAt) return null;

        const completedAt = row.deliveredAt || row.dispatchedAt;

        if (!completedAt) return null;

        const started = new Date(row.createdAt).getTime();
        const completed = new Date(completedAt).getTime();

        if (
          !Number.isFinite(started) ||
          !Number.isFinite(completed) ||
          completed < started
        ) {
          return null;
        }

        return (completed - started) / 36e5;
      })
      .filter((value): value is number => value !== null);

    return {
      fulfillment24h:
        recentOrders.length > 0
          ? Math.round((completedRecent / recentOrders.length) * 100)
          : null,
      avgTatHours:
        tatHours.length > 0
          ? Math.round(
              (tatHours.reduce((sum, value) => sum + value, 0) /
                tatHours.length) *
                10,
            ) / 10
          : null,
      failedOrders: pharm.filter((row) => row.status === 'failed').length,
    };
  }, [pharm]);

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

      {warnings.map((warning) => (
        <div
          key={warning}
          className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800"
        >
          {warning}
        </div>
      ))}

      {err ? (
        <div className="flex flex-col gap-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-medium">Live CarePort orders unavailable</div>
            <div className="mt-1 text-xs">{err}</div>
          </div>

          <button
            type="button"
            onClick={load}
            className="self-start rounded border border-red-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-red-100 sm:self-auto"
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* KPIs + TIMELINE + LEGEND */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* KPIs + legend */}
        <div className="lg:col-span-1 space-y-3">
          <div className="border rounded-lg p-4 bg-white">
            <div className="text-xs text-gray-500">Fulfillment (24h)</div>
            <div className="text-2xl font-semibold">
              {carePortKpis.fulfillment24h == null
                ? '—'
                : carePortKpis.fulfillment24h + '%'}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Completed pharmacy orders created during the last 24 hours.
            </div>
          </div>
          <div className="border rounded-lg p-4 bg-white">
            <div className="text-xs text-gray-500">Avg. recorded TAT</div>
            <div className="text-2xl font-semibold">
              {carePortKpis.avgTatHours == null
                ? '—'
                : carePortKpis.avgTatHours.toLocaleString('en-ZA', {
                    maximumFractionDigits: 1,
                  }) + 'h'}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Based only on orders with a recorded dispatch or delivery time.
            </div>
          </div>
          <div className="border rounded-lg p-4 bg-white">
            <div className="text-xs text-gray-500">Failed orders</div>
            <div className="text-2xl font-semibold">
              {carePortKpis.failedOrders.toLocaleString('en-ZA')}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Live pharmacy orders currently classified as failed.
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
              {err
                ? 'CarePort orders are unavailable until the live request succeeds.'
                : pharm.length === 0
                  ? 'No CarePort pharmacy orders have been recorded yet.'
                  : 'No pharmacy orders match the selected status filter.'}
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
