'use client';

import React, { useEffect, useMemo, useState } from 'react';

type Pharmacy = {
  id?: string;
  name?: string;
  city?: string;
  province?: string;
  country?: string;
  active?: boolean;
};

type CatalogueRow = {
  id: string;
  pharmacyId?: string | null;
  name?: string;
  canonicalName?: string | null;
  globalProductKey?: string | null;
  brand?: string | null;
  barcode?: string | null;
  drugCode?: string | null;
  skuCode?: string | null;
  productType?: string | null;
  category?: string | null;
  subcategory?: string | null;
  catalogueSource?: string | null;
  normalisationStatus?: string | null;
  normalisationConfidence?: number | null;
  normalisationNotes?: string | null;
  customAttributeValues?: any;
  normalisedAttributes?: any;
  reviewRequired?: boolean;
  reviewReason?: string | null;
  marketplaceVisible?: boolean;
  prescriptionRequired?: boolean;
  otc?: boolean;
  priceCents?: number;
  currency?: string;
  updatedAt?: string;
  pharmacy?: Pharmacy | null;
};

type Draft = {
  canonicalName: string;
  globalProductKey: string;
  normalisationNotes: string;
  reviewReason: string;
};

const STATUS_OPTIONS = [
  'ALL',
  'RAW_PHARMACY_SUPPLIED',
  'MAPPED_TO_TEMPLATE',
  'ADMIN_VERIFIED',
  'GLOBAL_CATALOGUE_MATCHED',
  'REJECTED',
];

const PRODUCT_TYPES = [
  'ALL',
  'MEDICATION',
  'OTC_MEDICATION',
  'SUPPLEMENT',
  'MEDICAL_DEVICE',
  'PERSONAL_CARE',
  'SKINCARE',
  'HAIRCARE',
  'BABY_CARE',
  'HOUSEHOLD',
  'GENERAL_MERCHANDISE',
];

function money(cents?: number, currency = 'ZAR') {
  const value = Number(cents || 0) / 100;

  try {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(value);
  } catch {
    return currency + ' ' + value.toFixed(2);
  }
}

function pretty(value?: string | null) {
  return String(value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function shortDate(value?: string) {
  if (!value) return '—';

  try {
    return new Intl.DateTimeFormat('en-ZA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function jsonPreview(value: any) {
  if (!value) return '—';

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function statusClass(status?: string | null, reviewRequired?: boolean) {
  if (reviewRequired) return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'ADMIN_VERIFIED' || status === 'GLOBAL_CATALOGUE_MATCHED') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'REJECTED') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export default function CarePortCatalogueNormalisationPage() {
  const [rows, setRows] = useState<CatalogueRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [reviewRequired, setReviewRequired] = useState('true');
  const [productType, setProductType] = useState('ALL');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const counts = useMemo(() => {
    const review = rows.filter((row) => row.reviewRequired).length;
    const verified = rows.filter((row) => row.normalisationStatus === 'ADMIN_VERIFIED' || row.normalisationStatus === 'GLOBAL_CATALOGUE_MATCHED').length;
    const rejected = rows.filter((row) => row.normalisationStatus === 'REJECTED').length;

    return { total: rows.length, review, verified, rejected };
  }, [rows]);

  function ensureDraft(row: CatalogueRow): Draft {
    return drafts[row.id] || {
      canonicalName: row.canonicalName || row.name || '',
      globalProductKey: row.globalProductKey || '',
      normalisationNotes: row.normalisationNotes || '',
      reviewReason: row.reviewReason || '',
    };
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        canonicalName: current[id]?.canonicalName || '',
        globalProductKey: current[id]?.globalProductKey || '',
        normalisationNotes: current[id]?.normalisationNotes || '',
        reviewReason: current[id]?.reviewReason || '',
        ...patch,
      },
    }));
  }

  async function load() {
    setLoading(true);
    setError('');
    setNotice('');

    try {
      const params = new URLSearchParams();
      params.set('limit', '200');

      if (query.trim()) params.set('q', query.trim());
      if (status !== 'ALL') params.set('status', status);
      if (reviewRequired !== 'all') params.set('reviewRequired', reviewRequired);
      if (productType !== 'ALL') params.set('productType', productType);

      const res = await fetch('/api/admin/careport/catalogue/normalisation?' + params.toString(), {
        cache: 'no-store',
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || 'Failed to load catalogue queue');
      }

      setRows(Array.isArray(payload.items) ? payload.items : Array.isArray(payload.queue) ? payload.queue : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load catalogue queue');
    } finally {
      setLoading(false);
    }
  }

  async function act(row: CatalogueRow, action: string) {
    const draft = ensureDraft(row);

    setSavingId(row.id);
    setError('');
    setNotice('');

    try {
      const body: any = {
        skuId: row.id,
        action,
        canonicalName: draft.canonicalName,
        globalProductKey: draft.globalProductKey,
        normalisationNotes: draft.normalisationNotes,
        reviewReason: draft.reviewReason,
      };

      const res = await fetch('/api/admin/careport/catalogue/normalisation', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || 'Catalogue action failed');
      }

      setNotice('Catalogue governance action saved.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Catalogue action failed');
    } finally {
      setSavingId('');
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">CarePort catalogue governance</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Catalogue normalisation queue</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Review pharmacy-supplied SKUs, normalise custom values, verify canonical names, map items to global product keys and keep unsafe or inconsistent catalogue entries out of the public pharmacy marketplace.
              </p>
            </div>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Refreshing…' : 'Refresh queue'}
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Loaded</p>
              <p className="mt-2 text-2xl font-bold">{counts.total}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Needs review</p>
              <p className="mt-2 text-2xl font-bold text-amber-900">{counts.review}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Verified/matched</p>
              <p className="mt-2 text-2xl font-bold text-emerald-900">{counts.verified}</p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Rejected</p>
              <p className="mt-2 text-2xl font-bold text-rose-900">{counts.rejected}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px_220px_auto]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, canonical name, brand, barcode, SKU, drug code..."
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
            />

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
            >
              {STATUS_OPTIONS.map((item) => (
                <option key={item} value={item}>{pretty(item)}</option>
              ))}
            </select>

            <select
              value={reviewRequired}
              onChange={(event) => setReviewRequired(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
            >
              <option value="true">Needs review</option>
              <option value="false">No review</option>
              <option value="all">All</option>
            </select>

            <select
              value={productType}
              onChange={(event) => setProductType(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
            >
              {PRODUCT_TYPES.map((item) => (
                <option key={item} value={item}>{pretty(item)}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={load}
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              Apply
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
              {error}
            </div>
          )}

          {notice && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              {notice}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {!loading && rows.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
              No catalogue items matched the current filters.
            </div>
          )}

          {rows.map((row) => {
            const draft = ensureDraft(row);
            const statusLabel = pretty(row.normalisationStatus || 'RAW_PHARMACY_SUPPLIED');
            const pharmacyName = row.pharmacy?.name || row.pharmacyId || 'Unknown pharmacy';

            return (
              <article key={row.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={'rounded-full border px-3 py-1 text-xs font-semibold ' + statusClass(row.normalisationStatus, row.reviewRequired)}>
                        {row.reviewRequired ? 'Needs review · ' : ''}{statusLabel}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                        {pretty(row.productType || 'Unclassified')}
                      </span>
                      {row.otc && (
                        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800">OTC</span>
                      )}
                      {row.prescriptionRequired && (
                        <span className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-800">Prescription required</span>
                      )}
                      {row.marketplaceVisible && (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">Marketplace visible</span>
                      )}
                    </div>

                    <h2 className="mt-3 text-xl font-bold text-slate-950">{row.name || 'Unnamed SKU'}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {pharmacyName} · {row.category || 'No category'} {row.subcategory ? '· ' + row.subcategory : ''} · {money(row.priceCents, row.currency || 'ZAR')}
                    </p>

                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Canonical name</dt>
                        <dd className="mt-1 break-words font-medium text-slate-900">{row.canonicalName || '—'}</dd>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Global key</dt>
                        <dd className="mt-1 break-words font-mono text-xs text-slate-900">{row.globalProductKey || '—'}</dd>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Barcode / code</dt>
                        <dd className="mt-1 break-words font-mono text-xs text-slate-900">{row.barcode || row.drugCode || row.skuCode || '—'}</dd>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Confidence</dt>
                        <dd className="mt-1 font-medium text-slate-900">{row.normalisationConfidence == null ? '—' : Math.round(Number(row.normalisationConfidence) * 100) + '%'}</dd>
                      </div>
                    </dl>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Review reason</p>
                        <p className="mt-1 text-sm text-slate-700">{row.reviewReason || row.normalisationNotes || '—'}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Updated</p>
                        <p className="mt-1 text-sm text-slate-700">{shortDate(row.updatedAt)}</p>
                      </div>
                    </div>

                    <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-800">Attributes and custom values</summary>
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        <pre className="max-h-72 overflow-auto rounded-xl bg-white p-3 text-xs text-slate-700">{jsonPreview(row.normalisedAttributes)}</pre>
                        <pre className="max-h-72 overflow-auto rounded-xl bg-white p-3 text-xs text-slate-700">{jsonPreview(row.customAttributeValues)}</pre>
                      </div>
                    </details>
                  </div>

                  <div className="w-full shrink-0 space-y-3 xl:w-[360px]">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Canonical name</span>
                      <input
                        value={draft.canonicalName}
                        onChange={(event) => updateDraft(row.id, { canonicalName: event.target.value })}
                        className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Global product key</span>
                      <input
                        value={draft.globalProductKey}
                        onChange={(event) => updateDraft(row.id, { globalProductKey: event.target.value })}
                        className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 font-mono text-xs outline-none focus:border-emerald-500"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Governance note</span>
                      <textarea
                        value={draft.normalisationNotes}
                        onChange={(event) => updateDraft(row.id, { normalisationNotes: event.target.value })}
                        rows={3}
                        className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Review reason</span>
                      <textarea
                        value={draft.reviewReason}
                        onChange={(event) => updateDraft(row.id, { reviewReason: event.target.value })}
                        rows={2}
                        className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={savingId === row.id}
                        onClick={() => act(row, 'verify')}
                        className="rounded-2xl bg-emerald-600 px-3 py-3 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Verify
                      </button>
                      <button
                        type="button"
                        disabled={savingId === row.id}
                        onClick={() => act(row, 'match_global')}
                        className="rounded-2xl bg-slate-950 px-3 py-3 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
                      >
                        Match global
                      </button>
                      <button
                        type="button"
                        disabled={savingId === row.id}
                        onClick={() => act(row, 'request_review')}
                        className="rounded-2xl border border-amber-300 bg-amber-50 px-3 py-3 text-xs font-bold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
                      >
                        Needs review
                      </button>
                      <button
                        type="button"
                        disabled={savingId === row.id}
                        onClick={() => act(row, 'clear_review')}
                        className="rounded-2xl border border-slate-300 bg-white px-3 py-3 text-xs font-bold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        Clear review
                      </button>
                      <button
                        type="button"
                        disabled={savingId === row.id}
                        onClick={() => act(row, 'reject')}
                        className="col-span-2 rounded-2xl border border-rose-300 bg-rose-50 px-3 py-3 text-xs font-bold text-rose-800 transition hover:bg-rose-100 disabled:opacity-60"
                      >
                        Reject mapping
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
