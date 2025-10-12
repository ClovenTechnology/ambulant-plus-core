// apps/clinician-app/app/orders/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type OrderRow = {
  id: string;
  kind: 'pharmacy' | 'lab' | string;
  encounterId?: string;
  createdAt?: string;
  title?: string;
  details?: string;
  scriptId?: string;
};

export default function OrdersPage() {
  const sp = useSearchParams();
  const enc = useMemo(() => sp.get('encounterId') || undefined, [sp]);

  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const qs = enc ? `?encounterId=${encodeURIComponent(enc)}` : '';
        const r = await fetch(`/api/orders${qs}`, { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const js = await r.json();
        // Some gateways return { ok:true, orders: [] } while your existing gateway returns array
        const list = Array.isArray(js) ? js : js?.orders || js?.items || (js?.rows ?? []);
        setRows(Array.isArray(list) ? list : []);
      } catch (e: any) {
        setErr(e?.message || 'Failed to load orders');
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [enc]);

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Orders</h1>
        <div className="flex gap-2">
  <Link href="/" className="px-3 py-1 rounded border bg-white">Home</Link>
  <Link href="/dashboard" className="px-3 py-1 rounded bg-emerald-600 text-white">Dashboard</Link>
  <Link href="/orders/new" className="px-3 py-1 rounded bg-indigo-600 text-white">New Order</Link>
</div>
      </div>

      {enc && <div className="text-sm text-gray-600">Filtering for encounter: <code>{enc}</code></div>}

      <div className="bg-white border rounded divide-y">
        {loading ? (
          <div className="p-6 text-gray-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-gray-500">No orders found.</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="p-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-600 text-white grid place-items-center font-medium">
                {r.kind === 'pharmacy' ? 'Rx' : 'Lab'}
              </div>
              <div className="flex-1">
                <div className="flex items-start gap-3">
                  <div>
                    <div className="font-medium">{r.title || r.id}</div>
                    <div className="text-sm text-gray-600">{r.details || '—'}</div>
                  </div>
                  <div className="ml-auto text-xs text-gray-500">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
                  </div>
                </div>
                <div className="mt-2 text-xs flex gap-2 items-center">
                  <div className="px-2 py-0.5 rounded border text-gray-700 text-[12px]">{r.kind}</div>
                  {r.encounterId && <div className="text-[11px] text-gray-500">Encounter: <span className="font-mono">{r.encounterId}</span></div>}
                  {r.scriptId && <div className="text-[11px] text-gray-500">Script: <span className="font-mono">{r.scriptId}</span></div>}
                  <div className="ml-auto">
                    <Link href={`/orders/${encodeURIComponent(r.id)}`} className="text-sm underline text-gray-600">View</Link>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {err && <div className="text-sm text-rose-600">{err}</div>}
    </main>
  );
}
