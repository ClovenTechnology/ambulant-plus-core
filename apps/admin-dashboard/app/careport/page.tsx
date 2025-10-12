'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Timeline, { TimelineItem } from '@/components/Timeline';

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

export default function CarePortDashboard() {
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      // Prefer a single index endpoint if available. Otherwise we’ll fall back below.
      const r = await fetch('/api/orders/index?scope=all', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setRows(Array.isArray(json) ? json : []);
    } catch (e: any) {
      // Fallback demo pharmacy rows
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

  const pharm = useMemo(() => (Array.isArray(rows) ? rows.filter((r) => r.kind === 'pharmacy') : []), [rows]);

  const timeline: TimelineItem[] = pharm.map((r) => ({
    id: r.id,
    when: r.createdAt || new Date(),
    title: r.title || r.id,
    description: r.details ? `${r.details} • ${r.encounterId} • ${r.sessionId}` : `${r.encounterId} • ${r.sessionId}`,
    meta: r.priceZAR != null ? `R${r.priceZAR.toFixed(2)}` : undefined,
    status: r.status ?? 'pending',
    href: `/careport/orders/${r.id}`, // optional deep-link (can 404 until you add the route)
  }));

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">CarePort — Pharmacy</h1>
        <div className="flex items-center gap-2">
          <button onClick={load} className="px-3 py-1 rounded border bg-white hover:bg-gray-50 text-sm">
            Refresh
          </button>
          <Link href="/medreach" className="text-sm underline text-teal-700">
            Go to MedReach →
          </Link>
        </div>
      </header>

      {err ? <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">{err}</div> : null}

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: KPIs */}
        <div className="lg:col-span-1 space-y-3">
          <div className="border rounded-lg p-4 bg-white">
            <div className="text-xs text-gray-500">Fulfillment (24h)</div>
            <div className="text-2xl font-semibold">92%</div>
          </div>
          <div className="border rounded-lg p-4 bg-white">
            <div className="text-xs text-gray-500">Avg. TAT</div>
            <div className="text-2xl font-semibold">3h 20m</div>
          </div>
          <div className="border rounded-lg p-4 bg-white">
            <div className="text-xs text-gray-500">Open Issues</div>
            <div className="text-2xl font-semibold">4</div>
          </div>
        </div>

        {/* Right: Timeline */}
        <div className="lg:col-span-2 border rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Recent Pharmacy Orders</h2>
            <Link href="/careport/track" className="text-xs underline text-indigo-700">
              Open tracker
            </Link>
          </div>
          {loading ? <div className="text-sm text-gray-500">Loading…</div> : <Timeline items={timeline} />}
        </div>
      </section>
    </main>
  );
}
