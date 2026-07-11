'use client';

import React, { useEffect, useMemo, useState } from 'react';

type CarePortPayment = {
  id?: string;
  status?: string | null;
  provider?: string | null;
  amountMinor?: number | null;
  amountCents?: number | null;
  currency?: string | null;
  providerRef?: string | null;
  createdAt?: string | null;
};

type CarePortOrder = {
  id: string;
  erxOrderId?: string | null;
  status?: string | null;
  fulfillment?: string | null;
  destinationAddr?: string | null;
  patientId?: string | null;
  chosenPharmacyId?: string | null;
  chosenPharmacy?: {
    id?: string;
    name?: string | null;
    city?: string | null;
    address?: string | null;
  } | null;
  assignment?: {
    id?: string;
    status?: string | null;
    riderUserId?: string | null;
    dispatchStartedAt?: string | null;
    pickedUpAt?: string | null;
    deliveredAt?: string | null;
  } | null;
  payments?: CarePortPayment[];
  subtotalCents?: number | null;
  deliveryFeeCents?: number | null;
  totalCents?: number | null;
  currency?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type OrdersResponse = {
  ok?: boolean;
  orgId?: string;
  orders?: CarePortOrder[];
  summary?: Record<string, number>;
  error?: string;
};

const STATUS_OPTIONS = [
  'ALL',
  'PAYMENT_PENDING',
  'PAID',
  'PREPARING',
  'READY_FOR_PICKUP',
  'DISPATCHING',
  'RIDER_ASSIGNED',
  'EN_ROUTE_TO_PICKUP',
  'AT_PHARMACY',
  'PICKED_UP',
  'EN_ROUTE_TO_CUSTOMER',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
];

function pretty(value?: string | null) {
  return String(value || 'UNKNOWN').replace(/_/g, ' ');
}

function money(cents?: number | null, currency = 'ZAR') {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return '—';

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

function formatWhen(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function statusTone(status?: string | null) {
  const s = String(status || '').toUpperCase();

  if (['DELIVERED', 'COLLECTED', 'COMPLETED'].includes(s)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (
    [
      'PAID',
      'PREPARING',
      'READY_FOR_PICKUP',
      'DISPATCHING',
      'RIDER_ASSIGNED',
      'EN_ROUTE_TO_PICKUP',
      'AT_PHARMACY',
      'PICKED_UP',
      'EN_ROUTE_TO_CUSTOMER',
      'DISPATCHED',
      'OUT_FOR_DELIVERY',
    ].includes(s)
  ) {
    return 'border-blue-200 bg-blue-50 text-blue-800';
  }

  if (['PAYMENT_PENDING', 'OFFERS_OPEN', 'CREATED', 'BROADCASTING', 'PHARMACY_SELECTED'].includes(s)) {
    return 'border-amber-200 bg-amber-50 text-amber-900';
  }

  if (['FAILED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(s)) {
    return 'border-rose-200 bg-rose-50 text-rose-800';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function latestPayment(order: CarePortOrder) {
  return Array.isArray(order.payments) && order.payments.length ? order.payments[0] : null;
}

function isMarketplaceOrder(order: CarePortOrder) {
  return String(order.erxOrderId || '').startsWith('otc-marketplace-');
}

export default function CarePortAdminOrdersPage() {
  const [status, setStatus] = useState('ALL');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<CarePortOrder[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [orgId, setOrgId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (status !== 'ALL') params.set('status', status);
      if (q.trim()) params.set('q', q.trim());

      const res = await fetch(`/api/careport/admin/orders?${params.toString()}`, {
        cache: 'no-store',
      });

      const payload = (await res.json().catch(() => ({}))) as OrdersResponse;

      if (!res.ok || payload.ok === false) {
        throw new Error(payload.error || `careport_admin_orders_http_${res.status}`);
      }

      setRows(Array.isArray(payload.orders) ? payload.orders : []);
      setSummary(payload.summary || {});
      setOrgId(payload.orgId || '');
    } catch (err: any) {
      setRows([]);
      setSummary({});
      setError(err?.message || 'Failed to load CarePort admin orders.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const computed = useMemo(() => {
    const total = rows.length;
    const marketplace = rows.filter(isMarketplaceOrder).length;
    const paymentPending = rows.filter((x) => String(x.status).toUpperCase() === 'PAYMENT_PENDING').length;
    const active = rows.filter((x) =>
      [
        'PAID',
        'PREPARING',
        'READY_FOR_PICKUP',
        'DISPATCHING',
        'RIDER_ASSIGNED',
        'EN_ROUTE_TO_PICKUP',
        'AT_PHARMACY',
        'PICKED_UP',
        'EN_ROUTE_TO_CUSTOMER',
      ].includes(String(x.status || '').toUpperCase()),
    ).length;
    const complete = rows.filter((x) =>
      ['DELIVERED', 'COMPLETED', 'COLLECTED'].includes(String(x.status || '').toUpperCase()),
    ).length;

    return { total, marketplace, paymentPending, active, complete };
  }, [rows]);

  const cards = [
    ['Visible orders', summary.total ?? computed.total],
    ['Payment pending', summary.paymentPending ?? computed.paymentPending],
    ['Paid / active', (summary.paid ?? 0) + (summary.preparing ?? 0) + (summary.dispatching ?? 0) || computed.active],
    ['Completed', summary.completed ?? computed.complete],
    ['OTC marketplace', computed.marketplace],
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                CarePort operations
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                Pharmacy order board
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Monitor OTC marketplace and eRx fulfilment from payment capture through pharmacy preparation, pickup,
                dispatch, rider movement and completion.
              </p>
              {orgId ? <p className="mt-2 text-xs text-slate-400">Org: {orgId}</p> : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/admin/careport/catalogue/global-products"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Global catalogue
              </a>
              <a
                href="/admin/careport/catalogue/normalisation"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Catalogue governance
              </a>
              <a
                href="/admin/careport/pharmacy-inventory"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Pharmacy inventory
              </a>
              <button
                type="button"
                onClick={() => void load()}
                disabled={busy}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {busy ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {cards.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div>
              </div>
            ))}
          </div>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-end">
            <label>
              <div className="text-xs font-medium text-slate-600">Status</div>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === 'ALL' ? 'All statuses' : pretty(option)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <div className="text-xs font-medium text-slate-600">Search</div>
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void load();
                }}
                placeholder="Order ID, OTC marketplace reference, patient ID, destination..."
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
              />
            </label>

            <button
              type="button"
              onClick={() => void load()}
              disabled={busy}
              className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Apply
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Pharmacy / fulfilment</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Rider</th>
                    <th className="px-4 py-3">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {busy ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-500" colSpan={6}>
                        Loading CarePort orders…
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-500" colSpan={6}>
                        No CarePort orders matched this filter.
                      </td>
                    </tr>
                  ) : (
                    rows.map((order) => {
                      const payment = latestPayment(order);
                      const currency = order.currency || payment?.currency || 'ZAR';

                      return (
                        <tr key={order.id} className="align-top">
                          <td className="px-4 py-4">
                            <div className="font-mono text-xs text-slate-900">{order.id}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {order.erxOrderId || 'No eRx reference'}
                            </div>
                            {isMarketplaceOrder(order) ? (
                              <span className="mt-2 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                OTC marketplace
                              </span>
                            ) : null}
                          </td>

                          <td className="px-4 py-4">
                            <span className={'inline-flex rounded-full border px-3 py-1 text-xs font-semibold ' + statusTone(order.status)}>
                              {pretty(order.status)}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-medium text-slate-900">
                              {order.chosenPharmacy?.name || order.chosenPharmacyId || 'Unassigned pharmacy'}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {pretty(order.fulfillment)} · {order.destinationAddr || 'No destination'}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              Patient: {order.patientId || '—'}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-medium text-slate-900">
                              {money(order.totalCents ?? payment?.amountMinor ?? payment?.amountCents, currency)}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {payment?.status || 'No payment'} {payment?.provider ? `· ${payment.provider}` : ''}
                            </div>
                            {payment?.providerRef ? (
                              <div className="mt-1 max-w-[220px] truncate font-mono text-[11px] text-slate-400">
                                {payment.providerRef}
                              </div>
                            ) : null}
                          </td>

                          <td className="px-4 py-4">
                            <div className="text-sm text-slate-700">
                              {order.assignment?.status || 'No rider assignment'}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              {order.assignment?.riderUserId || '—'}
                            </div>
                          </td>

                          <td className="px-4 py-4 text-xs text-slate-500">
                            <div>{formatWhen(order.updatedAt)}</div>
                            <div className="mt-1 text-slate-400">Created: {formatWhen(order.createdAt)}</div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}