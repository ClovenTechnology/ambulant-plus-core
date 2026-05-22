// apps/patient-app/app/careport/history/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type HistoryItem = {
  id: string;
  encId?: string | null;
  orderNo?: string | null;
  status: string;
  fulfillment?: 'DELIVERY' | 'PICKUP' | string | null;
  createdAt?: string | null;
  deliveredAt?: string | null;
  pharmacyName?: string | null;
  riderName?: string | null;
  total?: number | null;
  paymentMethod?: string | null;
  currency?: string | null;
};

type HistoryPageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function formatWhen(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function money(amount?: number | null, currency = 'ZAR') {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(amount);
}

function statusTone(status?: string | null) {
  const s = String(status || '').toUpperCase();

  if (['DELIVERED', 'COLLECTED', 'COMPLETED'].includes(s)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (['PAID', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP'].includes(s)) return 'border-blue-200 bg-blue-50 text-blue-700';
  if (['PAYMENT_PENDING', 'OFFERS_OPEN', 'CREATED'].includes(s)) return 'border-amber-200 bg-amber-50 text-amber-800';
  if (['FAILED', 'CANCELLED', 'REJECTED'].includes(s)) return 'border-rose-200 bg-rose-50 text-rose-700';

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function StatusPill({ status }: { status?: string | null }) {
  return (
    <span className={cx('inline-flex rounded-full border px-3 py-1 text-xs font-medium', statusTone(status))}>
      {String(status || 'Unknown').replace(/_/g, ' ')}
    </span>
  );
}

function normalizeItems(payload: any): HistoryItem[] {
  const rows = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.history)
      ? payload.history
      : Array.isArray(payload)
        ? payload
        : [];

  return rows
    .map((x: any) => ({
      id: String(x?.id || x?.orderId || x?.orderNo || '').trim(),
      encId: x?.encId ?? x?.encounterId ?? null,
      orderNo: x?.orderNo ?? x?.id ?? null,
      status: String(x?.status || 'UNKNOWN'),
      fulfillment: x?.fulfillment ?? null,
      createdAt: x?.createdAt ?? null,
      deliveredAt: x?.deliveredAt ?? null,
      pharmacyName: x?.pharmacyName ?? x?.chosenPharmacyName ?? null,
      riderName: x?.riderName ?? null,
      total: typeof x?.total === 'number' ? x.total : null,
      paymentMethod: x?.paymentMethod ?? null,
      currency: x?.currency ?? 'ZAR',
    }))
    .filter((x: HistoryItem) => x.id);
}

export default function HistoryPage({ searchParams }: HistoryPageProps) {
  const encIdFilter =
    (searchParams?.encId as string | undefined) ||
    (searchParams?.id as string | undefined) ||
    '';

  const [encId, setEncId] = useState(encIdFilter);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(currentEncId = encId) {
    const ac = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const param = currentEncId && currentEncId.trim() ? `?encId=${encodeURIComponent(currentEncId.trim())}` : '';
      const res = await fetch(`/api/careport/history${param}`, {
        cache: 'no-store',
        signal: ac.signal,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok === false) {
        setItems([]);
        setError(data?.error || `CarePort history unavailable. HTTP ${res.status}`);
        return;
      }

      setItems(normalizeItems(data));
    } catch (err: any) {
      if (ac.signal.aborted) return;
      setItems([]);
      setError(err?.message || 'Unable to load CarePort history.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(encIdFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encIdFilter]);

  const summary = useMemo(() => {
    const total = items.length;
    const delivery = items.filter((x) => String(x.fulfillment || '').toUpperCase() === 'DELIVERY').length;
    const pickup = items.filter((x) => String(x.fulfillment || '').toUpperCase() === 'PICKUP').length;
    const complete = items.filter((x) => ['DELIVERED', 'COLLECTED', 'COMPLETED'].includes(String(x.status || '').toUpperCase())).length;
    return { total, delivery, pickup, complete };
  }, [items]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">CarePort history</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                Review pharmacy marketplace orders, fulfilment mode, payment status and delivery or pickup progress.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/careport" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                CarePort
              </Link>
              <button
                type="button"
                onClick={() => load(encId)}
                disabled={loading}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Orders</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{summary.total}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Home delivery</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{summary.delivery}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Collection</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{summary.pickup}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Completed</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{summary.complete}</div>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="block flex-1">
              <div className="text-xs font-medium text-slate-600">Filter by encounter ID</div>
              <input
                value={encId}
                onChange={(e) => setEncId(e.target.value)}
                placeholder="Optional encounter ID"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </label>

            <button
              type="button"
              onClick={() => load(encId)}
              disabled={loading}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Apply filter
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Loading CarePort history...
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No CarePort orders found for this filter.
              </div>
            ) : (
              items.map((it) => (
                <article key={it.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-slate-900">{it.orderNo || it.id}</h2>
                        <StatusPill status={it.status} />
                        {it.fulfillment ? (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                            {String(it.fulfillment).toUpperCase() === 'PICKUP' ? 'In-store collection' : 'Home delivery'}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                        <div>Created: {formatWhen(it.createdAt)}</div>
                        <div>Completed: {formatWhen(it.deliveredAt)}</div>
                        <div>Pharmacy: {it.pharmacyName || '—'}</div>
                        <div>Rider: {it.riderName || '—'}</div>
                        <div>Total: {money(it.total, it.currency || 'ZAR')}</div>
                        <div>Payment: {it.paymentMethod || '—'}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/careport/timeline?id=${encodeURIComponent(it.id)}`}
                        className="rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Timeline
                      </Link>
                      {String(it.fulfillment || '').toUpperCase() === 'DELIVERY' ? (
                        <Link
                          href={`/careport/track?orderId=${encodeURIComponent(it.id)}`}
                          className="rounded-full bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                        >
                          Track
                        </Link>
                      ) : (
                        <Link
                          href={`/careport/marketplace/${encodeURIComponent(it.id)}`}
                          className="rounded-full bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                        >
                          Pickup details
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
