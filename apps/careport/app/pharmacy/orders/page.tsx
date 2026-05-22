//apps/careport/app/pharmacy/orders/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  directions?: string | null;
  drugCode?: string | null;
};

type PharmacyOrder = {
  id: string;
  status: string;
  fulfillment: 'PICKUP' | 'DELIVERY';
  destinationAddr?: string | null;
  totalCents: number;
  subtotalCents: number;
  deliveryFeeCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
  payments?: Array<{ id: string; status: string; method: string; amountCents: number }>;
  assignment?: { status?: string | null; riderUserId?: string | null } | null;
};

const tabs = [
  { key: '', label: 'Active' },
  { key: 'PAID', label: 'Paid' },
  { key: 'PREPARING', label: 'Preparing' },
  { key: 'READY_FOR_PICKUP', label: 'Ready for pickup' },
  { key: 'DISPATCHING', label: 'Dispatching' },
  { key: 'COMPLETED', label: 'Completed' },
];

function money(cents: number, currency = 'ZAR') {
  return `${currency} ${(Number(cents || 0) / 100).toFixed(2)}`;
}

function statusClass(status: string) {
  if (status === 'PAID') return 'border-blue-200 bg-blue-50 text-blue-800';
  if (status === 'PREPARING') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'READY_FOR_PICKUP') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (['DISPATCHING', 'RIDER_ASSIGNED', 'EN_ROUTE_TO_PICKUP', 'AT_PHARMACY'].includes(status)) return 'border-violet-200 bg-violet-50 text-violet-800';
  if (['DELIVERED', 'COMPLETED'].includes(status)) return 'border-slate-200 bg-slate-50 text-slate-700';
  return 'border-slate-200 bg-white text-slate-700';
}

function shortDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not recorded';
  return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function PharmacyOrdersPage() {
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load(nextStatus = status) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (nextStatus) params.set('status', nextStatus);
      if (q.trim()) params.set('q', q.trim());
      params.set('limit', '100');

      const res = await fetch(`/api/careport/pharmacies/me/orders?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || `orders_http_${res.status}`);
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load pharmacy orders.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const metrics = useMemo(() => ({
    paid: orders.filter((o) => o.status === 'PAID').length,
    preparing: orders.filter((o) => o.status === 'PREPARING').length,
    ready: orders.filter((o) => o.status === 'READY_FOR_PICKUP').length,
    dispatching: orders.filter((o) => ['DISPATCHING', 'RIDER_ASSIGNED', 'EN_ROUTE_TO_PICKUP', 'AT_PHARMACY'].includes(o.status)).length,
  }), [orders]);

  async function action(orderId: string, workflowAction: string) {
    setBusy(orderId + workflowAction);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/careport/pharmacies/me/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: workflowAction }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || `status_http_${res.status}`);
      setMessage(`Order moved to ${data.status}.`);
      await load(status);
    } catch (err: any) {
      setError(err?.message || 'Could not update order.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Pharmacy fulfilment</p>
          <h1 className="text-2xl font-semibold text-slate-950">Orders to dispense</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Process paid CarePort orders, prepare medicines, release pickup orders, and trigger dispatch for home delivery.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/pharmacy" className="rounded-xl border bg-white px-3 py-2 hover:bg-slate-50">Dashboard</Link>
          <Link href="/pharmacy/offers" className="rounded-xl border bg-white px-3 py-2 hover:bg-slate-50">Invitations</Link>
          <Link href="/pharmacy/inventory" className="rounded-xl border bg-white px-3 py-2 hover:bg-slate-50">Inventory</Link>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs text-slate-500">Paid</div><div className="text-2xl font-semibold">{metrics.paid}</div></div>
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs text-slate-500">Preparing</div><div className="text-2xl font-semibold">{metrics.preparing}</div></div>
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs text-slate-500">Ready</div><div className="text-2xl font-semibold">{metrics.ready}</div></div>
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs text-slate-500">Dispatching</div><div className="text-2xl font-semibold">{metrics.dispatching}</div></div>
      </section>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key || 'active'}
                onClick={() => setStatus(tab.key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${status === tab.key ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-50'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Search order, eRx, address" value={q} onChange={(e) => setQ(e.target.value)} />
            <button onClick={() => void load(status)} className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-slate-50">Refresh</button>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {orders.map((order) => {
            const itemCount = order.items?.length || 0;
            const firstItems = (order.items || []).slice(0, 3).map((i) => `${i.name} ×${i.quantity}`).join(', ');
            const canPrepare = order.status === 'PAID';
            const canReady = ['PAID', 'PREPARING'].includes(order.status);
            const canCollect = order.fulfillment === 'PICKUP' && order.status === 'READY_FOR_PICKUP';

            return (
              <article key={order.id} className="rounded-2xl border p-4 transition hover:border-emerald-200 hover:bg-emerald-50/20">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/pharmacy/orders/${encodeURIComponent(order.id)}`} className="font-semibold text-slate-950 hover:underline">{order.id}</Link>
                      <span className={`rounded-full border px-2 py-1 text-xs ${statusClass(order.status)}`}>{order.status.split('_').join(' ')}</span>
                      <span className="rounded-full border px-2 py-1 text-xs text-slate-600">{order.fulfillment === 'DELIVERY' ? 'Home delivery' : 'In-store pickup'}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{itemCount} item{itemCount === 1 ? '' : 's'} · {firstItems || 'No item details'}</p>
                    <p className="mt-1 text-xs text-slate-500">Updated {shortDate(order.updatedAt)}{order.destinationAddr ? ` · ${order.destinationAddr}` : ''}</p>
                  </div>
                  <div className="text-left md:text-right">
                    <div className="font-semibold text-slate-950">{money(order.totalCents, order.currency)}</div>
                    <div className="text-xs text-slate-500">Subtotal {money(order.subtotalCents, order.currency)} · Delivery {money(order.deliveryFeeCents, order.currency)}</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/pharmacy/orders/${encodeURIComponent(order.id)}`} className="rounded-xl border bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50">Open order</Link>
                  {canPrepare && <button disabled={busy === order.id + 'start_preparing'} onClick={() => void action(order.id, 'start_preparing')} className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">Start preparing</button>}
                  {canReady && <button disabled={busy === order.id + 'ready'} onClick={() => void action(order.id, 'ready')} className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{order.fulfillment === 'DELIVERY' ? 'Ready for dispatch' : 'Ready for pickup'}</button>}
                  {canCollect && <button disabled={busy === order.id + 'mark_collected'} onClick={() => void action(order.id, 'mark_collected')} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">Mark collected</button>}
                </div>
              </article>
            );
          })}

          {!orders.length && (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">
              {loading ? 'Loading orders…' : 'No pharmacy orders found for this view.'}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
