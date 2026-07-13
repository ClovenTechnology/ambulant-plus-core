'use client';

// apps/careport/app/pharmacy/offers/page.tsx
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
  orderItems?: Array<{ id: string; name: string; quantity: number; directions?: string | null }>;
  coverage?: {
    coveragePercent: number;
    invitationClass: string;
    matchedCount: number;
    totalItemCount: number;
  };
};

type ResponseShape = {
  ok: boolean;
  pharmacy?: { id: string; name: string; kycStatus?: string };
  offers?: Offer[];
  error?: string;
};

function coverageTone(value?: number) {
  const n = Number(value || 0);
  if (n >= 100) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (n >= 60) return 'bg-amber-50 text-amber-700 ring-amber-200';
  return 'bg-rose-50 text-rose-700 ring-rose-200';
}

function statusTone(status?: string) {
  const s = String(status || '').toUpperCase();
  if (s === 'INVITED') return 'bg-blue-50 text-blue-700 ring-blue-200';
  if (s === 'ACCEPTED') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (s === 'DECLINED') return 'bg-slate-100 text-slate-600 ring-slate-200';
  return 'bg-amber-50 text-amber-700 ring-amber-200';
}

export default function PharmacyOffersPage() {
  const [status, setStatus] = useState<'INVITED' | 'ACCEPTED' | 'DECLINED' | 'ALL'>('INVITED');
  const [data, setData] = useState<ResponseShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(nextStatus = status) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/careport/pharmacies/me/offers?status=${encodeURIComponent(nextStatus)}&limit=100`, {
        cache: 'no-store',
      });
      const json = (await res.json().catch(() => ({}))) as ResponseShape;
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
    } catch (err: any) {
      setError(humanErrorMessage(err, 'Unable to load invitations.'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const offers = data?.offers ?? [];
  const summary = useMemo(() => ({
    total: offers.length,
    full: offers.filter((offer) => (offer.coverage?.coveragePercent || 0) >= 100).length,
    partial: offers.filter((offer) => {
      const p = offer.coverage?.coveragePercent || 0;
      return p >= 60 && p < 100;
    }).length,
  }), [offers]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">Pharmacy invitation inbox</div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Respond to CarePort requests</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Accept requests only when stock availability is safe and transparent. Full coverage is preferred; partial-capable offers are allowed when at least 60% of the order can be fulfilled.
            </p>
          </div>
          <button onClick={() => load(status)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-2xl font-semibold text-slate-950">{summary.total}</div>
          <div className="mt-1 text-xs text-slate-500">Displayed requests</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-2xl font-semibold text-slate-950">{summary.full}</div>
          <div className="mt-1 text-xs text-slate-500">100% coverage</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-2xl font-semibold text-slate-950">{summary.partial}</div>
          <div className="mt-1 text-xs text-slate-500">Partial capable</div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {(['INVITED', 'ACCEPTED', 'DECLINED', 'ALL'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 ${
                status === value ? 'bg-teal-600 text-white ring-teal-600' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {value === 'ALL' ? 'All' : value.charAt(0) + value.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </section>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{humanErrorMessage(error, "Unable to complete this request. Please try again.")}</div>}
      {loading && <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading invitations…</div>}

      {!loading && !error && (
        <section className="space-y-3">
          {offers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
              <h2 className="text-base font-semibold text-slate-950">No matching requests</h2>
              <p className="mt-2 text-sm text-slate-500">No real gateway invitations match this filter.</p>
            </div>
          ) : (
            offers.map((offer) => {
              const coverage = offer.coverage?.coveragePercent ?? 0;
              return (
                <article key={offer.offerId} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone(offer.status)}`}>{offer.status}</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${coverageTone(coverage)}`}>{coverage}% coverage</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{offer.order?.fulfillment || '—'}</span>
                        {typeof offer.order?.distanceKm === 'number' && <span className="text-xs text-slate-500">{offer.order.distanceKm} km</span>}
                      </div>
                      <h2 className="mt-3 text-base font-semibold text-slate-950">Order {offer.orderId}</h2>
                      <p className="mt-1 text-sm text-slate-500">{offer.orderItems?.length || 0} requested item(s)</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(offer.orderItems || []).slice(0, 4).map((item) => (
                          <span key={item.id} className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
                            {item.quantity} × {item.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                      <Link href={`/pharmacy/offers/${encodeURIComponent(offer.offerId)}`} className="rounded-full bg-teal-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-teal-700">
                        {offer.status === 'INVITED' ? 'Respond with offer' : 'View response'}
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      )}
    </main>
  );
}
