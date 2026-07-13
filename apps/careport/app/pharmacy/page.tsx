'use client';

// apps/careport/app/pharmacy/page.tsx
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

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


type Pharmacy = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  kycStatus?: string | null;
  supportsDelivery?: boolean;
  supportsPickup?: boolean;
};

type Offer = {
  offerId: string;
  orderId: string;
  status: string;
  createdAt?: string;
  order?: {
    fulfillment?: 'DELIVERY' | 'PICKUP';
    distanceKm?: number | null;
    destinationAddr?: string | null;
  };
  orderItems?: Array<{ id: string; name: string; quantity: number }>;
  coverage?: {
    coveragePercent: number;
    invitationClass: string;
    matchedCount: number;
    totalItemCount: number;
  };
};

type OffersResponse = {
  ok: boolean;
  pharmacy?: Pharmacy;
  offers?: Offer[];
  error?: string;
};

function formatTime(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function statusTone(status?: string) {
  const s = String(status || '').toUpperCase();
  if (s === 'INVITED') return 'bg-blue-50 text-blue-700 ring-blue-200';
  if (s === 'ACCEPTED') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (s === 'DECLINED') return 'bg-slate-100 text-slate-600 ring-slate-200';
  return 'bg-amber-50 text-amber-700 ring-amber-200';
}

export default function PharmacyDashboardPage() {
  const [data, setData] = useState<OffersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/careport/pharmacies/me/offers?status=ALL&limit=20', { cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as OffersResponse;
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
    } catch (err: any) {
      setError(humanErrorMessage(err, 'Unable to load pharmacy workspace.'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const offers = data?.offers ?? [];
  const invited = offers.filter((o) => o.status === 'INVITED').length;
  const accepted = offers.filter((o) => o.status === 'ACCEPTED').length;
  const fullCoverage = offers.filter((o) => o.coverage?.invitationClass === 'FULL').length;

  const recent = useMemo(() => offers.slice(0, 5), [offers]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">Pharmacy command centre</div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">
              {data?.pharmacy?.name || 'Your pharmacy workspace'}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Review CarePort requests, respond with real stock availability, and keep patient fulfilment transparent. No demo orders are shown here; if the gateway cannot resolve the pharmacy, the page will tell you directly.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={load} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Refresh
            </button>
            <Link href="/pharmacy/offers" className="rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
              Review invitations
            </Link>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {humanErrorMessage(error, "Unable to complete this request. Please try again.")}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading pharmacy workspace…</div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-2xl font-semibold text-slate-950">{invited}</div>
              <div className="mt-1 text-xs text-slate-500">Awaiting response</div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-2xl font-semibold text-slate-950">{accepted}</div>
              <div className="mt-1 text-xs text-slate-500">Offers submitted</div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-2xl font-semibold text-slate-950">{fullCoverage}</div>
              <div className="mt-1 text-xs text-slate-500">100% coverage cases</div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-2xl font-semibold text-slate-950">{data?.pharmacy?.kycStatus || '—'}</div>
              <div className="mt-1 text-xs text-slate-500">KYC status</div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Recent CarePort requests</h2>
                <p className="mt-1 text-sm text-slate-500">Only real gateway invitations and responses appear here.</p>
              </div>
              <Link href="/pharmacy/offers" className="text-sm font-semibold text-teal-700 hover:text-teal-800">
                View all
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {recent.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  No CarePort pharmacy requests yet.
                </div>
              ) : (
                recent.map((offer) => (
                  <Link
                    key={offer.offerId}
                    href={`/pharmacy/offers/${encodeURIComponent(offer.offerId)}`}
                    className="block rounded-2xl border border-slate-200 p-4 transition hover:border-teal-200 hover:bg-teal-50/40"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone(offer.status)}`}>{offer.status}</span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{offer.order?.fulfillment || '—'}</span>
                          <span className="text-xs text-slate-500">{formatTime(offer.createdAt)}</span>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-950">Order {offer.orderId}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {offer.orderItems?.length || 0} item(s) · {offer.coverage?.coveragePercent ?? 0}% stock coverage
                          {typeof offer.order?.distanceKm === 'number' ? ` · ${offer.order.distanceKm} km` : ''}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-teal-700">Open →</div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
