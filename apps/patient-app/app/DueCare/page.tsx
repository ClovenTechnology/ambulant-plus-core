// apps/patient-app/app/DueCare/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type ProductVariant = {
  id: string;
  label: string;
  unitAmountZar: number;
  saleUnitAmountZar?: number | null;
  imageUrl?: string | null;
  inStock?: boolean | null;
  stockQty?: number | null;
  sku?: string | null;
};

type Product = {
  id: string;
  slug?: string | null;
  name: string;
  description?: string | null;
  type?: string | null;
  tags?: string[] | null;
  images?: string[] | null;
  imageUrl?: string | null;
  active?: boolean | null;
  variants?: ProductVariant[] | null;
};

type FxLatestResp = {
  ok: boolean;
  base: string;
  asOf?: string;
  rates: Record<
    string,
    {
      rate: number;
      asOf?: string;
      source?: 'manual' | 'auto';
      derived?: boolean;
    }
  >;
  error?: string;
};

const LS_CCY = 'ambulant.shop.currency';

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

function pickSaleOrBase(base?: number | null, sale?: number | null) {
  const s = Number(sale);
  if (Number.isFinite(s) && s > 0) return s;
  const b = Number(base);
  if (Number.isFinite(b) && b > 0) return b;
  return 0;
}

function money(major: number, currency: string) {
  const cur = (currency || 'ZAR').toUpperCase();
  const n = Number(major || 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: n < 10 ? 2 : 0,
    }).format(n);
  } catch {
    return `${cur} ${n.toFixed(n < 10 ? 2 : 0)}`;
  }
}

function guessCurrencyFromLocale(): string {
  const lang = (typeof navigator !== 'undefined' ? navigator.language : 'en-ZA') || 'en-ZA';
  const map: Record<string, string> = {
    'en-ZA': 'ZAR',
    'en-NG': 'NGN',
    'en-GB': 'GBP',
    'en-US': 'USD',
    'en-CA': 'CAD',
    'pt-BR': 'BRL',
    'es-AR': 'ARS',
    'sw-KE': 'KES',
    'en-KE': 'KES',
    'ar-AE': 'AED',
  };
  return map[lang] || 'USD';
}

function isDueCareProduct(p: Product) {
  const t = String(p.type || '').toLowerCase();
  const tags = (p.tags || []).map((x) => String(x).toLowerCase());
  const slug = String(p.slug || '').toLowerCase();

  if (t.includes('duecare') || t.includes('iomt') || t.includes('device')) return true;
  if (tags.includes('duecare') || tags.includes('iomt') || tags.includes('device')) return true;
  if (slug.startsWith('duecare-')) return true;
  return false;
}

function variantInStock(v?: ProductVariant | null) {
  if (!v) return true;
  if (v.inStock === false) return false;
  if (typeof v.stockQty === 'number') return v.stockQty > 0;
  return true; // untracked => treat as available
}

export default function DueCarePage() {
  const sp = useSearchParams();
  const statusParam = (sp.get('status') || '').toLowerCase(); // cancelled

  const [uid] = useState(() => getUid());

  const [items, setItems] = useState<Product[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [variantChoice, setVariantChoice] = useState<Record<string, string>>({});

  // FX
  const [currency, setCurrency] = useState<string>('ZAR');
  const [fxRate, setFxRate] = useState<number>(1);
  const [fxErr, setFxErr] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = (localStorage.getItem(LS_CCY) || '').toUpperCase();
      const initial = saved && saved.length === 3 ? saved : guessCurrencyFromLocale();
      setCurrency(initial);
    } catch {
      setCurrency(guessCurrencyFromLocale());
    }
  }, []);

  useEffect(() => {
    const ccy = (currency || 'ZAR').toUpperCase();
    try {
      localStorage.setItem(LS_CCY, ccy);
    } catch {}

    if (ccy === 'ZAR') {
      setFxRate(1);
      setFxErr(null);
      return;
    }

    const ac = new AbortController();
    (async () => {
      setFxErr(null);
      try {
        const res = await fetch(`/api/fx/latest?base=ZAR&quotes=${encodeURIComponent(ccy)}`, {
          cache: 'no-store',
          signal: ac.signal,
        });
        const js = (await res.json().catch(() => ({}))) as FxLatestResp;
        if (!res.ok || !js.ok) throw new Error(js?.error || `FX failed (${res.status})`);

        const r = Number(js?.rates?.[ccy]?.rate);
        if (!Number.isFinite(r) || r <= 0) throw new Error(`Missing ZAR→${ccy} rate`);
        setFxRate(r);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setFxErr(e?.message || 'FX unavailable');
        setFxRate(1);
      }
    })();

    return () => ac.abort();
  }, [currency]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch('/api/shop/products?active=1', { cache: 'no-store' });
        const js = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(js?.error || `HTTP ${res.status}`);
        setItems(Array.isArray(js?.items) ? js.items : []);
      } catch (e: any) {
        setErr(e?.message || 'Failed to load DueCare catalog');
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const duecare = useMemo(() => items.filter(isDueCareProduct), [items]);

  useEffect(() => {
    setVariantChoice((prev) => {
      const next = { ...prev };
      for (const p of duecare) {
        const vs = p.variants || [];
        if (!vs.length) continue;
        if (next[p.id]) continue;

        const firstInStock = vs.find((v) => variantInStock(v)) || vs[0];
        next[p.id] = firstInStock.id;
      }
      return next;
    });
  }, [duecare]);

  function toLocal(zarMajor: number) {
    const n = Number(zarMajor || 0);
    const r = Number(fxRate || 1);
    if (!Number.isFinite(n) || n <= 0) return 0;
    if (!Number.isFinite(r) || r <= 0) return 0;
    return n * r;
  }

  async function handleBuy(p: Product) {
    try {
      setBusyId(p.id);
      setErr(null);

      const vs = p.variants || [];
      const chosenVariantId = vs.length ? (variantChoice[p.id] || '') : '';
      const chosenVariant = vs.length ? vs.find((v) => v.id === chosenVariantId) : null;

      if (vs.length && !chosenVariant) throw new Error('Please choose an option first.');

      const inStock = vs.length ? variantInStock(chosenVariant) : true;
      if (!inStock) throw new Error('This item is currently out of stock.');

      const origin = typeof window !== 'undefined' ? window.location.origin : '';

      const res = await fetch('/api/shop/checkout', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-uid': uid,
        },
        body: JSON.stringify({
          items: [
            {
              productId: p.id,
              variantId: chosenVariant?.id || null,
              quantity: 1,
            },
          ],
          successUrl: `${origin}/1stop?status=success`,
          cancelUrl: `${origin}/DueCare?status=cancelled`,
          metadata: {
            productType: p.type || 'duecare',
            productId: p.id,
            variantId: chosenVariant?.id || null,
            buyerUid: uid,
          },
        }),
      });

      const js = await res.json().catch(() => ({}));
      if (!res.ok || !js.checkoutUrl) throw new Error(js?.error || 'Could not create checkout session');

      window.location.href = js.checkoutUrl as string;
    } catch (e: any) {
      setErr(e?.message || 'Checkout failed');
    } finally {
      setBusyId(null);
    }
  }

  const fxBadge =
    currency.toUpperCase() === 'ZAR'
      ? 'ZAR'
      : fxErr
      ? `${currency.toUpperCase()} (FX unavailable)`
      : `${currency.toUpperCase()} (live)`;

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">DueCare</h1>
          <p className="text-sm text-gray-600">Official DueCare devices & accessories (IoMT range).</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border px-3 py-2">
            <span className="text-xs text-gray-600">Currency</span>
            <select
              className="text-xs bg-transparent outline-none"
              value={currency}
              onChange={(e) => setCurrency((e.target.value || 'ZAR').toUpperCase())}
            >
              {['ZAR','USD','NGN','KES','GHS','BWP','ZMW','TZS','UGX','RWF','ETB','GBP','EUR','AED','SAR','CAD','AUD','BRL'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <Link
            href="/shop"
            className="inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs hover:bg-gray-50"
          >
            Shop
          </Link>
          <Link
            href="/1stop"
            className="inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs hover:bg-gray-50"
          >
            My 1Stop Orders
          </Link>
          <Link
            href="/orders"
            className="inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs hover:bg-gray-50"
          >
            Care Orders
          </Link>
        </div>
      </header>

      {statusParam === 'cancelled' ? (
        <div className="text-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2">
          Checkout cancelled. No payment was made.
        </div>
      ) : null}

      {fxErr ? (
        <div className="text-xs rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2">
          {fxErr}. Prices may show using base values.
        </div>
      ) : null}

      {err ? <div className="text-sm text-red-600">{err}</div> : null}

      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-medium text-sm">Catalog</div>
          <div className="text-xs text-gray-500">
            {loading ? 'Loading…' : `${duecare.length} item(s)`} • <span className="font-mono">{fxBadge}</span>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading DueCare catalog…</div>
        ) : duecare.length === 0 ? (
          <div className="p-6 space-y-2">
            <div className="text-sm font-medium">No DueCare items yet</div>
            <div className="text-sm text-gray-600">
              Seed DueCare products by setting <span className="font-mono text-xs">type: &quot;duecare&quot;</span> or
              adding a <span className="font-mono text-xs">tags: [&quot;duecare&quot;]</span> on shop products.
            </div>
            <div className="text-sm">
              <Link className="text-blue-600 underline" href="/shop">
                Browse current shop catalog
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {duecare.map((p) => {
              const imgs = (p.images && p.images.length ? p.images : p.imageUrl ? [p.imageUrl] : []) as string[];
              const baseImg = imgs[0];

              const vs = p.variants || [];
              const chosenVariant = vs.length ? vs.find((v) => v.id === variantChoice[p.id]) || vs[0] : null;

              const zar = chosenVariant ? pickSaleOrBase(chosenVariant.unitAmountZar, chosenVariant.saleUnitAmountZar ?? null) : 0;
              const local = toLocal(zar);

              const inStock = vs.length ? variantInStock(chosenVariant) : true;
              const displayImg = chosenVariant?.imageUrl || baseImg;

              return (
                <div key={p.id} className="border rounded-xl bg-white shadow-sm overflow-hidden flex flex-col">
                  <div className="h-44 bg-gray-100 flex items-center justify-center">
                    {displayImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={displayImg} alt={p.name} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <div className="text-xs text-gray-400">No image</div>
                    )}
                  </div>

                  <div className="p-3 space-y-2 flex-1 flex flex-col">
                    <div className="font-medium text-sm">{p.name}</div>
                    {p.description ? <div className="text-xs text-gray-600 line-clamp-2">{p.description}</div> : null}

                    {vs.length ? (
                      <div className="pt-1">
                        <label className="text-[11px] text-gray-600">Options</label>
                        <select
                          className="mt-1 w-full text-sm border rounded-md px-2 py-1.5 bg-white"
                          value={variantChoice[p.id] || ''}
                          onChange={(e) => setVariantChoice((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        >
                          {vs.map((v) => {
                            const ok = variantInStock(v);
                            const vZar = pickSaleOrBase(v.unitAmountZar, v.saleUnitAmountZar ?? null);
                            const vLocal = toLocal(vZar);

                            const suffix =
                              typeof v.stockQty === 'number'
                                ? v.stockQty <= 0
                                  ? ' • sold out'
                                  : ` • ${v.stockQty} left`
                                : '';

                            const label =
                              currency.toUpperCase() === 'ZAR'
                                ? `${v.label} — ${money(vZar, 'ZAR')}${suffix}`
                                : `${v.label} — ${money(vLocal, currency)} (${money(vZar, 'ZAR')} base)${suffix}`;

                            return (
                              <option key={v.id} value={v.id} disabled={!ok}>
                                {label}
                              </option>
                            );
                          })}
                        </select>
                        {chosenVariant?.sku ? (
                          <div className="mt-1 text-[11px] text-gray-500">SKU: {chosenVariant.sku}</div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between pt-1">
                      <div className="text-sm">
                        {zar ? (
                          currency.toUpperCase() === 'ZAR' ? (
                            <span className="font-semibold">{money(zar, 'ZAR')}</span>
                          ) : (
                            <div className="flex flex-col leading-tight">
                              <span className="font-semibold">{money(local, currency)}</span>
                              <span className="text-[11px] text-gray-500">{money(zar, 'ZAR')} base</span>
                            </div>
                          )
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </div>

                      <span
                        className={[
                          'text-[11px] px-2 py-0.5 rounded-full border',
                          inStock
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-rose-50 border-rose-200 text-rose-700',
                        ].join(' ')}
                      >
                        {inStock ? 'Available' : 'Out of stock'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleBuy(p)}
                      disabled={busyId === p.id || !inStock}
                      className="mt-2 inline-flex items-center justify-center px-3 py-2 rounded-full text-xs bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {busyId === p.id ? 'Redirecting…' : !inStock ? 'Sold out' : 'Buy'}
                    </button>

                    <div className="text-xs text-gray-500 mt-auto">
                      Purchases appear in{' '}
                      <Link href="/1stop" className="underline text-blue-600">
                        My 1Stop Orders
                      </Link>
                      .
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
