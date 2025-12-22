'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import StatusLegend from '@/components/StatusLegend';

type TimelineStep = { t: string; label: string };

type Row = {
  id: string;
  patient: string;
  status: string;
  createdAt?: string;
  phleb?: { name: string; phone: string; vehicle?: string };
  eta?: string;
  address?: string;
  timeline: TimelineStep[];
};

type StatusFilter = 'all' | 'pending' | 'in-progress' | 'done' | 'failed';

export default function PhlebJobsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch('/api/medreach/orders', { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (!mounted) return;
        setRows(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!mounted) return;
        setRows([]);
        setErr(e?.message || 'Unable to load MedReach jobs.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    let list = rows.slice();

    if (statusFilter !== 'all') {
      list = list.filter((r) => (r.status ?? 'pending') === statusFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.patient.toLowerCase().includes(q) ||
          r.phleb?.name?.toLowerCase().includes(q),
      );
    }

    return list;
  }, [rows, statusFilter, search]);

  return (
    <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Phleb Jobs (MedReach)</h1>
          <p className="text-xs text-gray-500 mt-1">
            Mobile-friendly list of active MedReach home collection jobs.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2 text-xs">
            <Link href="/medreach" className="underline text-teal-700">
              MedReach dashboard
            </Link>
            <Link href="/medreach/orders" className="underline text-gray-600">
              Phleb timelines
            </Link>
          </div>
          <StatusLegend variant="medreach" compact />
        </div>
      </header>

      {/* Filters */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex rounded-full border bg-white overflow-hidden text-xs">
          {(['pending', 'in-progress', 'done', 'all'] as StatusFilter[]).map(
            (s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 border-r last:border-r-0 ${
                  statusFilter === s
                    ? 'bg-teal-50 text-teal-700'
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

        <input
          className="border rounded px-3 py-1.5 text-xs w-full sm:w-64"
          placeholder="Search by patient, job ID, phleb…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </section>

      {/* Job list */}
      <section className="space-y-3">
        {loading ? (
          <div className="text-xs text-gray-500">Loading jobs…</div>
        ) : filtered.length === 0 ? (
          <div className="text-xs text-gray-500 border rounded bg-white p-3">
            No MedReach jobs in this view.
          </div>
        ) : (
          filtered.map((job) => {
            const lastStep =
              job.timeline && job.timeline.length
                ? job.timeline[job.timeline.length - 1]
                : null;
            return (
              <article
                key={job.id}
                className="border rounded-lg bg-white p-3 space-y-2 text-xs"
              >
                <div className="flex justify-between items-center gap-2">
                  <div>
                    <div className="font-semibold text-sm">
                      {job.patient}{' '}
                      <span className="text-[11px] text-gray-400">
                        • {job.id}
                      </span>
                    </div>
                    {job.createdAt && (
                      <div className="text-[11px] text-gray-500">
                        Created:{' '}
                        {job.createdAt
                          .replace('T', ' ')
                          .replace('Z', '')}
                      </div>
                    )}
                  </div>
                  <span className="inline-flex text-[10px] px-2 py-0.5 rounded-full bg-gray-100 uppercase tracking-wide text-gray-700">
                    {job.status}
                  </span>
                </div>

                <div className="flex justify-between items-center gap-3">
                  <div className="flex-1 text-[11px] text-gray-600">
                    <div className="font-medium mb-0.5">Phlebotomist</div>
                    <div>
                      {job.phleb?.name || '—'}{' '}
                      {job.phleb?.phone ? `• ${job.phleb.phone}` : ''}
                    </div>
                    <div className="text-gray-500">
                      {job.phleb?.vehicle || 'MedReach fleet'}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-gray-500">
                    <div className="font-medium">Last update</div>
                    <div>{lastStep?.t || '—'}</div>
                    <div className="text-gray-600">
                      {lastStep?.label || 'No events yet'}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center gap-2 pt-1 border-t border-dashed border-gray-200 mt-1">
                  <div className="text-[11px] text-gray-500">
                    ETA: {job.eta ?? '—'}
                  </div>
                  <Link
                    href="/medreach/track"
                    className="text-[11px] px-2 py-1 rounded border bg-white hover:bg-gray-50"
                  >
                    Open tracker →
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
