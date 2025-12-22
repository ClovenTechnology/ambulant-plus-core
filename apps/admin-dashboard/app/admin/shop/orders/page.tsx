// apps/admin-dashboard/app/admin/shop/orders/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

type LowStockItem = {
  sku?: string | null;
  label?: string | null;
  stockQty?: number | null;
  allowBackorder?: boolean | null;
  productName?: string | null;
  productSlug?: string | null;
};

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
  stats?: {
    count: number;
    totalZar: number;
    paidZar: number;
    byStatus: Record<string, { count: number; totalZar: number }>;
    byChannel: Record<string, { count: number; totalZar: number }>;
    lowStock: LowStockItem[];
    lowStockThreshold: number;
  };
  error?: string;
};

const STATUS_PILLS = ['ALL', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'] as const;

function moneyZar(n: number) {
  try {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n);
  } catch {
    return `R ${n.toFixed(2)}`;
  }
}

function csvEscape(v: any) {
  const s = String(v ?? '');
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminShopOrdersPage() {
  const [status, setStatus] = useState<(typeof STATUS_PILLS)[number]>('PAID');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<OrdersResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (status && status !== 'ALL') sp.set('status', status);
    if (q.trim()) sp.set('q', q.trim());
    return sp.toString();
  }, [status, q]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/shop/orders?${queryString}`, { cache: 'no-store' });
        const js = (await res.json().catch(() => ({}))) as OrdersResp;
        if (!res.ok || !js.ok) throw new Error(js?.error || 'Failed to load orders');
        if (!cancelled) setResp(js);
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message || 'Failed to load orders');
          setResp(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  const items = resp?.items || [];
  const stats = resp?.stats;

  const csvRows = useMemo(() => {
    return items.map((o) => ({
      id: o.id,
      status: o.status,
      channel: o.channel ?? '',
      createdAt: o.createdAt ?? '',
      paidAt: o.paidAt ?? '',
      itemCount: o.itemCount ?? '',
      totalZar: typeof o.totalZar === 'number' ? o.totalZar : '',
    }));
  }, [items]);

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">1Stop Orders (Admin)</h1>
          <p className="text-sm text-gray-600">Search, filter, export CSV, and monitor low stock.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
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

          <button
            type="button"
            onClick={() => downloadCsv(`1stop-orders-${status.toLowerCase()}.csv`, csvRows)}
            disabled={!items.length}
            className="inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </header>

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

      {err ? <div className="text-sm text-red-600">{err}</div> : null}

      {/* Stats cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-gray-500">Orders (filtered)</div>
          <div className="text-xl font-semibold">{stats?.count ?? (loading ? '…' : items.length)}</div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-gray-500">Gross (filtered)</div>
          <div className="text-xl font-semibold">
            {stats ? moneyZar(stats.totalZar) : loading ? '…' : moneyZar(items.reduce((a, o) => a + (o.totalZar || 0), 0))}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-gray-500">Paid (filtered)</div>
          <div className="text-xl font-semibold">{stats ? moneyZar(stats.paidZar) : '—'}</div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-gray-500">Low stock (≤ {stats?.lowStockThreshold ?? 5})</div>
          <div className="text-xl font-semibold">{stats?.lowStock?.length ?? '—'}</div>
        </div>
      </div>

      {/* Low stock widget */}
      {stats?.lowStock?.length ? (
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">Low stock watchlist</div>
              <div className="text-xs text-gray-500">Items that may need replenishment soon.</div>
            </div>
          </div>

          <div className="mt-3 overflow-auto">
            <table className="min-w-[700px] w-full text-sm">
              <thead className="text-xs text-gray-500 border-b">
                <tr>
                  <th className="text-left py-2 pr-3">SKU</th>
                  <th className="text-left py-2 pr-3">Product</th>
                  <th className="text-left py-2 pr-3">Variant</th>
                  <th className="text-right py-2 pr-3">Qty</th>
                  <th className="text-left py-2 pr-3">Backorder</th>
                </tr>
              </thead>
              <tbody>
                {stats.lowStock.map((x, i) => (
                  <tr key={`${x.sku || 'x'}-${i}`} className="border-b last:border-b-0">
                    <td className="py-2 pr-3 font-mono text-xs">{x.sku || '—'}</td>
                    <td className="py-2 pr-3">{x.productName || x.productSlug || '—'}</td>
                    <td className="py-2 pr-3">{x.label || '—'}</td>
                    <td className="py-2 pr-3 text-right">{typeof x.stockQty === 'number' ? x.stockQty : '—'}</td>
                    <td className="py-2 pr-3 text-xs">{x.allowBackorder ? 'Allowed' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Orders list */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-medium text-sm">Orders</div>
          <div className="text-xs text-gray-500">
            {loading ? 'Loading…' : `${items.length} shown`}
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="text-xs text-gray-500 border-b">
              <tr>
                <th className="text-left py-2 px-4">Created</th>
                <th className="text-left py-2 px-4">Order ID</th>
                <th className="text-left py-2 px-4">Status</th>
                <th className="text-left py-2 px-4">Channel</th>
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
                  <td className="py-2 px-4 text-xs">{o.channel || '—'}</td>
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
                  <td colSpan={7} className="py-6 px-4 text-sm text-gray-500">
                    No orders found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Small breakdowns */}
      {stats ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border bg-white p-4">
            <div className="font-medium text-sm">By status</div>
            <div className="mt-2 space-y-1 text-sm">
              {Object.entries(stats.byStatus || {}).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <div className="text-gray-700">{k}</div>
                  <div className="text-gray-900">
                    {v.count} · {moneyZar(v.totalZar)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4">
            <div className="font-medium text-sm">By channel</div>
            <div className="mt-2 space-y-1 text-sm">
              {Object.entries(stats.byChannel || {}).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <div className="text-gray-700">{k}</div>
                  <div className="text-gray-900">
                    {v.count} · {moneyZar(v.totalZar)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
