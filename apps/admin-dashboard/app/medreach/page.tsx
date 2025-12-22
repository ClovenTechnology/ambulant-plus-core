// apps/admin-dashboard/app/medreach/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Timeline, { TimelineItem } from '@/components/Timeline';
import StatusLegend from '@/components/StatusLegend';

type MedReachStatus = 'Assigned' | 'EnRoute' | 'Arrived' | 'Completed' | 'Canceled';

type RangeKey = 'today' | '7d' | '30d';

type StatusFilter = 'all' | MedReachStatus;

type JobRow = {
  id: string;
  externalId: string;
  labName: string;
  phlebName?: string | null;
  patientName: string;
  patientAddress: string;
  windowLabel?: string | null;
  status: MedReachStatus;
  eta?: string | null; // UI label, e.g. "10–11am"
  etaAt?: string | null; // ISO
  createdAt: string; // ISO
};

// Map MedReach status -> Timeline status keys used by StatusLegend("medreach")
type TimelineStatus = 'pending' | 'in-progress' | 'done' | 'failed';

function mapStatusToTimeline(status: MedReachStatus): TimelineStatus {
  switch (status) {
    case 'Assigned':
      return 'pending';
    case 'EnRoute':
    case 'Arrived':
      return 'in-progress';
    case 'Completed':
      return 'done';
    case 'Canceled':
    default:
      return 'failed';
  }
}

export default function MedReachDashboard() {
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [range, setRange] = useState<RangeKey>('7d');

  async function load(currentRange: RangeKey = range) {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      params.set('range', currentRange);

      const r = await fetch(`/api/medreach/jobs?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setJobs(Array.isArray(json?.jobs) ? json.jobs : []);
    } catch (e: any) {
      console.error('medreach jobs load error', e);
      // Demo fallback using MedReachJob-like rows
      setJobs([
        {
          id: 'MRJ-00432',
          externalId: 'LAB-00137',
          labName: 'Ambulant Labs — Cape Town',
          phlebName: 'Isaac N.',
          patientName: 'N. Dlamini',
          patientAddress: 'Khayelitsha, Cape Town',
          windowLabel: '10–11am',
          status: 'Completed',
          eta: 'Today • 10:30',
          etaAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
          createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        },
        {
          id: 'MRJ-00433',
          externalId: 'LAB-00187',
          labName: 'Ambulant Labs — Cape Town',
          phlebName: 'Thandi S.',
          patientName: 'T. Khumalo',
          patientAddress: 'Soweto, Johannesburg',
          windowLabel: '14–15h',
          status: 'EnRoute',
          eta: 'Today • 14:30',
          etaAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
          createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        },
        {
          id: 'MRJ-00434',
          externalId: 'LAB-00209',
          labName: 'PathCare Sandton',
          phlebName: 'Jacob M.',
          patientName: 'L. Mthethwa',
          patientAddress: 'Sandton, Johannesburg',
          windowLabel: '18–19h',
          status: 'Assigned',
          eta: 'Today • 18:15',
          etaAt: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
          createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        },
      ]);
      setErr(e?.message || 'Fell back to demo MedReach jobs data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const filtered = useMemo(() => {
    if (!Array.isArray(jobs)) return [];
    if (statusFilter === 'all') return jobs;
    return jobs.filter((j) => j.status === statusFilter);
  }, [jobs, statusFilter]);

  const timeline: TimelineItem[] = filtered.map((j) => {
    const status = mapStatusToTimeline(j.status);
    const when = j.createdAt ? new Date(j.createdAt) : new Date();

    const title = `${j.patientName} • ${j.labName}`;
    const descParts: string[] = [];
    if (j.windowLabel) descParts.push(`Window ${j.windowLabel}`);
    if (j.patientAddress) descParts.push(j.patientAddress);
    if (j.phlebName) descParts.push(`Phleb: ${j.phlebName}`);

    const metaParts: string[] = [];
    metaParts.push(j.status); // small textual badge via legend colour
    if (j.eta) metaParts.push(j.eta);

    return {
      id: j.id,
      when,
      title,
      description: descParts.join(' • '),
      meta: metaParts.join(' • '),
      status,
      href: `/medreach/orders/${encodeURIComponent(j.id)}`,
    };
  });

  const totalJobs = Array.isArray(jobs) ? jobs.length : 0;
  const completedJobs =
    Array.isArray(jobs) ? jobs.filter((j) => j.status === 'Completed').length : 0;
  const completionRate =
    totalJobs === 0 ? 0 : Math.round((completedJobs / totalJobs) * 100);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      {/* HEADER */}
      <header className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold">MedReach — Lab Ops</h1>
          <p className="mt-1 text-sm text-gray-500">
            Home sample collections and partner lab runs powered by MedReach
            jobs.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* Cross-product switcher (pharmacy / lab / merged) */}
          <div className="inline-flex overflow-hidden rounded-full border bg-white text-xs">
            <Link
              href="/careport"
              className="border-r px-3 py-1.5 hover:bg-gray-50"
            >
              Pharmacy
            </Link>
            <Link
              href="/medreach"
              className="border-r bg-teal-50 px-3 py-1.5 text-teal-700"
            >
              Lab
            </Link>
            <Link href="/orders" className="px-3 py-1.5 hover:bg-gray-50">
              Merged orders
            </Link>
          </div>

          {/* MedReach view switcher (dashboard / timelines / analytics) */}
          <div className="inline-flex overflow-hidden rounded-full border bg-white text-[11px]">
            <Link
              href="/medreach"
              className="border-r bg-teal-50 px-3 py-1.5 text-teal-700"
            >
              Dashboard
            </Link>
            <Link
              href="/medreach/orders"
              className="border-r px-3 py-1.5 hover:bg-gray-50"
            >
              Phleb timelines
            </Link>
            <Link
              href="/medreach/analytics"
              className="px-3 py-1.5 hover:bg-gray-50"
            >
              Analytics
            </Link>
          </div>

          <div className="flex items-center gap-2 text-xs">
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
        </div>
      </header>

      {err ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
          {err}
        </div>
      ) : null}

      {/* KPIs + TIMELINE + LEGEND */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* KPIs + legend */}
        <div className="space-y-3 lg:col-span-1">
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs text-gray-500">Jobs in view</div>
            <div className="text-2xl font-semibold">
              {totalJobs.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-gray-400">
              MedReach jobs created in the selected range.
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs text-gray-500">Completion rate</div>
            <div className="text-2xl font-semibold">{completionRate}%</div>
            <div className="mt-1 text-xs text-gray-400">
              Jobs with status <span className="font-semibold">Completed</span>.
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs text-gray-500">Active today</div>
            <div className="text-2xl font-semibold">
              {Array.isArray(jobs)
                ? jobs.filter((j) => j.status === 'Assigned' || j.status === 'EnRoute' || j.status === 'Arrived')
                    .length
                : 0}
            </div>
            <div className="mt-1 text-xs text-gray-400">
              Jobs currently en route or awaiting draw.
            </div>
          </div>

          <StatusLegend variant="medreach" />
        </div>

        {/* Timeline + filters */}
        <div className="space-y-3 rounded-lg border bg-white p-4 lg:col-span-2">
          <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
            <h2 className="font-medium">Recent MedReach Jobs</h2>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">Filter status:</span>
                <div className="inline-flex overflow-hidden rounded-full border bg-white">
                  {(['all', 'Assigned', 'EnRoute', 'Arrived', 'Completed', 'Canceled'] as StatusFilter[]).map(
                    (s) => (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`border-r px-2.5 py-1 last:border-r-0 ${
                          statusFilter === s
                            ? 'bg-teal-50 text-teal-700'
                            : 'bg-white'
                        }`}
                      >
                        {s === 'all'
                          ? 'All'
                          : s === 'EnRoute'
                          ? 'En route'
                          : s}
                      </button>
                    ),
                  )}
                </div>
              </div>
              <StatusLegend variant="medreach" compact />
            </div>
          </div>

          {loading ? (
            <div className="mt-1 text-sm text-gray-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="mt-1 text-sm text-gray-500">
              No MedReach jobs in this view. Try adjusting filters or range.
            </div>
          ) : (
            <Timeline items={timeline} />
          )}

          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <div>
              Showing {filtered.length} of {totalJobs} MedReach jobs.
            </div>
            <Link
              href="/medreach/orders"
              className="text-teal-700 underline"
            >
              Open phleb timelines →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
