// apps/clinician-app/app/shop/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { DEMO_PRODUCTS, withImageFallback, type Product, type ProductVariant } from '@/mock/shopDemoCatalog';

type Category = 'all' | 'clothing' | 'desk' | 'tech' | 'clinic';

const CATEGORY_PILLS: { id: Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'clothing', label: 'Clothing' },
  { id: 'desk', label: 'Desk' },
  { id: 'tech', label: 'Tech' },
  { id: 'clinic', label: 'Clinic' },
];

function getUid() {
  if (typeof window === 'undefined') return 'server-user';
  const key = 'ambulant_uid';
  let v = localStorage.getItem(key);
  if (!v) {
    v = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + '-u';
    localStorage.setItem(key, v);
  }
  return v;
}

function formatZar(n: number) {
  return `R ${Math.round(n).toString()}`;
}

function pickSaleOrBase(base?: number, sale?: number) {
  const s = Number(sale);
  if (Number.isFinite(s) && s > 0) return s;
  const b = Number(base);
  if (Number.isFinite(b) && b > 0) return b;
  return 0;
}

function pillMatchCategory(p: Product, cat: Category) {
  if (cat === 'all') return true;
  const tags = (p.tags || []).map((t) => t.toLowerCase());
  return tags.includes(cat);
}

export default function ShopPage() {
  const sp = useSearchParams();
  const status = sp.get('status'); // success | cancelled

  const [buyerUid] = useState(() => getUid());

  const [products, setProducts] = useState<Product[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  // Filters
  const [category, setCategory] = useState<Category>('all');
  const [query, setQuery] = useState('');

  // Selected variant per product
  const [variantChoice, setVariantChoice] = useState<Record<string, string>>({});

  // Selected image index per product
  const [imageIdx, setImageIdx] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        setUsingFallback(false);

        // 🔧 IMPORTANT: remove "type=merch" so the demo can show all groupings
        const res = await fetch('/api/shop/products?active=1', { cache: 'no-store' });
        const js = await res.json().catch(() => ({}));

        if (!res.ok || js?.ok === false) {
          throw new Error(js?.error || 'Failed to load products');
        }

        const items = Array.isArray(js?.items) ? (js.items as Product[]) : [];
        if (!items.length) {
          // empty catalog is a legitimate “fallback moment” for demo
          setUsingFallback(true);
          setProducts(withImageFallback(DEMO_PRODUCTS));
          setError('Live catalog returned no items. Showing demo catalog.');
          return;
        }

        setProducts(items);
      } catch (err: any) {
        setUsingFallback(true);
        setProducts(withImageFallback(DEMO_PRODUCTS));
        setError(err?.message || 'Live catalog unavailable. Showing demo catalog.');
      }
    })();
  }, []);

  // Ensure default variant + default image index
  useEffect(() => {
    setVariantChoice((prev) => {
      const next = { ...prev };
      for (const p of products) {
        if (!p?.variants?.length) continue;
        if (next[p.id]) continue;

        const firstInStock =
          p.variants.find((v) => (v.inStock ?? true) && ((v.stockQty ?? 1) > 0)) ?? p.variants[0];

        next[p.id] = firstInStock.id;
      }
      return next;
    });

    setImageIdx((prev) => {
      const next = { ...prev };
      for (const p of products) {
        if (typeof next[p.id] === 'number') continue;
        next[p.id] = 0;
      }
      return next;
    });
  }, [products]);

  const derived = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = products
      .filter((p) => pillMatchCategory(p, category))
      .filter((p) => {
        if (!q) return true;
        const hay = [p.name, p.description || '', (p.tags || []).join(' ')].join(' ').toLowerCase();
        return hay.includes(q);
      });

    return filtered.map((p) => {
      const chosenVariantId = variantChoice[p.id];
      const chosenVariant = p.variants?.find((v) => v.id === chosenVariantId);

      const imgs = (p.images && p.images.length ? p.images : p.imageUrl ? [p.imageUrl] : []) as string[];
      const idx = Math.max(0, Math.min((imageIdx[p.id] ?? 0) | 0, Math.max(0, imgs.length - 1)));
      const displayImage = chosenVariant?.imageUrl || imgs[idx] || imgs[0] || p.imageUrl;

      const price = chosenVariant
        ? pickSaleOrBase((chosenVariant as ProductVariant).unitAmountZar, (chosenVariant as ProductVariant).saleUnitAmountZar)
        : pickSaleOrBase(p.unitAmountZar, p.saleAmountZar);

      const inStock = p.variants?.length
        ? (chosenVariant?.inStock ?? true) && ((chosenVariant?.stockQty ?? 1) > 0)
        : (p.inStock ?? true) && ((p.stockQty ?? 1) > 0);

      const stockLabel = p.variants?.length
        ? (() => {
            const q = chosenVariant?.stockQty;
            if (chosenVariant && chosenVariant.inStock === false) return 'Out of stock';
            if (typeof q === 'number') return q <= 0 ? 'Out of stock' : `${q} left`;
            return inStock ? 'In stock' : 'Out of stock';
          })()
        : (() => {
            const q = p.stockQty;
            if (p.inStock === false) return 'Out of stock';
            if (typeof q === 'number') return q <= 0 ? 'Out of stock' : `${q} left`;
            return inStock ? 'In stock' : 'Out of stock';
          })();

      const onSale = chosenVariant
        ? Number((chosenVariant as any).saleUnitAmountZar || 0) > 0 &&
          Number((chosenVariant as any).saleUnitAmountZar) < Number(chosenVariant.unitAmountZar)
        : Number(p.saleAmountZar || 0) > 0 && Number(p.saleAmountZar) < Number(p.unitAmountZar);

      const basePrice = chosenVariant ? Number(chosenVariant.unitAmountZar || 0) : Number(p.unitAmountZar || 0);

      return { p, chosenVariant, displayImage, imgs, idx, price, basePrice, onSale, inStock, stockLabel };
    });
  }, [products, variantChoice, imageIdx, category, query]);

  const handleBuy = async (p: Product) => {
    try {
      setBusyId(p.id);
      setError(null);

      const chosenVariantId = variantChoice[p.id];
      const chosenVariant = p.variants?.find((v) => v.id === chosenVariantId);

      const unitAmountZar = chosenVariant
        ? pickSaleOrBase(chosenVariant.unitAmountZar, chosenVariant.saleUnitAmountZar)
        : pickSaleOrBase(p.unitAmountZar, p.saleAmountZar);

      if (!unitAmountZar || unitAmountZar <= 0) throw new Error('Invalid product price');

      const origin = typeof window !== 'undefined' ? window.location.origin : '';

      const res = await fetch('/api/shop/checkout', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-uid': buyerUid,
        },
        body: JSON.stringify({
          items: [
            {
              productId: p.id,
              variantId: chosenVariant?.id,
              sku: chosenVariant?.sku,
              name: p.name,
              unitAmountZar,
              quantity: 1,
            },
          ],
          successUrl: `${origin}/shop?status=success`,
          cancelUrl: `${origin}/shop?status=cancelled`,
          metadata: {
            productType: p.type || 'merch',
            productId: p.id,
            variantId: chosenVariant?.id || null,
            buyerUid,
          },
        }),
      });

      const js = await res.json().catch(() => ({}));
      if (!res.ok || !js.checkoutUrl) throw new Error(js.error || 'Could not create checkout session');

      window.location.href = js.checkoutUrl as string;
    } catch (err: any) {
      setError(err?.message || 'Checkout failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Ambulant+ Shop</h1>
          <p className="text-xs text-gray-500">Merchandise, tech and clinic infrastructure for demos and deployments.</p>

          <div className="mt-2 flex gap-2">
            <Link href="/shop/orders" className="text-xs underline text-blue-700">
              View shop orders
            </Link>
            <span className="text-xs text-gray-300">•</span>
            <Link href="/orders" className="text-xs underline text-gray-600">
              Care orders (pharmacy/lab)
            </Link>
          </div>
        </div>

        <div className="w-full sm:w-80">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items (e.g., hoodie, pod, health monitor)..."
            className="w-full border rounded-full px-4 py-2 text-sm bg-white"
          />
        </div>
      </header>

      {usingFallback && (
        <div className="text-xs rounded-md border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2">
          Demo mode: live catalog unavailable — showing demo catalog (wired fallback).
        </div>
      )}

      {status === 'success' && (
        <div className="text-sm rounded-md border border-green-200 bg-green-50 text-green-800 px-3 py-2">
          Payment successful ✅ Your order will be processed. You can check it under{' '}
          <Link className="underline" href="/shop/orders">
            shop orders
          </Link>
          .
        </div>
      )}
      {status === 'cancelled' && (
        <div className="text-sm rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2">
          Checkout cancelled. No payment was made.
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex flex-wrap gap-2">
        {CATEGORY_PILLS.map((c) => {
          const active = c.id === category;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={[
                'text-xs px-3 py-1.5 rounded-full border transition',
                active
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300',
              ].join(' ')}
            >
              {c.label}
            </button>
          );
        })}
        <div className="ml-auto text-xs text-gray-500 flex items-center">
          {derived.length} item{derived.length === 1 ? '' : 's'}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {derived.map(({ p, chosenVariant, displayImage, imgs, idx, price, basePrice, onSale, inStock, stockLabel }) => (
          <div key={p.id} className="border rounded-xl bg-white shadow-sm flex flex-col overflow-hidden">
            <div className="bg-gray-100">
              <div className="h-48 flex items-center justify-center relative">
                {displayImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={displayImage} alt={p.name} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-gray-400">No image</span>
                )}

                <div className="absolute top-2 left-2">
                  <span
                    className={[
                      'text-[11px] px-2 py-0.5 rounded-full border',
                      inStock
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200',
                    ].join(' ')}
                  >
                    {stockLabel}
                  </span>
                </div>

                {onSale && (
                  <div className="absolute top-2 right-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200">
                      Sale
                    </span>
                  </div>
                )}
              </div>

              {imgs.length > 1 && (
                <div className="px-3 pb-3 flex items-center justify-center gap-2">
                  {imgs.slice(0, 5).map((_, i) => (
                    <button
                      key={`${p.id}-img-${i}`}
                      type="button"
                      onClick={() => setImageIdx((prev) => ({ ...prev, [p.id]: i }))}
                      aria-label={`View image ${i + 1}`}
                      className={[
                        'h-2.5 w-2.5 rounded-full border transition',
                        i === idx ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-300 hover:border-gray-500',
                      ].join(' ')}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 flex-1 flex flex-col">
              <div className="font-medium text-sm">{p.name}</div>

              {p.description && <div className="text-xs text-gray-600 mt-1 line-clamp-3">{p.description}</div>}

              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-sm text-gray-900">
                  {formatZar(price)}
                  {onSale && basePrice > price ? (
                    <span className="ml-2 text-xs text-gray-500 line-through">{formatZar(basePrice)}</span>
                  ) : null}
                </div>

                {p.tags?.length ? (
                  <div className="flex flex-wrap gap-1 justify-end">
                    {p.tags.slice(0, 2).map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {p.variants?.length ? (
                <div className="mt-3">
                  <label className="text-[11px] text-gray-600">Options</label>
                  <select
                    className="mt-1 w-full text-sm border rounded-md px-2 py-1.5 bg-white"
                    value={(variantChoice[p.id] || '') as string}
                    onChange={(e) => setVariantChoice((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  >
                    {p.variants.map((v) => {
                      const vInStock = (v.inStock ?? true) && ((v.stockQty ?? 1) > 0);
                      const suffix =
                        typeof v.stockQty === 'number'
                          ? v.stockQty <= 0
                            ? ' • sold out'
                            : ` • ${v.stockQty} left`
                          : vInStock
                          ? ''
                          : ' • sold out';

                      const vPrice = pickSaleOrBase(v.unitAmountZar, v.saleUnitAmountZar);

                      return (
                        <option key={v.id} value={v.id} disabled={!vInStock}>
                          {v.label} — {formatZar(vPrice)}
                          {suffix}
                        </option>
                      );
                    })}
                  </select>

                  {chosenVariant?.sku ? (
                    <div className="mt-1 text-[11px] text-gray-500">SKU: {chosenVariant.sku}</div>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => handleBuy(p)}
                disabled={busyId === p.id || !inStock}
                className="mt-4 inline-flex items-center justify-center px-3 py-2 rounded-full text-xs bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busyId === p.id ? 'Redirecting…' : !inStock ? 'Sold out' : 'Buy'}
              </button>

              {p.maxQtyPerOrder ? (
                <div className="mt-2 text-[11px] text-gray-500">Max {p.maxQtyPerOrder} per order</div>
              ) : null}
            </div>
          </div>
        ))}

        {derived.length === 0 && !error && (
          <div className="text-sm text-gray-500 col-span-full">No products match your filters.</div>
        )}
      </div>
    </div>
  );
}
