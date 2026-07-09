'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type MarketplaceItem = {
  id: string;
  skuId: string;
  pharmacyId?: string | null;
  pharmacyName?: string | null;
  pharmacyCity?: string | null;
  pharmacyAddress?: string | null;
  supportsPickup?: boolean;
  supportsDelivery?: boolean;
  globalProductId?: string | null;
  globalProductKey?: string | null;
  canonicalName?: string | null;
  displayName?: string | null;
  productType?: string | null;
  productTypeLabel?: string | null;
  category?: string | null;
  subcategory?: string | null;
  otc?: boolean;
  prescriptionRequired?: boolean;
  marketplaceVisible?: boolean;
  sellableOnline?: boolean;
  brand?: string | null;
  manufacturer?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  packSize?: string | null;
  variantName?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  availableStock?: number | null;
  maxOrderQty?: number | null;
  ageRestricted?: boolean;
  regulatedSchedule?: string | null;
};

type Payload = {
  ok?: boolean;
  total?: number;
  items?: MarketplaceItem[];
  facets?: {
    categories?: string[];
    productTypes?: string[];
  };
  error?: string;
};

type CartLine = {
  item: MarketplaceItem;
  qty: number;
};

function money(cents?: number | null, currency = 'ZAR') {
  const value = Number(cents || 0) / 100;

  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency,
    }).format(value);
  } catch {
    return currency + ' ' + value.toFixed(2);
  }
}

function pretty(value?: string | null) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function itemTitle(item: MarketplaceItem) {
  return item.canonicalName || item.displayName || 'Pharmacy product';
}

function itemSubtitle(item: MarketplaceItem) {
  return [item.brand, item.packSize || item.variantName, item.manufacturer].filter(Boolean).join(' · ');
}

function stockLabel(item: MarketplaceItem) {
  if (typeof item.availableStock === 'number') {
    if (item.availableStock <= 0) return 'Out of stock';
    if (item.availableStock <= 5) return item.availableStock + ' left';
    return 'In stock';
  }

  return 'Stock confirmed by pharmacy';
}

function stockClass(item: MarketplaceItem) {
  if (typeof item.availableStock === 'number' && item.availableStock <= 5) {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }

  return 'border-emerald-200 bg-emerald-50 text-emerald-800';
}

export default function PatientPharmacyMarketplacePage() {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ALL');
  const [productType, setProductType] = useState('ALL');
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState('');
  const [checkoutError, setCheckoutError] = useState('');

  const cartLines = useMemo(() => Object.values(cart), [cart]);

  const cartTotal = useMemo(() => {
    return cartLines.reduce((sum, line) => {
      return sum + Number(line.item.priceCents || 0) * line.qty;
    }, 0);
  }, [cartLines]);

  const categories = useMemo(() => {
    const fromPayload = payload?.facets?.categories || [];
    const fromItems = items.map((item) => item.category).filter(Boolean) as string[];
    return Array.from(new Set([...fromPayload, ...fromItems])).sort();
  }, [payload, items]);

  const productTypes = useMemo(() => {
    const fromPayload = payload?.facets?.productTypes || [];
    const fromItems = items.map((item) => item.productType).filter(Boolean) as string[];
    return Array.from(new Set([...fromPayload, ...fromItems])).sort();
  }, [payload, items]);

  async function load() {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.set('limit', '120');

      if (query.trim()) params.set('q', query.trim());
      if (category !== 'ALL') params.set('category', category);
      if (productType !== 'ALL') params.set('productType', productType);

      const res = await fetch('/api/careport/marketplace/products?' + params.toString(), {
        cache: 'no-store',
      });

      const data: Payload = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || 'Unable to load pharmacy marketplace.');
      }

      setPayload(data);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load pharmacy marketplace.');
      setPayload(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function addToCart(item: MarketplaceItem) {
    setCheckoutNotice('');
    setCheckoutError('');

    setCart((current) => {
      const existing = current[item.skuId];
      const nextQty = Math.min(
        Number(item.maxOrderQty || 99),
        (existing?.qty || 0) + 1,
      );

      return {
        ...current,
        [item.skuId]: {
          item,
          qty: nextQty,
        },
      };
    });
  }

  function removeFromCart(skuId: string) {
    setCheckoutNotice('');
    setCheckoutError('');

    setCart((current) => {
      const next = { ...current };
      delete next[skuId];
      return next;
    });
  }

  async function checkout() {
    if (!cartLines.length) {
      setCheckoutError('Add at least one product before checkout.');
      return;
    }

    setCheckingOut(true);
    setCheckoutNotice('');
    setCheckoutError('');

    try {
      const lines = cartLines.map((line) => ({
        skuId: line.item.skuId,
        qty: line.qty,
      }));

      const res = await fetch('/api/careport/marketplace/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fulfillment: 'PICKUP',
          lines,
        }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || 'Unable to create CarePort OTC order.');
      }

      setCart({});
      setCheckoutNotice(
        'CarePort OTC order created. Stock has been reserved while payment is pending. Order ID: ' +
          String(payload?.order?.id || 'created'),
      );
    } catch (err: any) {
      setCheckoutError(err?.message || 'Unable to create CarePort OTC order.');
    } finally {
      setCheckingOut(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                CarePort pharmacy marketplace
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Pharmacy
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Browse non-prescription pharmacy products and merchandise from verified CarePort pharmacy inventory.
                Prescription-only medicines remain locked to eRx fulfilment.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/careport"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                eRx CarePort
              </Link>
              <Link
                href="/careport/history"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Order history
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_180px_220px_auto]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search vitamins, skincare, haircare, bottles, devices…"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />

            <select
              value={productType}
              onChange={(event) => setProductType(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="ALL">All types</option>
              {productTypes.map((option) => (
                <option key={option} value={option}>
                  {pretty(option)}
                </option>
              ))}
            </select>

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="ALL">All categories</option>
              {categories.map((option) => (
                <option key={option} value={option}>
                  {pretty(option)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {error}
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs leading-5 text-sky-900">
            Marketplace guardrail: only active, non-prescription, sellable-online SKUs mapped to active canonical
            catalogue products are shown here.
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm sm:col-span-2 xl:col-span-3">
                Loading CarePort pharmacy products…
              </div>
            ) : items.length ? (
              items.map((item) => (
                <article key={item.skuId} className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100 p-5">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />
                    ) : (
                      <div className="rounded-3xl border border-emerald-100 bg-white px-5 py-4 text-center text-sm font-semibold text-emerald-800 shadow-sm">
                        {pretty(item.category || item.productType || 'Pharmacy')}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                          OTC / no prescription
                        </span>
                        {item.ageRestricted ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                            Age restricted
                          </span>
                        ) : null}
                      </div>

                      <h2 className="mt-3 line-clamp-2 text-base font-semibold text-slate-950">
                        {itemTitle(item)}
                      </h2>
                      {itemSubtitle(item) ? (
                        <p className="mt-1 text-xs text-slate-500">{itemSubtitle(item)}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-500">
                        {pretty(item.productTypeLabel || item.productType)} · {pretty(item.category || 'General')}
                      </p>
                    </div>

                    {item.description ? (
                      <p className="line-clamp-2 text-sm leading-5 text-slate-600">{item.description}</p>
                    ) : null}

                    <div className="mt-auto space-y-3">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <div className="text-xs text-slate-500">Price</div>
                          <div className="text-lg font-bold text-slate-950">
                            {money(item.priceCents, item.currency || 'ZAR')}
                          </div>
                        </div>

                        <span className={'rounded-full border px-3 py-1 text-xs font-semibold ' + stockClass(item)}>
                          {stockLabel(item)}
                        </span>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                        <div className="font-semibold text-slate-800">{item.pharmacyName || 'CarePort pharmacy'}</div>
                        <div>{[item.pharmacyCity, item.pharmacyAddress].filter(Boolean).join(' · ') || 'Location available at checkout'}</div>
                        <div className="mt-1">
                          {item.supportsDelivery ? 'Delivery available' : 'Delivery pending'} ·{' '}
                          {item.supportsPickup ? 'Pickup available' : 'Pickup pending'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => addToCart(item)}
                        className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Add to basket
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm sm:col-span-2 xl:col-span-3">
                No patient-visible OTC marketplace products matched these filters. Prescription-only items are intentionally hidden.
              </div>
            )}
          </section>

          <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Basket preview</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Create a CarePort OTC order and reserve pharmacy stock while payment is pending.
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                {cartLines.length}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {cartLines.length ? (
                cartLines.map((line) => (
                  <div key={line.item.skuId} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{itemTitle(line.item)}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Qty {line.qty} · {money(line.item.priceCents, line.item.currency || 'ZAR')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(line.item.skuId)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  Your basket preview is empty.
                </div>
              )}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Estimated subtotal</span>
                <span className="font-bold text-slate-950">{money(cartTotal, 'ZAR')}</span>
              </div>

              {checkoutNotice ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
                  {checkoutNotice}
                </div>
              ) : null}

              {checkoutError ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800">
                  {checkoutError}
                </div>
              ) : null}

              <button
                type="button"
                onClick={checkout}
                disabled={!cartLines.length || checkingOut}
                className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {checkingOut ? 'Creating order…' : 'Create OTC order'}
              </button>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                This creates a CarePort marketplace order in payment-pending state and reserves stock for the selected pharmacy SKU lines.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}