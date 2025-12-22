'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StatusLegend from '@/components/StatusLegend';

type Row = {
  id: string;
  patient: string;
  status: string;
  createdAt?: string;
  phleb?: { name: string; phone: string; vehicle?: string };
  timeline: { t: string; label: string }[];
};

export default function MedReachOrders() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
        setErr(e?.message || 'Unable to load MedReach orders – showing empty state.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-4">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">MedReach — Phlebotomist Timelines</h2>
          <p className="text-sm text-gray-500 mt-1">
            Ops view of each home collection and its MedReach phleb event history.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {/* MedReach view switcher */}
          <div className="inline-flex rounded-full border bg-white overflow-hidden text-xs">
            <Link
              href="/medreach"
              className="px-3 py-1.5 border-r hover:bg-gray-50"
            >
              Dashboard
            </Link>
            <Link
              href="/medreach/orders"
              className="px-3 py-1.5 border-r bg-teal-50 text-teal-700"
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
            <Link href="/careport/orders" className="underline text-indigo-700">
              CarePort orders →
            </Link>
          </div>

          <StatusLegend variant="medreach" compact />
        </div>
      </header>

      {err ? (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
          {err}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-gray-500 border rounded-lg bg-white p-4">
          No MedReach orders found.
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {rows.map((o) => (
            <div key={o.id} className="border rounded p-4 bg-white space-y-3">
              <div className="flex justify-between items-center">
                <div className="font-medium">
                  {o.id} — {o.patient}
                </div>
                <div className="text-xs text-gray-500">
                  {o.createdAt
                    ? o.createdAt.replace('T', ' ').replace('Z', '')
                    : ''}
                </div>
              </div>

              <div className="inline-flex text-[11px] px-2 py-1 rounded-full bg-gray-100 uppercase tracking-wide text-gray-700">
                {o.status}
              </div>

              <div className="text-sm text-gray-700">
                <div className="font-medium mb-1">Phlebotomist</div>
                <div className="text-xs text-gray-600">
                  {o.phleb?.name || '—'} · {o.phleb?.phone || '—'}{' '}
                  {o.phleb?.vehicle ? `· ${o.phleb.vehicle}` : ''}
                </div>
              </div>

              <ol className="space-y-1 text-sm">
                {o.timeline?.map((s, i) => (
                  <li key={i} className="flex gap-2 items-baseline">
                    <span className="w-20 text-xs text-gray-500">
                      {s.t}
                    </span>
                    <span className="text-sm">{s.label}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
