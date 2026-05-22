'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Order = {
  id: string;
  status: string;
  fulfillment: 'PICKUP' | 'DELIVERY';
  destinationAddr?: string | null;
  totalCents?: number | null;
  currency?: string | null;
  updatedAt?: string | null;
  items?: Array<{ id: string; name: string; quantity: number }>;
  chosenPharmacy?: { name?: string | null } | null;
  assignment?: { status?: string | null; riderUserId?: string | null } | null;
};

function money(cents?: number | null, currency = 'ZAR') {
  return `${currency} ${(Number(cents || 0) / 100).toFixed(2)}`;
}

function label(value?: string | null) {
  return String(value || 'UNKNOWN').split('_').join(' ');
}

function dt(value?: string | null) {
  if (!value) return 'Not recorded';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not recorded';
  return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState('ALL');
  const [q, setQ] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const params = new URLSearchParams({ status, limit: '150' });
    if (q.trim()) params.set('q', q.trim());
    try {
      const res = await fetch(`/api/careport/admin/orders?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || `orders_http_${res.status}`);
      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setSummary(data.summary || null);
    } catch (err: any) {
      setError(err?.message || 'Unable to load orders.');
      setOrders([]);
      setSummary(null);
    }
  }

  useEffect(() => { void load(); }, [status]);

  const stuck = useMemo(() => orders.filter((o) => ['PAYMENT_PENDING', 'PAID', 'PREPARING', 'DISPATCHING'].includes(o.status)), [orders]);

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Admin</p>
          <h1 className="text-2xl font-semibold text-slate-950">CarePort order operations</h1>
          <p className="mt-1 text-sm text-slate-600">Monitor fulfilment state, pharmacy processing, and rider assignment readiness.</p>
        </div>
        <Link href="/admin" className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-slate-50">Admin home</Link>
      </header>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      <section className="grid gap-3 md:grid-cols-5">
        {[
          ['Total', summary?.total ?? orders.length],
          ['Paid', summary?.paid ?? 0],
          ['Preparing', summary?.preparing ?? 0],
          ['Dispatching', summary?.dispatching ?? 0],
          ['Needs watch', stuck.length],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-2xl border bg-white p-4">
            <div className="text-xs text-slate-500">{k}</div>
            <div className="text-2xl font-semibold text-slate-950">{v as any}</div>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {['ALL', 'PAYMENT_PENDING', 'PAID', 'PREPARING', 'DISPATCHING', 'COMPLETED'].map((s) => (
              <button key={s} onClick={() => setStatus(s)} className={`rounded-full border px-3 py-1.5 text-xs ${status === s ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-50'}`}>{label(s)}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Search order, eRx, patient, address" value={q} onChange={(e) => setQ(e.target.value)} />
            <button onClick={() => void load()} className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-slate-50">Search</button>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {orders.map((o) => (
            <article key={o.id} className="rounded-2xl border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-950">{o.id}</span>
                    <span className="rounded-full border px-2 py-1 text-xs">{label(o.status)}</span>
                    <span className="rounded-full border px-2 py-1 text-xs">{o.fulfillment === 'DELIVERY' ? 'Home delivery' : 'Pickup'}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{o.items?.length || 0} items · {o.chosenPharmacy?.name || 'No pharmacy chosen'}</p>
                  <p className="mt-1 text-xs text-slate-500">Updated {dt(o.updatedAt)} · Rider {o.assignment?.riderUserId || 'not assigned'} · {o.assignment?.status || 'no assignment'}</p>
                  {o.destinationAddr && <p className="mt-1 text-xs text-slate-500">{o.destinationAddr}</p>}
                </div>
                <div className="text-sm font-semibold text-slate-950">{money(o.totalCents, o.currency || 'ZAR')}</div>
              </div>
            </article>
          ))}
          {!orders.length && <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">No orders found.</div>}
        </div>
      </section>
    </main>
  );
}
