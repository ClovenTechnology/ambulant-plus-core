// apps/patient-app/app/shop/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePlan } from '@/components/context/PlanContext';

type ProductVariant = {
  id: string;
  label: string;
  unitAmountZar: number; // current backend naming (major units)
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

function clampStr(s: any, max = 280) {
  const t = String(s || '');
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

function normTag(t: any) {
  return String(t || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function titleize(s: string) {
  const t = String(s || '').replace(/[_-]+/g, ' ').trim();
  if (!t) return '';
  return t
    .split(' ')
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join(' ');
}

function pickSaleOrBase(base?: number | null, sale?: number | null) {
  const s = Number(sale);
  if (Number.isFinite(s) && s > 0) return s;
  const b = Number(base);
  if (Number.isFinite(b) && b > 0) return b;
  return 0;
}

function variantInStock(v?: ProductVariant | null) {
  if (!v) return true;
  if (v.inStock === false) return false;
  if (typeof v.stockQty === 'number') return v.stockQty > 0;
  return true;
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
  // best-effort; user can override via dropdown
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
    'en-ZW': 'USD',
    'ar-AE': 'AED',
  };
  return map[lang] || 'USD';
}

function productCategory(p: Product): string {
  const t = String(p.type || '').trim();
  if (t) return titleize(t);

  const tags = (p.tags || []).map(normTag);
  if (tags.includes('duecare')) return 'DueCare';
  if (tags.includes('clinic')) return 'Clinic';
  if (tags.includes('clothing') || tags.includes('merch')) return 'Clothing';
  if (tags.includes('tech') || tags.includes('devices') || tags.includes('iomt')) return 'Tech';
  return 'Other';
}

function productTags(p: Product): string[] {
  return (p.tags || [])
    .map(normTag)
    .filter(Boolean)
    .slice(0, 12);
}

function pickPrimaryImage(p: Product, chosenVariant?: ProductVariant | null) {
  const vImg = chosenVariant?.imageUrl || '';
  if (vImg) return vImg;

  const imgs = (p.images || []).filter(Boolean);
  if (imgs.length) return imgs[0] as string;
  if (p.imageUrl) return p.imageUrl;

  // demo placeholder images (save these files to make storefront look premium)
  const cat = normTag(productCategory(p));
  if (cat.includes('duecare')) return '/shop/fallback/duecare.png';
  if (cat.includes('clinic')) return '/shop/fallback/clinic.png';
  if (cat.includes('cloth')) return '/shop/fallback/clothing.png';
  if (cat.includes('tech')) return '/shop/fallback/tech.png';
  return '/shop/fallback/other.png';
}

const LS_CCY = 'ambulant.shop.currency';

const FALLBACK_PRODUCTS: Product[] = [
  {
    id: 'demo-health-monitor',
    name: 'DueCare 6-in-1 Health Monitor',
    description: 'BP, SpO₂, temperature, glucose-ready, ECG-ready. Demo SKU for storefront fallback.',
    type: 'DueCare',
    tags: ['duecare', 'iomt', 'devices', 'clinic'],
    imageUrl: '/shop/fallback/duecare.png',
    active: true,
    variants: [
      {
        id: 'demo-health-monitor-v1',
        label: 'Standard Kit',
        unitAmountZar: 3499,
        saleUnitAmountZar: 3199,
        sku: 'DC-HM-STD',
        inStock: true,
        stockQty: 12,
        imageUrl: '/shop/fallback/duecare.png',
      },
    ],
  },
  {
    id: 'demo-nexring',
    name: 'NexRing (Wellness Ring)',
    description: 'Sleep, stress, HRV, recovery, steps. Demo SKU for storefront fallback.',
    type: 'Tech',
    tags: ['tech', 'wearable', 'wellness'],
    imageUrl: '/shop/fallback/tech.png',
    active: true,
    variants: [
      {
        id: 'demo-nexring-v1',
        label: 'Size 9',
        unitAmountZar: 1599,
        sku: 'NR-S9',
        inStock: true,
        stockQty: 40,
        imageUrl: '/shop/fallback/tech.png',
      },
      {
        id: 'demo-nexring-v2',
        label: 'Size 10',
        unitAmountZar: 1599,
        sku: 'NR-S10',
        inStock: true,
        stockQty: 22,
        imageUrl: '/shop/fallback/tech.png',
      },
    ],
  },
  {
    id: 'demo-scrubs',
    name: 'Ambulant+ Scrubs (Unisex)',
    description: 'Premium clinic scrubs. Demo SKU for storefront fallback.',
    type: 'Clothing',
    tags: ['clothing', 'merch', 'clinic'],
    imageUrl: '/shop/fallback/clothing.png',
    active: true,
    variants: [
      {
        id: 'demo-scrubs-v1',
        label: 'Black (M)',
        unitAmountZar: 699,
        sku: 'SCRUB-BLK-M',
        inStock: true,
        stockQty: 14,
        imageUrl: '/shop/fallback/clothing.png',
      },
    ],
  },
  {
    id: 'demo-pod',
    name: 'Clinic Pod (Single)',
    description: 'Soundproof consult pod for remote consults. Demo SKU for storefront fallback.',
    type: 'Clinic',
    tags: ['clinic', 'pods', 'infrastructure'],
    imageUrl: '/shop/fallback/clinic.png',
    active: true,
    variants: [
      {
        id: 'demo-pod-v1',
        label: 'Indoor',
        unitAmountZar: 89999,
        sku: 'POD-1-IND',
        inStock: true,
        stockQty: 2,
        imageUrl: '/shop/fallback/clinic.png',
      },
    ],
  },
];

export default function ShopStorefrontPage() {
  const [uid] = useState(() => getUid());

  // ✅ plan detection (no shop logic changes)
  const planCtx = usePlan() as any;
  const currentPlanKey = String(planCtx?.effectivePlan || planCtx?.plan || 'free').toLowerCase().trim();
  const isFreePlan = currentPlanKey === 'free';

  const planLabel = useMemo(() => {
    if (!currentPlanKey) return 'Free';
    // typical keys: free | premium | family
    return titleize(currentPlanKey);
  }, [currentPlanKey]);

  // data
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // storefront state
  const [q, setQ] = useState('');
  const [activeCat, setActiveCat] = useState<string>('All');
  const [activeTag, setActiveTag] = useState<string>(''); // normalized tag
  const [currency, setCurrency] = useState<string>('ZAR');

  // FX
  const [fxRate, setFxRate] = useState<number>(1);
  const [fxMeta, setFxMeta] = useState<{ asOf?: string; source?: string; derived?: boolean } | null>(null);
  const [fxErr, setFxErr] = useState<string | null>(null);

  // variant selections per product
  const [variantChoice, setVariantChoice] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  // Teaser destinations (keep plan tiers as the canonical upgrade flow)
  const backParam = useMemo(() => encodeURIComponent('/shop'), []);
  const upgradeHref = useMemo(() => `/plan/upgrade?plan=premium&cycle=monthly&back=${backParam}`, [backParam]);
  const manageHref = useMemo(() => `/plan/upgrade?back=${backParam}`, [backParam]);
  const giveawaysHref = '/raffles';

  const premiumCta = useMemo(() => {
    return isFreePlan
      ? { label: 'Upgrade', href: upgradeHref }
      : { label: 'Manage plan', href: manageHref };
  }, [isFreePlan, upgradeHref, manageHref]);

  useEffect(() => {
    // currency preference
    try {
      const saved = (localStorage.getItem(LS_CCY) || '').toUpperCase();
      const initial = saved && saved.length === 3 ? saved : guessCurrencyFromLocale();
      setCurrency(initial);
    } catch {
      setCurrency(guessCurrencyFromLocale());
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch('/api/shop/products?active=1', { cache: 'no-store' });
        const js = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(js?.error || `HTTP ${res.status}`);

        const list = Array.isArray(js?.items) ? (js.items as Product[]) : [];
        const seeded = list.length ? list : FALLBACK_PRODUCTS;

        if (!cancelled) setItems(seeded);
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message || 'Failed to load shop catalog');
          // world-class storefront never looks empty in demo:
          setItems(FALLBACK_PRODUCTS);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // default variant per product
  useEffect(() => {
    setVariantChoice((prev) => {
      const next = { ...prev };
      for (const p of items) {
        const vs = p.variants || [];
        if (!vs.length) continue;
        if (next[p.id]) continue;
        const firstInStock = vs.find((v) => variantInStock(v)) || vs[0];
        next[p.id] = firstInStock.id;
      }
      return next;
    });
  }, [items]);

  // FX fetch: prices are currently ZAR-based in your shop payload fields.
  // We display local currency by converting ZAR -> selected currency.
  useEffect(() => {
    const ccy = (currency || 'ZAR').toUpperCase();
    try {
      localStorage.setItem(LS_CCY, ccy);
    } catch {}

    if (ccy === 'ZAR') {
      setFxRate(1);
      setFxMeta({ asOf: new Date().toISOString(), source: 'local', derived: false });
      setFxErr(null);
      return;
    }

    const ac = new AbortController();
    (async () => {
      setFxErr(null);
      try {
        const url = `/api/fx/latest?base=ZAR&quotes=${encodeURIComponent(ccy)}`;
        const res = await fetch(url, { cache: 'no-store', signal: ac.signal });
        const js = (await res.json().catch(() => ({}))) as FxLatestResp;

        if (!res.ok || !js.ok) throw new Error(js?.error || `FX failed (${res.status})`);
        const rateObj = js?.rates?.[ccy];
        const r = Number(rateObj?.rate);

        if (!Number.isFinite(r) || r <= 0) throw new Error(`FX rate missing for ZAR→${ccy}`);
        setFxRate(r);
        setFxMeta({
          asOf: rateObj?.asOf || js.asOf,
          source: rateObj?.source,
          derived: rateObj?.derived,
        });
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setFxErr(e?.message || 'FX unavailable');
        setFxRate(1); // graceful fallback: show ZAR numbers but label currency
        setFxMeta(null);
      }
    })();

    return () => ac.abort();
  }, [currency]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of items) set.add(productCategory(p));
    const list = Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
    return ['All', ...list];
  }, [items]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const p of items) {
      for (const t of productTags(p)) set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const cat = activeCat;
    const tag = activeTag;

    return items.filter((p) => {
      const inCat = cat === 'All' ? true : productCategory(p) === cat;
      if (!inCat) return false;

      const tags = productTags(p);
      const inTag = tag ? tags.includes(tag) : true;
      if (!inTag) return false;

      if (!qq) return true;
      const hay = `${p.name} ${p.description || ''} ${(p.type || '')} ${(p.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [items, q, activeCat, activeTag]);

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of filtered) {
      const cat = productCategory(p);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    // stable sort inside each group
    for (const [k, list] of map.entries()) {
      map.set(k, [...list].sort((a, b) => String(a.name).localeCompare(String(b.name))));
    }
    // order groups by category list (excluding All)
    const orderedCats = categories.filter((c) => c !== 'All');
    const out: Array<{ cat: string; items: Product[] }> = [];
    for (const c of orderedCats) {
      const list = map.get(c);
      if (list && list.length) out.push({ cat: c, items: list });
    }
    // any leftovers (shouldn't happen often)
    for (const [c, list] of map.entries()) {
      if (!out.find((x) => x.cat === c)) out.push({ cat: c, items: list });
    }
    return out;
  }, [filtered, categories]);

  function priceZar(p: Product, chosenVariant?: ProductVariant | null) {
    const v = chosenVariant || null;
    if (v) return pickSaleOrBase(v.unitAmountZar, v.saleUnitAmountZar ?? null);
    const vs = p.variants || [];
    if (vs.length) {
      const first = vs.find((x) => variantInStock(x)) || vs[0];
      return pickSaleOrBase(first.unitAmountZar, first.saleUnitAmountZar ?? null);
    }
    return 0;
  }

  function priceLocal(zar: number) {
    const n = Number(zar || 0);
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
      const chosenVariantId = vs.length ? variantChoice[p.id] || '' : '';
      const chosenVariant = vs.length ? vs.find((v) => v.id === chosenVariantId) || null : null;

      if (vs.length && !chosenVariant) {
        throw new Error('Please choose an option first.');
      }

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
          cancelUrl: `${origin}/shop?status=cancelled`,
          metadata: {
            productType: p.type || 'shop',
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

  const fxLabel = useMemo(() => {
    if (currency.toUpperCase() === 'ZAR') return 'Local (ZAR)';
    if (fxErr) return 'FX unavailable (showing base)';
    const parts: string[] = [];
    if (fxMeta?.source) parts.push(String(fxMeta.source).toUpperCase());
    if (fxMeta?.derived) parts.push('DERIVED');
    if (fxMeta?.asOf) parts.push(new Date(fxMeta.asOf).toLocaleString());
    return parts.length ? parts.join(' • ') : '—';
  }, [currency, fxErr, fxMeta]);

  return (
    <div className="container mx-auto px-4 py-6 space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">1Stop Store</h1>
          <p className="text-sm text-gray-600">
            Browse devices, merch, and clinic infrastructure. Orders appear in{' '}
            <Link className="underline text-blue-600" href="/1stop">
              My 1Stop Orders
            </Link>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/1stop"
            className="inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs hover:bg-gray-50"
          >
            My 1Stop Orders
          </Link>
          <Link
            href="/DueCare"
            className="inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs hover:bg-gray-50"
          >
            DueCare
          </Link>
          <Link
            href="/orders"
            className="inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs hover:bg-gray-50"
          >
            Care Orders
          </Link>
        </div>
      </header>

      {/* Teasers (no shop logic changes; just navigation) */}
      <section className="grid gap-3 sm:grid-cols-2">
        {/* Premium / Plan tiers teaser */}
        <div className="rounded-2xl border bg-white overflow-hidden shadow-sm">
          <div className="p-5 border-b bg-gradient-to-br from-sky-50 to-white">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold">Premium access</div>
                <div className="text-xs text-gray-600">
                  Your plan is <span className="font-semibold text-gray-900">{planLabel}</span>. Plans handle upgrades,
                  billing, and entitlements — the Store stays focused on products.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="shrink-0 text-[11px] px-2 py-1 rounded-full border bg-white text-gray-700">
                  {isFreePlan ? 'Free plan' : 'Plan active'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-5 flex items-center justify-between gap-3">
            <div className="text-[11px] text-gray-600 leading-relaxed">
              {isFreePlan
                ? 'Upgrade to unlock deeper access (live clinician status, enhanced insights, and more).'
                : 'You can review features, switch cycle, or manage your plan anytime.'}
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={premiumCta.href}
                className="inline-flex items-center justify-center rounded-full px-3 py-2 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700"
              >
                {premiumCta.label}
              </Link>
              <Link
                href={manageHref}
                className="inline-flex items-center justify-center rounded-full px-3 py-2 text-xs border hover:bg-gray-50"
              >
                Compare
              </Link>
            </div>
          </div>
        </div>

        {/* Giveaways teaser */}
        <div className="rounded-2xl border bg-white overflow-hidden shadow-sm">
          <div className="p-5 border-b bg-gradient-to-br from-emerald-50 to-white">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold">Giveaways</div>
                <div className="text-xs text-gray-600">
                  Enter promotions and track your entries. Winner announcements will show here later.
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isFreePlan ? (
                  <span className="shrink-0 text-[11px] px-2 py-1 rounded-full border border-sky-200 bg-sky-50 text-sky-800 font-semibold">
                    Premium feature
                  </span>
                ) : null}
                <span className="shrink-0 text-[11px] px-2 py-1 rounded-full border bg-white text-gray-700">Free</span>
              </div>
            </div>
          </div>

          <div className="p-5 flex items-center justify-between gap-3">
            <div className="text-[11px] text-gray-600 leading-relaxed">
              {isFreePlan
                ? 'Premium members may see exclusive bonus drops when available.'
                : 'Your entries will show under “My entries” on that page.'}
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={giveawaysHref}
                className="inline-flex items-center justify-center rounded-full px-3 py-2 text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Explore
              </Link>
              <Link
                href="/1stop"
                className="inline-flex items-center justify-center rounded-full px-3 py-2 text-xs border hover:bg-gray-50"
              >
                My orders
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Controls */}
      <section className="rounded-xl border bg-white p-3 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products…"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Currency</label>
            <select
              className="border rounded-lg px-2 py-2 text-sm bg-white"
              value={currency}
              onChange={(e) => setCurrency((e.target.value || 'ZAR').toUpperCase())}
            >
              {[
                'ZAR',
                'USD',
                'NGN',
                'KES',
                'GHS',
                'BWP',
                'ZMW',
                'TZS',
                'UGX',
                'RWF',
                'ETB',
                'GBP',
                'EUR',
                'AED',
                'SAR',
                'CAD',
                'AUD',
                'BRL',
              ].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const active = c === activeCat;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveCat(c)}
                  className={[
                    'px-3 py-1.5 rounded-full text-xs border transition',
                    active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50',
                  ].join(' ')}
                >
                  {c}
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-gray-500">
            FX: <span className="font-mono">{fxLabel}</span>
          </div>
        </div>

        {allTags.length ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => setActiveTag('')}
              className={[
                'px-2.5 py-1 rounded-full text-[11px] border',
                !activeTag ? 'bg-black text-white border-black' : 'bg-white hover:bg-gray-50',
              ].join(' ')}
            >
              All tags
            </button>
            {allTags.slice(0, 24).map((t) => {
              const active = t === activeTag;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveTag(active ? '' : t)}
                  className={[
                    'px-2.5 py-1 rounded-full text-[11px] border font-mono',
                    active ? 'bg-black text-white border-black' : 'bg-white hover:bg-gray-50',
                  ].join(' ')}
                  title={t}
                >
                  {t}
                </button>
              );
            })}
          </div>
        ) : null}

        {fxErr ? (
          <div className="text-xs text-amber-700 border border-amber-200 bg-amber-50 rounded-lg px-3 py-2">
            {fxErr}. Prices may display using base values.
          </div>
        ) : null}
      </section>

      {err ? (
        <div className="text-sm text-rose-700 border border-rose-200 bg-rose-50 rounded-lg px-3 py-2">{err}</div>
      ) : null}

      {/* Catalog */}
      <section className="space-y-6">
        {loading ? (
          <div className="text-sm text-gray-600">Loading storefront…</div>
        ) : grouped.length ? (
          grouped.map((g) => (
            <div key={g.cat} className="space-y-3">
              <div className="flex items-end justify-between">
                <h2 className="text-sm font-semibold text-gray-900">{g.cat}</h2>
                <div className="text-xs text-gray-500">{g.items.length} item(s)</div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((p) => {
                  const vs = p.variants || [];
                  const chosenVariant = vs.length
                    ? vs.find((v) => v.id === variantChoice[p.id]) || vs.find((v) => variantInStock(v)) || vs[0]
                    : null;

                  const zar = priceZar(p, chosenVariant);
                  const local = priceLocal(zar);
                  const cur = currency.toUpperCase();
                  const inStock = vs.length ? variantInStock(chosenVariant) : true;

                  const img = pickPrimaryImage(p, chosenVariant);

                  return (
                    <div key={p.id} className="border rounded-xl bg-white shadow-sm overflow-hidden flex flex-col">
                      <div className="h-44 bg-gray-100 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt={p.name} className="max-h-full max-w-full object-contain" />
                      </div>

                      <div className="p-3 space-y-2 flex-1 flex flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-sm">{p.name}</div>
                          <span
                            className={[
                              'text-[11px] px-2 py-0.5 rounded-full border',
                              inStock
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-rose-50 border-rose-200 text-rose-700',
                            ].join(' ')}
                          >
                            {inStock ? 'Available' : 'Sold out'}
                          </span>
                        </div>

                        {p.description ? (
                          <div className="text-xs text-gray-600">{clampStr(p.description, 120)}</div>
                        ) : null}

                        {!!productTags(p).length ? (
                          <div className="flex flex-wrap gap-1">
                            {productTags(p)
                              .slice(0, 6)
                              .map((t) => (
                                <span
                                  key={t}
                                  className="text-[10px] px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700 font-mono"
                                >
                                  {t}
                                </span>
                              ))}
                          </div>
                        ) : null}

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
                                const vLocal = priceLocal(vZar);
                                const suffix =
                                  typeof v.stockQty === 'number'
                                    ? v.stockQty <= 0
                                      ? ' • sold out'
                                      : ` • ${v.stockQty} left`
                                    : '';

                                const localLabel =
                                  cur === 'ZAR' ? money(vZar, 'ZAR') : `${money(vLocal, cur)} (${money(vZar, 'ZAR')})`;

                                return (
                                  <option key={v.id} value={v.id} disabled={!ok}>
                                    {v.label} — {localLabel}
                                    {suffix}
                                  </option>
                                );
                              })}
                            </select>
                            {chosenVariant?.sku ? (
                              <div className="mt-1 text-[11px] text-gray-500 font-mono">SKU: {chosenVariant.sku}</div>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="flex items-center justify-between pt-1">
                          <div className="text-sm">
                            {zar ? (
                              cur === 'ZAR' ? (
                                <span className="font-semibold">{money(zar, 'ZAR')}</span>
                              ) : (
                                <div className="flex flex-col leading-tight">
                                  <span className="font-semibold">{money(local, cur)}</span>
                                  <span className="text-[11px] text-gray-500">{money(zar, 'ZAR')} base</span>
                                </div>
                              )
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                          </div>

                          <span className="text-[11px] text-gray-500 font-mono">{productCategory(p)}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleBuy(p)}
                          disabled={busyId === p.id || !inStock}
                          className="mt-2 inline-flex items-center justify-center px-3 py-2 rounded-full text-xs bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {busyId === p.id ? 'Redirecting…' : !inStock ? 'Sold out' : 'Buy now'}
                        </button>

                        <div className="text-xs text-gray-500 mt-auto">
                          Receipt appears in{' '}
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
            </div>
          ))
        ) : (
          <div className="text-sm text-gray-600">No products match your filters.</div>
        )}
      </section>
    </div>
  );
}
