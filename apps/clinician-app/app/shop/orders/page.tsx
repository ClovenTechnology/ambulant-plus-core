//apps/clinician-app/app/shop/orders/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type OrderRow = {
  id: string;
  status: string;
  channel?: string | null;
  currency?: string | null;
  createdAt?: string | null;
  paidAt?: string | null;
  itemCount?: number | null;
  totalZar?: number | null;
};

type OrdersResp = {
  ok: boolean;
  items: OrderRow[];
  error?: string;
};

const STATUS_PILLS = ['ALL', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'] as const;

function getUid() {
  if (typeof window === 'undefined') return 'server-user';
  const key = 'ambulant_uid';
  let v = localStorage.getItem(key);
  if (!v) {
    v = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + '-u';
    localStorage.setItem(key, v);
  }
  return v;
}

function moneyZar(n: number) {
  try {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n);
  } catch {
    return `R ${n.toFixed(2)}`;
  }
}

export default function ClinicianShopOrdersPage() {
  const sp = useSearchParams();
  const statusParam = (sp.get('status') || '').toLowerCase(); // success | cancelled

  const [uid] = useState(() => getUid());
  const [status, setStatus] = useState<(typeof STATUS_PILLS)[number]>('ALL');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<OrdersResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const usp = new URLSearchParams();
    usp.set('uid', uid);
    if (status && status !== 'ALL') usp.set('status', status);
    if (q.trim()) usp.set('q', q.trim());
    return usp.toString();
  }, [uid, status, q]);

  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/shop/orders?${queryString}`, {
          cache: 'no-store',
          signal: ac.signal,
        });

        const js = (await res.json().catch(() => ({}))) as OrdersResp;
        if (!res.ok || !js.ok) throw new Error(js?.error || `Failed to load orders (HTTP ${res.status})`);
        setResp(js);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setErr(e?.message || 'Failed to load orders');
        setResp(null);
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [queryString]);

  const items = resp?.items || [];

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Shop Orders</h1>
          <p className="text-sm text-gray-600">Your Ambulant+ shop purchases and receipts.</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs hover:bg-gray-50"
          >
            Back to Shop
          </Link>
          <Link
            href="/orders"
            className="inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs hover:bg-gray-50"
          >
            Care Orders
          </Link>
        </div>
      </header>

      {statusParam === 'success' ? (
        <div className="text-sm rounded-lg border border-green-200 bg-green-50 text-green-800 px-3 py-2">
          Payment successful ✅ Your order is recorded here.
        </div>
      ) : statusParam === 'cancelled' ? (
        <div className="text-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2">
          Checkout cancelled. No payment was made.
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_PILLS.map((s) => {
            const active = s === status;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={[
                  'px-3 py-1.5 rounded-full text-xs border transition',
                  active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50',
                ].join(' ')}
              >
                {s}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search order id…"
            className="w-full sm:w-72 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQ('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-800"
              aria-label="Clear search"
            >
              ✕
            </button>
          ) : null}
        </div>
      </div>

      {err ? <div className="text-sm text-red-600">{err}</div> : null}

      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-medium text-sm">Orders</div>
          <div className="text-xs text-gray-500">{loading ? 'Loading…' : `${items.length} shown`}</div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="text-xs text-gray-500 border-b">
              <tr>
                <th className="text-left py-2 px-4">Created</th>
                <th className="text-left py-2 px-4">Order ID</th>
                <th className="text-left py-2 px-4">Status</th>
                <th className="text-right py-2 px-4">Items</th>
                <th className="text-right py-2 px-4">Total</th>
                <th className="text-left py-2 px-4">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id} className="border-b last:border-b-0">
                  <td className="py-2 px-4 text-xs text-gray-700">
                    {o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="py-2 px-4 font-mono text-xs">{o.id}</td>
                  <td className="py-2 px-4">
                    <span
                      className={[
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs border',
                        o.status === 'PAID'
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : o.status === 'FAILED'
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : 'bg-gray-50 border-gray-200 text-gray-700',
                      ].join(' ')}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-right">{o.itemCount ?? '—'}</td>
                  <td className="py-2 px-4 text-right">
                    {typeof o.totalZar === 'number' ? moneyZar(o.totalZar) : '—'}
                  </td>
                  <td className="py-2 px-4">
                    <a
                      className="text-xs text-blue-600 hover:underline"
                      href={`/api/shop/orders/${encodeURIComponent(o.id)}/receipt?inline=1`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View / Print
                    </a>
                  </td>
                </tr>
              ))}

              {!items.length && !loading ? (
                <tr>
                  <td colSpan={6} className="py-6 px-4 text-sm text-gray-500">
                    No orders found yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
