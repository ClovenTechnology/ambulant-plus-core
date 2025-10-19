'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CLIN } from '@/src/lib/config';

type OrderRow = {
  id: string;
  kind: 'pharmacy' | 'lab';
  encounterId: string;
  sessionId: string;
  caseId: string;
  createdAt?: string;
  title?: string;   // drug (pharmacy) or panel (lab)
  details?: string; // sig (pharmacy)
};

export default function OrdersListPage() {
  const [encId, setEncId] = useState<string>('enc-za-001');
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const q = encId ? `?encounterId=${encodeURIComponent(encId)}` : '';
      const r = await fetch(`${CLIN}/api/orders/index${q}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setRows(Array.isArray(j) ? j : []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const hasRows = rows.length > 0;
  const prettyDate = (s?: string) => (s ? new Date(s).toLocaleString() : '');

  const lab = useMemo(() => rows.filter(r => r.kind === 'lab'), [rows]);
  const pharm = useMemo(() => rows.filter(r => r.kind === 'pharmacy'), [rows]);

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Orders</h1>
        <div className="flex items-center gap-2">
          <input
            className="border rounded px-2 py-1 text-sm"
            placeholder="encounterId (optional)"
            value={encId}
            onChange={(e) => setEncId(e.target.value)}
          />
          <button onClick={load} className="px-3 py-1 rounded border bg-white hover:bg-gray-50 text-sm">
            Refresh
          </button>
        </div>
      </header>

      {err ? <div className="text-sm text-rose-600">Error: {err}</div> : null}

      {!loading && !hasRows ? (
        <div className="text-gray-500 text-sm">No orders yet.</div>
      ) : null}

      {loading ? <div className="text-sm text-gray-500">Loading...</div> : null}

      {hasRows ? (
        <section className="grid md:grid-cols-2 gap-4">
          <div className="border rounded-lg bg-white p-4">
            <h2 className="font-medium mb-2">Pharmacy</h2>
            <ul className="space-y-2 text-sm">
              {pharm.map((r) => (
                <li key={r.id} className="p-2 border rounded flex items-start justify-between">
                  <div>
                    <div className="font-medium">{r.title || r.id}</div>
                    {r.details ? <div className="text-gray-600">{r.details}</div> : null}
                    <div className="text-xs text-gray-500">
                      {r.encounterId}  {r.sessionId}  {prettyDate(r.createdAt)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Link href={`/careport/track`} className="text-xs underline text-indigo-700">Track</Link>
                    <Link href={`/careport/reorder`} className="text-xs underline text-indigo-700">Reorder</Link>
                    <Link href={`/careport/reprint`} className="text-xs underline text-indigo-700">Reprint</Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="border rounded-lg bg-white p-4">
            <h2 className="font-medium mb-2">Lab</h2>
            <ul className="space-y-2 text-sm">
              {lab.map((r) => (
                <li key={r.id} className="p-2 border rounded flex items-start justify-between">
                  <div>
                    <div className="font-medium">{r.title || r.id}</div>
                    <div className="text-xs text-gray-500">
                      {r.encounterId}  {r.sessionId}  {prettyDate(r.createdAt)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Link href={`/medreach/timeline`} className="text-xs underline text-teal-700">Track</Link>
                    <Link href={`/medreach`} className="text-xs underline text-teal-700">Reorder</Link>
                    <span className="text-xs text-gray-400 italic">Reprint (N/A)</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </main>
  );
}
