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

// apps/careport/app/pharmacy/offers/[offerId]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

type StockFlag = 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE';

type Offer = {
  offerId: string;
  orderId: string;
  pharmacyId: string;
  status: string;
  createdAt?: string;
  order?: {
    fulfillment?: 'DELIVERY' | 'PICKUP';
    distanceKm?: number | null;
    destinationAddr?: string | null;
  };
  orderItems?: Array<{ id: string; name: string; quantity: number; directions?: string | null; drugCode?: string | null }>;
  coverage?: {
    coveragePercent: number;
    invitationClass: string;
    lines?: Array<{
      orderItemId: string;
      name: string;
      matched: boolean;
      originalMatched: boolean;
      genericMatched: boolean;
      optionCount: number;
    }>;
  };
};

type ResponseShape = {
  ok: boolean;
  offers?: Offer[];
  error?: string;
};

function statusLabel(flag: StockFlag) {
  if (flag === 'AVAILABLE') return 'Available';
  if (flag === 'PARTIAL') return 'Partial / generic only';
  return 'Unavailable';
}

function defaultFlags(offer: Offer | null): Record<string, StockFlag> {
  const out: Record<string, StockFlag> = {};
  const lines = offer?.coverage?.lines || [];
  for (const item of offer?.orderItems || []) {
    const line = lines.find((x) => x.orderItemId === item.id);
    out[item.id] = line?.matched ? (line.originalMatched ? 'AVAILABLE' : 'PARTIAL') : 'UNAVAILABLE';
  }
  return out;
}

export default function PharmacyOfferDetailPage() {
  const params = useParams<{ offerId: string }>();
  const router = useRouter();
  const offerId = String(params?.offerId || '').trim();

  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prepEtaMin, setPrepEtaMin] = useState('30');
  const [stockFlags, setStockFlags] = useState<Record<string, StockFlag>>({});
  const [declineReason, setDeclineReason] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/careport/pharmacies/me/offers?status=ALL&limit=100', { cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as ResponseShape;
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
      const found = (json.offers || []).find((row) => row.offerId === offerId) || null;
      if (!found) throw new Error('offer_not_found');
      setOffer(found);
      setStockFlags(defaultFlags(found));
    } catch (err: any) {
      setError(humanErrorMessage(err, 'Unable to load offer.'));
      setOffer(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (offerId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerId]);

  const canSubmit = useMemo(() => {
    if (!offer || offer.status !== 'INVITED') return false;
    const eta = Number(prepEtaMin);
    if (!Number.isFinite(eta) || eta < 1) return false;
    return (offer.orderItems || []).every((item) => Boolean(stockFlags[item.id]));
  }, [offer, prepEtaMin, stockFlags]);

  async function submitOffer() {
    if (!offer || !canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/careport/orders/${encodeURIComponent(offer.orderId)}/pharmacies/${encodeURIComponent(offer.pharmacyId)}/accept`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            prepEtaMin: Number(prepEtaMin),
            stockFlags,
          }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) throw new Error(humanErrorMessage(json?.error, `HTTP ${res.status}`));
      router.push('/pharmacy/offers?status=ACCEPTED');
    } catch (err: any) {
      setError(humanErrorMessage(err, 'Unable to submit offer.'));
    } finally {
      setBusy(false);
    }
  }

  async function declineOffer() {
    if (!offer || offer.status !== 'INVITED') return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/careport/pharmacies/me/offers/${encodeURIComponent(offer.offerId)}/decline`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: declineReason.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) throw new Error(humanErrorMessage(json?.error, `HTTP ${res.status}`));
      router.push('/pharmacy/offers?status=DECLINED');
    } catch (err: any) {
      setError(humanErrorMessage(err, 'Unable to decline offer.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/pharmacy/offers" className="text-sm font-semibold text-teal-700 hover:text-teal-800">
          ← Back to invitations
        </Link>
        <button onClick={load} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Refresh
        </button>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{humanErrorMessage(error, "Unable to complete this request. Please try again.")}</div>}
      {loading && <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading offer…</div>}

      {!loading && offer && (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">CarePort pharmacy response</div>
                <h1 className="mt-2 text-2xl font-semibold text-slate-950">Order {offer.orderId}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Confirm what you can safely fulfil. The patient will compare your offer against other pharmacies using availability, ETA, original/generic options, distance, and final price.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <div><strong>Status:</strong> {offer.status}</div>
                <div><strong>Mode:</strong> {offer.order?.fulfillment || '—'}</div>
                <div><strong>Coverage:</strong> {offer.coverage?.coveragePercent ?? 0}%</div>
                {typeof offer.order?.distanceKm === 'number' && <div><strong>Distance:</strong> {offer.order.distanceKm} km</div>}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Availability response</h2>
                <p className="mt-1 text-sm text-slate-500">Set item availability and preparation ETA.</p>
              </div>
              <label className="text-sm font-medium text-slate-700">
                Prep ETA in minutes
                <input
                  type="number"
                  min={1}
                  value={prepEtaMin}
                  onChange={(event) => setPrepEtaMin(event.target.value)}
                  disabled={offer.status !== 'INVITED'}
                  className="ml-3 w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-5 space-y-3">
              {(offer.orderItems || []).map((item) => {
                const line = offer.coverage?.lines?.find((x) => x.orderItemId === item.id);
                return (
                  <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">{item.quantity} × {item.name}</div>
                        {item.directions && <div className="mt-1 text-xs text-slate-500">{item.directions}</div>}
                        <div className="mt-2 text-xs text-slate-500">
                          {line?.originalMatched ? 'Original matched' : line?.genericMatched ? 'Generic/substitution match' : 'No current SKU match'} · {line?.optionCount || 0} option(s)
                        </div>
                      </div>
                      <select
                        value={stockFlags[item.id] || 'UNAVAILABLE'}
                        disabled={offer.status !== 'INVITED'}
                        onChange={(event) => setStockFlags((prev) => ({ ...prev, [item.id]: event.target.value as StockFlag }))}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      >
                        {(['AVAILABLE', 'PARTIAL', 'UNAVAILABLE'] as StockFlag[]).map((flag) => (
                          <option key={flag} value={flag}>{statusLabel(flag)}</option>
                        ))}
                      </select>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {offer.status === 'INVITED' && (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-xl">
                  <h2 className="text-base font-semibold text-slate-950">Submit or decline</h2>
                  <p className="mt-1 text-sm text-slate-500">Submitting an offer makes it visible to the patient marketplace. Declining removes this request from your active inbox.</p>
                  <input
                    value={declineReason}
                    onChange={(event) => setDeclineReason(event.target.value)}
                    placeholder="Optional decline reason"
                    className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={declineOffer}
                    disabled={busy}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Decline
                  </button>
                  <button
                    onClick={submitOffer}
                    disabled={!canSubmit || busy}
                    className="rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                  >
                    {busy ? 'Submitting…' : 'Submit availability offer'}
                  </button>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
