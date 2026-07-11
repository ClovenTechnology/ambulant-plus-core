'use client';

import React, { useEffect, useMemo, useState } from 'react';

type GlobalProduct = {
  id: string;
  orgId?: string | null;
  globalProductKey?: string | null;
  canonicalName?: string | null;
  productType?: string | null;
  category?: string | null;
  subcategory?: string | null;
  otc?: boolean | null;
  prescriptionRequired?: boolean | null;
  marketplaceAllowed?: boolean | null;
  sellableOnline?: boolean | null;
  brand?: string | null;
  manufacturer?: string | null;
  packSize?: string | null;
  dosageForm?: string | null;
  strength?: string | null;
  route?: string | null;
  regulatedSchedule?: string | null;
  primaryBarcode?: string | null;
  primaryNappi?: string | null;
  primaryRxNorm?: string | null;
  primaryGtin?: string | null;
  catalogueStatus?: string | null;
  catalogueSource?: string | null;
  confidence?: number | null;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type FacetRow = {
  catalogueStatus?: string;
  productType?: string;
  _count?: { _all?: number };
};

type Payload = {
  ok?: boolean;
  total?: number;
  limit?: number;
  offset?: number;
  items?: GlobalProduct[];
  facets?: {
    byStatus?: FacetRow[];
    byProductType?: FacetRow[];
  };
  error?: string;
};

const STATUS_OPTIONS = ['ALL', 'ACTIVE', 'DRAFT', 'NEEDS_REVIEW', 'REJECTED'];

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
  'MERCHANDISE',
  'OTC',
];

function pretty(value?: string | null) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function shortDate(value?: string | null) {
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

function percent(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Math.round(Number(value) * 100) + '%';
}

function statusClass(status?: string | null) {
  if (status === 'ACTIVE') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'NEEDS_REVIEW') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'REJECTED') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function marketplaceClass(row: GlobalProduct) {
  if (row.marketplaceAllowed) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (row.prescriptionRequired) return 'border-sky-200 bg-sky-50 text-sky-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function StatCard(props: { label: string; value: number | string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{props.label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{props.value}</p>
      {props.helper ? <p className="mt-1 text-xs text-slate-500">{props.helper}</p> : null}
    </div>
  );
}

function facetCount(rows: FacetRow[] | undefined, key: 'catalogueStatus' | 'productType', value: string) {
  const row = rows?.find((item) => item[key] === value);
  return Number(row?._count?._all || 0);
}

export default function CarePortGlobalCataloguePage() {
  const [items, setItems] = useState<GlobalProduct[]>([]);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [productType, setProductType] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const counts = useMemo(() => {
    const byStatus = payload?.facets?.byStatus || [];
    const byProductType = payload?.facets?.byProductType || [];

    return {
      total: Number(payload?.total || items.length),
      active: facetCount(byStatus, 'catalogueStatus', 'ACTIVE'),
      review: facetCount(byStatus, 'catalogueStatus', 'NEEDS_REVIEW'),
      rejected: facetCount(byStatus, 'catalogueStatus', 'REJECTED'),
      medication: facetCount(byProductType, 'productType', 'MEDICATION'),
      supplements: facetCount(byProductType, 'productType', 'SUPPLEMENT'),
      merchandise:
        facetCount(byProductType, 'productType', 'GENERAL_MERCHANDISE') +
        facetCount(byProductType, 'productType', 'MERCHANDISE'),
    };
  }, [payload, items.length]);

  async function load() {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.set('limit', '200');

      if (query.trim()) params.set('q', query.trim());
      if (status !== 'ALL') params.set('status', status);
      if (productType !== 'ALL') params.set('productType', productType);

      const res = await fetch('/api/admin/careport/catalogue/global-products?' + params.toString(), {
        cache: 'no-store',
      });

      const nextPayload: Payload = await res.json().catch(() => ({}));

      if (!res.ok || nextPayload?.ok === false) {
        throw new Error(nextPayload?.error || 'Failed to load global catalogue');
      }

      setPayload(nextPayload);
      setItems(Array.isArray(nextPayload.items) ? nextPayload.items : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load global catalogue');
      setItems([]);
      setPayload(null);
    } finally {
      setLoading(false);
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
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                CarePort canonical catalogue
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Global product catalogue</h1>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href="/admin/careport/catalogue"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Catalogue hub
                </a>
                <a
                  href="/admin/careport/catalogue/normalisation"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Normalisation queue
                </a>
                <a
                  href="/admin/careport/pharmacy-inventory"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Pharmacy inventory
                </a>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Inspect the canonical product layer created from pharmacy-supplied SKUs. This is the bridge between local
                pharmacy inventory, NAPPI/RxNorm/barcode mapping, prescription-only fulfilment and the patient-facing OTC
                marketplace.
              </p>
            </div>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Refreshing…' : 'Refresh catalogue'}
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Canonical products" value={counts.total} helper="Distinct global product records" />
            <StatCard label="Active" value={counts.active} helper="Ready for matching and fulfilment" />
            <StatCard label="Needs review" value={counts.review} helper="Requires catalogue governance" />
            <StatCard label="Rejected" value={counts.rejected} helper="Blocked from canonical trust" />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <StatCard label="Medication" value={counts.medication} />
            <StatCard label="Supplements" value={counts.supplements} />
            <StatCard label="Merchandise" value={counts.merchandise} />
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_220px_240px_auto]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search canonical name, global key, barcode, NAPPI, RxNorm or GTIN"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'ALL' ? 'All statuses' : pretty(option)}
                </option>
              ))}
            </select>

            <select
              value={productType}
              onChange={(event) => setProductType(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              {PRODUCT_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option === 'ALL' ? 'All product types' : pretty(option)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Apply filters
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">Canonical products</h2>
            <p className="mt-1 text-sm text-slate-500">
              {loading ? 'Loading catalogue…' : items.length + ' product record(s) shown'}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Canonical product</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Marketplace</th>
                  <th className="px-5 py-3 font-semibold">Codes</th>
                  <th className="px-5 py-3 font-semibold">Confidence</th>
                  <th className="px-5 py-3 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {items.map((item) => (
                  <tr key={item.id} className="align-top hover:bg-slate-50/70">
                    <td className="max-w-md px-5 py-4">
                      <p className="font-semibold text-slate-950">{item.canonicalName || 'Unnamed product'}</p>
                      <p className="mt-1 break-all text-xs text-slate-500">{item.globalProductKey || 'No global key'}</p>
                      {item.brand || item.manufacturer || item.packSize ? (
                        <p className="mt-2 text-xs text-slate-500">
                          {[item.brand, item.manufacturer, item.packSize].filter(Boolean).join(' · ')}
                        </p>
                      ) : null}
                      {item.notes ? <p className="mt-2 line-clamp-2 text-xs text-slate-500">{item.notes}</p> : null}
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-800">{pretty(item.productType)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {[item.category, item.subcategory].filter(Boolean).join(' / ') || '—'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {[item.dosageForm, item.strength, item.route].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <span className={'inline-flex rounded-full border px-3 py-1 text-xs font-semibold ' + statusClass(item.catalogueStatus)}>
                        {pretty(item.catalogueStatus || 'DRAFT')}
                      </span>
                      <p className="mt-2 text-xs text-slate-500">{pretty(item.catalogueSource)}</p>
                    </td>

                    <td className="px-5 py-4">
                      <span className={'inline-flex rounded-full border px-3 py-1 text-xs font-semibold ' + marketplaceClass(item)}>
                        {item.marketplaceAllowed ? 'Marketplace allowed' : item.prescriptionRequired ? 'eRx only' : 'Hidden online'}
                      </span>
                      <p className="mt-2 text-xs text-slate-500">
                        OTC: {item.otc ? 'Yes' : 'No'} · Online: {item.sellableOnline ? 'Yes' : 'No'}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-600">
                      <p>Barcode: {item.primaryBarcode || '—'}</p>
                      <p>NAPPI: {item.primaryNappi || '—'}</p>
                      <p>RxNorm: {item.primaryRxNorm || '—'}</p>
                      <p>GTIN: {item.primaryGtin || '—'}</p>
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800">{percent(item.confidence)}</p>
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-500">
                      {shortDate(item.updatedAt || item.createdAt)}
                    </td>
                  </tr>
                ))}

                {!loading && !items.length ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                      No canonical products matched the current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}