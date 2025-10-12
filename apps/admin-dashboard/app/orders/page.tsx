// apps/admin-dashboard/app/orders/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CLIN } from '@/src/lib/config';

type Row = {
  id: string;
  kind: 'pharmacy' | 'lab';
  encounterId: string;
  sessionId: string;
  caseId: string;
  createdAt?: string;
  title?: string;
  details?: string;
};

export default function AdminOrders() {
  const [encId, setEncId] = useState('enc-za-001'); // <-- ensure this exists
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const q = encId ? `?encounterId=${encodeURIComponent(encId)}` : '';
      const r = await fetch(`${CLIN}/api/orders/index${q}`, { cache: 'no-store' });
      const j = await r.json();
      setRows(Array.isArray(j) ? j : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Orders (Merged)</h1>
        <div className="flex items-center gap-2">
          <input
            className="border rounded px-2 py-1 text-sm"
            value={encId}
            onChange={(e) => setEncId(e.target.value)}
          />
          <button
            className="px-3 py-1 rounded border bg-white hover:bg-gray-50 text-sm"
            onClick={load}
          >
            Refresh
          </button>

          {/* Optional quick-create buttons */}
          <button
            className="px-3 py-1 rounded border bg-white hover:bg-gray-50 text-sm"
            onClick={async () => {
              await fetch(`${CLIN}/api/orders/erx`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  encounterId: encId,
                  drug: 'Amlodipine 5mg',
                  sig: '1 tab daily',
                }),
              });
              await load();
            }}
          >
            + eRx
          </button>

          <button
            className="px-3 py-1 rounded border bg-white hover:bg-gray-50 text-sm"
            onClick={async () => {
              await fetch(`${CLIN}/api/orders/lab`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  encounterId: encId,
                  panel: 'CBC',
                }),
              });
              await load();
            }}
          >
            + Lab
          </button>
        </div>
      </header>

      {loading ? <div className="text-sm text-gray-500">Loading…</div> : null}

      <table className="w-full text-sm border rounded overflow-hidden bg-white">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="p-2 text-left">ID</th>
            <th className="p-2 text-left">Kind</th>
            <th className="p-2 text-left">Title</th>
            <th className="p-2 text-left">Encounter</th>
            <th className="p-2 text-left">Session</th>
            <th className="p-2 text-left">Created</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.id}</td>
              <td className="p-2">{r.kind}</td>
              <td className="p-2">{r.title || '-'}</td>
              <td className="p-2">{r.encounterId}</td>
              <td className="p-2">{r.sessionId}</td>
              <td className="p-2">
                {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
              </td>
              <td className="p-2">
                <Link href={`/cases/${r.encounterId}`} className="text-indigo-700 underline">
                  Case
                </Link>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td className="p-4 text-center text-gray-500" colSpan={7}>
                No data
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </main>
  );
}
