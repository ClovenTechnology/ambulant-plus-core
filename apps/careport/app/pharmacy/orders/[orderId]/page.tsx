function humanErrorMessage(value: unknown, fallback = "Unable to complete this request. Please try again.") {
  if (typeof value === "string") {
    const text = value.trim();
    if (text && text !== "[object Object]") return text;
  }

  if (value instanceof Error) {
    const text = value.message.trim();
    if (text && text !== "[object Object]") return text;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const key of ["message", "error", "detail", "reason", "statusText", "code"]) {
      const candidate = record[key];

      if (typeof candidate === "string") {
        const text = candidate.trim();
        if (text && text !== "[object Object]") return text;
      }

      if (candidate && typeof candidate === "object") {
        const nested = candidate as Record<string, unknown>;

        for (const nestedKey of ["message", "error", "detail", "reason", "statusText", "code"]) {
          const nestedCandidate = nested[nestedKey];

          if (typeof nestedCandidate === "string") {
            const text = nestedCandidate.trim();
            if (text && text !== "[object Object]") return text;
          }
        }
      }
    }
  }

  if (value != null) {
    const text = String(value).trim();
    if (text && text !== "[object Object]") return text;
  }

  return fallback;
}

//apps/careport/app/pharmacy/orders/[orderId]/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type OrderItem = { id: string; name: string; quantity: number; directions?: string | null; drugCode?: string | null };
type Order = {
  id: string;
  status: string;
  fulfillment: 'PICKUP' | 'DELIVERY';
  destinationAddr?: string | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
  selections?: Array<{ orderItemId: string; chosenSkuId: string; unitPriceCents: number; currency: string }>;
  payments?: Array<{ id: string; method: string; status: string; amountCents: number; currency: string; createdAt: string }>;
  assignment?: { status?: string | null; riderUserId?: string | null; dispatchStartedAt?: string | null } | null;
  sponsorPricingSnapshot?: any;
};

function money(cents: number, currency = 'ZAR') {
  return `${currency} ${(Number(cents || 0) / 100).toFixed(2)}`;
}

function dt(value?: string | null) {
  if (!value) return 'Not recorded';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not recorded';
  return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function statusClass(status: string) {
  if (status === 'PAID') return 'border-blue-200 bg-blue-50 text-blue-800';
  if (status === 'PREPARING') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'READY_FOR_PICKUP') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (['DISPATCHING', 'RIDER_ASSIGNED', 'EN_ROUTE_TO_PICKUP', 'AT_PHARMACY'].includes(status)) return 'border-violet-200 bg-violet-50 text-violet-800';
  if (['DELIVERED', 'COMPLETED'].includes(status)) return 'border-slate-200 bg-slate-50 text-slate-700';
  return 'border-slate-200 bg-white text-slate-700';
}

export default function PharmacyOrderDetailPage({ params }: { params: { orderId: string } }) {
  const orderId = params.orderId;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [pickupCode, setPickupCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/careport/pharmacies/me/orders/${encodeURIComponent(orderId)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(humanErrorMessage(data?.error, `order_http_${res.status}`));
      setOrder(data.order || null);
    } catch (err: any) {
      setError(humanErrorMessage(err, 'Unable to load order.'));
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function action(workflowAction: string) {
    setBusy(workflowAction);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/careport/pharmacies/me/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: workflowAction, note: note.trim() || null, pickupCode: pickupCode.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(humanErrorMessage(data?.error, `status_http_${res.status}`));
      setMessage(`Order moved to ${data.status}.`);
      setNote('');
      setPickupCode('');
      await load();
    } catch (err: any) {
      setError(humanErrorMessage(err, 'Could not update order.'));
    } finally {
      setBusy(null);
    }
  }

  const workflowHistory = useMemo(() => {
    const history = order?.sponsorPricingSnapshot?.pharmacyWorkflow?.history;
    return Array.isArray(history) ? history.slice().reverse() : [];
  }, [order]);

  if (loading) return <main className="rounded-3xl border bg-white p-8 text-sm text-slate-500">Loading order…</main>;

  if (!order) {
    return (
      <main className="space-y-4">
        <Link href="/pharmacy/orders" className="text-sm text-emerald-700 hover:underline">← Back to orders</Link>
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error || 'Order not found.'}</div>
      </main>
    );
  }

  const canPrepare = order.status === 'PAID';
  const canReady = ['PAID', 'PREPARING'].includes(order.status);
  const canCollect = order.fulfillment === 'PICKUP' && order.status === 'READY_FOR_PICKUP';

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href="/pharmacy/orders" className="text-sm text-emerald-700 hover:underline">← Back to orders</Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Order {order.id}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={`rounded-full border px-2 py-1 text-xs ${statusClass(order.status)}`}>{order.status.split('_').join(' ')}</span>
            <span className="rounded-full border px-2 py-1 text-xs text-slate-600">{order.fulfillment === 'DELIVERY' ? 'Home delivery' : 'In-store pickup'}</span>
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4 text-sm shadow-sm md:text-right">
          <div className="text-xs text-slate-500">Total</div>
          <div className="text-xl font-semibold text-slate-950">{money(order.totalCents, order.currency)}</div>
          <div className="mt-1 text-xs text-slate-500">Subtotal {money(order.subtotalCents, order.currency)} · Delivery {money(order.deliveryFeeCents, order.currency)}</div>
        </div>
      </header>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{humanErrorMessage(error, "Unable to complete this request. Please try again.")}</div>}
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{humanErrorMessage(message, "Request completed.")}</div>}

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">Medication items</h2>
            <div className="mt-4 divide-y rounded-2xl border">
              {(order.items || []).map((item) => (
                <div key={item.id} className="p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-950">{item.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.drugCode || 'No drug code'} · Quantity {item.quantity}</div>
                      {item.directions && <div className="mt-1 text-xs text-slate-600">Directions: {item.directions}</div>}
                    </div>
                    <div className="rounded-full border px-2 py-1 text-xs">×{item.quantity}</div>
                  </div>
                </div>
              ))}
              {!(order.items || []).length && <div className="p-6 text-sm text-slate-500">No items recorded.</div>}
            </div>
          </section>

          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">Pharmacy workflow</h2>
            <p className="mt-1 text-xs text-slate-500">Record dispensing notes, mark readiness, and trigger pickup/dispatch state changes.</p>
            <textarea className="mt-4 h-24 w-full rounded-2xl border p-3 text-sm" placeholder="Optional dispensing or counselling note" value={note} onChange={(e) => setNote(e.target.value)} />
            {order.fulfillment === 'PICKUP' && (
              <input className="mt-3 w-full rounded-2xl border px-3 py-2 text-sm" placeholder="Optional pickup code checked at collection" value={pickupCode} onChange={(e) => setPickupCode(e.target.value)} />
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {canPrepare && <button disabled={busy === 'start_preparing'} onClick={() => void action('start_preparing')} className="rounded-xl bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">Start preparing</button>}
              {canReady && <button disabled={busy === 'ready'} onClick={() => void action('ready')} className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{order.fulfillment === 'DELIVERY' ? 'Ready for dispatch' : 'Ready for pickup'}</button>}
              {canCollect && <button disabled={busy === 'mark_collected'} onClick={() => void action('mark_collected')} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">Mark collected</button>}
              {!canPrepare && !canReady && !canCollect && <div className="rounded-xl border border-dashed px-3 py-2 text-sm text-slate-500">No pharmacy action available for this status.</div>}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">Fulfilment</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-xs text-slate-500">Mode</dt><dd className="font-medium">{order.fulfillment === 'DELIVERY' ? 'Home delivery' : 'In-store pickup'}</dd></div>
              <div><dt className="text-xs text-slate-500">Destination</dt><dd className="font-medium">{order.destinationAddr || (order.fulfillment === 'PICKUP' ? 'Patient will collect in store' : 'Not recorded')}</dd></div>
              <div><dt className="text-xs text-slate-500">Created</dt><dd>{dt(order.createdAt)}</dd></div>
              <div><dt className="text-xs text-slate-500">Updated</dt><dd>{dt(order.updatedAt)}</dd></div>
              <div><dt className="text-xs text-slate-500">Rider assignment</dt><dd>{order.assignment?.status || 'Not assigned yet'}</dd></div>
            </dl>
          </section>

          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">Payment</h2>
            <div className="mt-4 space-y-2">
              {(order.payments || []).map((payment) => (
                <div key={payment.id} className="rounded-2xl border p-3 text-xs">
                  <div className="font-medium text-slate-900">{payment.method} · {payment.status}</div>
                  <div className="text-slate-500">{money(payment.amountCents, payment.currency)} · {dt(payment.createdAt)}</div>
                </div>
              ))}
              {!(order.payments || []).length && <div className="rounded-2xl border border-dashed p-3 text-xs text-slate-500">No payment intent attached.</div>}
            </div>
          </section>

          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">Workflow history</h2>
            <div className="mt-4 space-y-2">
              {workflowHistory.map((entry: any, idx: number) => (
                <div key={`${entry.at || idx}-${idx}`} className="rounded-2xl border p-3 text-xs">
                  <div className="font-medium text-slate-900">{String(entry.action || '').split('_').join(' ')} · {entry.to}</div>
                  <div className="text-slate-500">{dt(entry.at)} · from {entry.from || 'unknown'}</div>
                  {entry.note && <div className="mt-1 text-slate-600">{entry.note}</div>}
                </div>
              ))}
              {!workflowHistory.length && <div className="rounded-2xl border border-dashed p-3 text-xs text-slate-500">No pharmacy workflow events yet.</div>}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
