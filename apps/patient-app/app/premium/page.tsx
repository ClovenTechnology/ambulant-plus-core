// apps/patient-app/app/premium/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type ProductVariant = {
  id: string;
  label: string;
  unitAmountZar: number; // major units
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

type CheckoutResp = { checkoutUrl?: string; error?: string };

const LS_UID = 'ambulant_uid';

function getUid() {
  if (typeof window === 'undefined') return 'server-user';
  let v = localStorage.getItem(LS_UID);
  if (!v) {
    v = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + '-u';
    localStorage.setItem(LS_UID, v);
  }
  return v;
}

function normTag(t: any) {
  return String(t || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
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

function isPremiumProduct(p: Product) {
  const name = String(p.name || '').toLowerCase();
  const type = String(p.type || '').toLowerCase();
  const slug = String(p.slug || '').toLowerCase();
  const tags = (p.tags || []).map(normTag);

  // wide match, but conservative enough
  if (tags.includes('premium') || tags.includes('membership') || tags.includes('plan')) return true;
  if (type.includes('member') || type.includes('plan')) return true;
  if (slug.includes('premium') || slug.includes('membership')) return true;
  if (name.includes('premium') || name.includes('membership')) return true;
  return false;
}

function scorePremiumVariantLabel(label: string) {
  const s = String(label || '').toLowerCase();
  // prefer explicit yearly/annual in yearly slot; monthly in monthly slot
  const isYear = s.includes('year') || s.includes('annual') || s.includes('yr') || s.includes('12');
  const isMonth = s.includes('month') || s.includes('monthly') || s.includes('mo') || s.includes('1 ');
  return { isYear, isMonth };
}

export default function PremiumLandingPage() {
  const sp = useSearchParams();
  const statusParam = (sp.get('status') || '').toLowerCase(); // cancelled
  const [uid] = useState(() => getUid());

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // catalog resolve (so we can reuse /api/shop/checkout with real product+variant ids)
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [premiumProduct, setPremiumProduct] = useState<Product | null>(null);

  // UI state
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [variantChoice, setVariantChoice] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCatalog(true);
      setErr(null);
      try {
        const res = await fetch('/api/shop/products?active=1', { cache: 'no-store' });
        const js = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(js?.error || `HTTP ${res.status}`);
        const list = Array.isArray(js?.items) ? (js.items as Product[]) : [];
        const match = list.find(isPremiumProduct) || null;
        if (!cancelled) setPremiumProduct(match);
      } catch (e: any) {
        if (!cancelled) {
          setPremiumProduct(null);
          setErr(e?.message || 'Failed to load premium options');
        }
      } finally {
        if (!cancelled) setLoadingCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const variants = useMemo(() => (premiumProduct?.variants || []).filter(Boolean), [premiumProduct]);

  const resolvedMonthly = useMemo(() => {
    const vs = variants;
    if (!vs.length) return null;
    // try to find the most "monthly" label
    return (
      vs.find((v) => scorePremiumVariantLabel(v.label).isMonth) ||
      vs.find((v) => !scorePremiumVariantLabel(v.label).isYear) ||
      vs[0] ||
      null
    );
  }, [variants]);

  const resolvedYearly = useMemo(() => {
    const vs = variants;
    if (!vs.length) return null;
    return vs.find((v) => scorePremiumVariantLabel(v.label).isYear) || null;
  }, [variants]);

  useEffect(() => {
    // set a default choice based on billing tab
    const target = billing === 'yearly' ? resolvedYearly : resolvedMonthly;
    if (target?.id) setVariantChoice(target.id);
    // if yearly tab has no yearly variant, keep current choice
  }, [billing, resolvedMonthly, resolvedYearly]);

  const chosenVariant = useMemo(() => {
    if (!variants.length) return null;
    return variants.find((v) => v.id === variantChoice) || null;
  }, [variants, variantChoice]);

  const priceZar = useMemo(() => {
    if (!chosenVariant) return 0;
    return pickSaleOrBase(chosenVariant.unitAmountZar, chosenVariant.saleUnitAmountZar ?? null);
  }, [chosenVariant]);

  const canCheckout = !!premiumProduct?.id && (!!chosenVariant?.id || variants.length === 0);

  async function startCheckout() {
    try {
      setBusy(true);
      setErr(null);

      if (!premiumProduct?.id) {
        throw new Error(
          'Premium is not available yet. Please seed a Premium/Membership product in /api/shop/products (tags: premium or membership).',
        );
      }

      if (variants.length && !chosenVariant?.id) throw new Error('Please choose a plan option first.');

      const origin = typeof window !== 'undefined' ? window.location.origin : '';

      const planKey =
        billing === 'yearly'
          ? (chosenVariant?.label || 'premium_yearly').toLowerCase().replace(/\s+/g, '_')
          : (chosenVariant?.label || 'premium_monthly').toLowerCase().replace(/\s+/g, '_');

      const res = await fetch('/api/shop/checkout', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-uid': uid,
        },
        body: JSON.stringify({
          items: [
            {
              productId: premiumProduct.id,
              variantId: variants.length ? chosenVariant?.id || null : null,
              quantity: 1,
            },
          ],
          successUrl: `${origin}/1stop?status=success`,
          cancelUrl: `${origin}/premium?status=cancelled`,
          metadata: {
            channel: 'premium',
            productType: 'membership',
            productId: premiumProduct.id,
            variantId: variants.length ? chosenVariant?.id || null : null,
            planKey,
            buyerUid: uid,
          },
        }),
      });

      const js = (await res.json().catch(() => ({}))) as CheckoutResp;
      if (!res.ok || !js.checkoutUrl) throw new Error(js?.error || 'Could not create checkout session');

      window.location.href = js.checkoutUrl;
    } catch (e: any) {
      setErr(e?.message || 'Checkout failed');
    } finally {
      setBusy(false);
    }
  }

  const perks = useMemo(
    () => [
      { k: 'Priority care routing', v: 'Faster matching to available clinicians for urgent requests.' },
      { k: 'Extended insight reports', v: 'Longer trends, richer breakdowns, more export options.' },
      { k: 'Premium support', v: 'Higher priority help when you need assistance.' },
      { k: 'Member-only drops', v: 'Early access to devices, bundles, and special offers.' },
    ],
    [],
  );

  return (
    <div className="container mx-auto px-4 py-6 space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Ambulant+ Premium</h1>
          <p className="text-sm text-gray-600">
            Upgrade your experience with deeper insights, priority routing, and premium support.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/shop" className="inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs hover:bg-gray-50">
            Shop
          </Link>
          <Link href="/1stop" className="inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs hover:bg-gray-50">
            My 1Stop Orders
          </Link>
          <Link href="/orders" className="inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs hover:bg-gray-50">
            Care Orders
          </Link>
        </div>
      </header>

      {statusParam === 'cancelled' ? (
        <div className="text-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2">
          Checkout cancelled. No payment was made.
        </div>
      ) : null}

      {err ? (
        <div className="text-sm rounded-lg border border-rose-200 bg-rose-50 text-rose-800 px-3 py-2">{err}</div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        {/* Main pitch */}
        <div className="rounded-2xl border bg-white overflow-hidden">
          <div className="p-5 border-b bg-gradient-to-br from-sky-50 to-white">
            <div className="text-sm font-semibold">Premium unlocks</div>
            <div className="text-sm text-gray-600 mt-1">
              Built for patients who want the most complete, consistent and clinician-friendly experience.
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {perks.map((p) => (
                <div key={p.k} className="rounded-xl border bg-white p-4">
                  <div className="text-sm font-medium">{p.k}</div>
                  <div className="text-xs text-gray-600 mt-1">{p.v}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border bg-gray-50 p-4">
              <div className="text-sm font-medium">Privacy-first by design</div>
              <div className="text-xs text-gray-600 mt-1">
                Your premium features are layered onto the same privacy model you already use. Receipts and payments are
                handled through the existing 1Stop checkout flow.
              </div>
            </div>
          </div>
        </div>

        {/* Checkout card */}
        <aside className="rounded-2xl border bg-white overflow-hidden">
          <div className="p-5 border-b">
            <div className="text-sm font-semibold">Choose your plan</div>
            <div className="text-xs text-gray-600 mt-1">You can manage or cancel from your account later.</div>
          </div>

          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 rounded-full border p-1 bg-gray-50">
              <button
                type="button"
                onClick={() => setBilling('monthly')}
                className={[
                  'flex-1 rounded-full px-3 py-2 text-xs font-medium transition',
                  billing === 'monthly' ? 'bg-black text-white' : 'bg-transparent text-gray-700 hover:bg-white',
                ].join(' ')}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBilling('yearly')}
                className={[
                  'flex-1 rounded-full px-3 py-2 text-xs font-medium transition',
                  billing === 'yearly' ? 'bg-black text-white' : 'bg-transparent text-gray-700 hover:bg-white',
                ].join(' ')}
              >
                Yearly
              </button>
            </div>

            {loadingCatalog ? (
              <div className="text-sm text-gray-600">Loading plan options…</div>
            ) : !premiumProduct ? (
              <div className="text-sm text-gray-700">
                Premium product not found in catalog. Seed a product with tags like{' '}
                <span className="font-mono text-xs">premium</span> or <span className="font-mono text-xs">membership</span>.
              </div>
            ) : variants.length ? (
              <div className="space-y-2">
                <label className="text-[11px] text-gray-600">Plan option</label>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
                  value={variantChoice}
                  onChange={(e) => setVariantChoice(e.target.value)}
                >
                  {variants.map((v) => {
                    const zar = pickSaleOrBase(v.unitAmountZar, v.saleUnitAmountZar ?? null);
                    return (
                      <option key={v.id} value={v.id}>
                        {v.label} — {money(zar, 'ZAR')}
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : (
              <div className="text-sm text-gray-600">This plan has no variants configured (using base product price).</div>
            )}

            <div className="rounded-xl border bg-white p-4">
              <div className="text-xs text-gray-600">Price</div>
              <div className="mt-1 flex items-end justify-between gap-3">
                <div className="text-lg font-semibold">{priceZar ? money(priceZar, 'ZAR') : '—'}</div>
                <div className="text-[11px] text-gray-500 font-mono">ZAR</div>
              </div>
              <div className="mt-2 text-[11px] text-gray-600">
                Receipt will appear in{' '}
                <Link href="/1stop" className="underline text-blue-600">
                  My 1Stop Orders
                </Link>
                .
              </div>
            </div>

            <button
              type="button"
              disabled={busy || !canCheckout}
              onClick={startCheckout}
              className="w-full rounded-full px-4 py-3 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? 'Redirecting…' : 'Go Premium'}
            </button>

            <div className="text-[11px] text-gray-500 leading-relaxed">
              By continuing, you agree to the applicable Terms and acknowledge that payments are processed via the 1Stop
              checkout flow.
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
