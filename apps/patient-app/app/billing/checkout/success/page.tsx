// file: apps/patient-app/app/billing/checkout/success/page.tsx
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Crown, Package } from 'lucide-react';
import { usePlan } from '@/components/context/PlanContext';
import { planMeta } from '@/lib/plans';

type PremiumOffer = 'bundle_40_free_year' | 'annual_premium_raffle';

const LS_LAST_CHECKOUT = 'ambulant.checkout.last';

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function CheckoutSuccessPageContent() {
  const sp = useSearchParams();
  const orderId = sp?.get('orderId') || '';
  const offer = (sp?.get('offer') || 'bundle_40_free_year') as PremiumOffer;
  const [summary, setSummary] = useState<any | null>(null);

  const {
    effectivePlan,
    entitlement,
    loading,
    refreshEntitlements,
  } = usePlan();

  useEffect(() => {
    // Non-authoritative receipt snapshot only.
    try {
      const raw = localStorage.getItem(LS_LAST_CHECKOUT);
      if (raw) setSummary(JSON.parse(raw));
    } catch {
      // Ignore malformed local presentation cache.
    }

    void refreshEntitlements();
  }, [refreshEntitlements]);

  const hasPaidAccess =
    effectivePlan === 'premium' || effectivePlan === 'family';

  const title = useMemo(() => {
    if (loading) return 'Checkout complete - checking account status';
    if (hasPaidAccess) {
      return `Checkout complete - ${planMeta(effectivePlan).name} access is active`;
    }
    return 'Checkout complete - payment verification pending';
  }, [effectivePlan, hasPaidAccess, loading]);

  const entitlementCopy = loading
    ? 'Checking your server-verified plan entitlement.'
    : hasPaidAccess
      ? `${planMeta(effectivePlan).name} access is active on your Ambulant+ account.`
      : 'No verified paid-plan entitlement was found. This browser page cannot unlock Premium or Family access.';

  const bundleCopy =
    offer === 'bundle_40_free_year'
      ? 'Bundle fulfilment is not confirmed by this browser page. It requires server-side verified order and payment evidence.'
      : 'Not applicable for this offer.';

  return (
    <main
      data-p-ui="patient-billing-checkout-success-page"
      className={cx(
        'min-h-screen bg-slate-50',
        'bg-[radial-gradient(1000px_circle_at_18%_-12%,rgba(16,185,129,0.18),transparent_58%),radial-gradient(820px_circle_at_102%_0%,rgba(99,102,241,0.16),transparent_55%),radial-gradient(900px_circle_at_55%_105%,rgba(2,132,199,0.12),transparent_52%),linear-gradient(to_bottom,rgba(255,255,255,0.88),rgba(248,250,252,1))]',
      )}
    >
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-[28px] border border-slate-200 bg-white/80 p-6 shadow-sm shadow-black/[0.06] backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black text-slate-500">Checkout status</div>
              <div className="mt-1 text-2xl font-black tracking-tight text-slate-950">{title}</div>
              <div className="mt-1 text-sm text-slate-600">
                Order: <span className="font-black text-slate-900">{orderId || '-'}</span>
              </div>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <CheckCircle2 className="h-6 w-6 text-emerald-700" />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-black text-slate-700">
                <Crown className="h-4 w-4 text-indigo-700" />
                Plan status
              </div>
              <div className="mt-2 text-[12px] text-slate-600">{entitlementCopy}</div>
              {entitlement?.endsAt ? (
                <div className="mt-2 text-[11px] text-slate-500">
                  Current entitlement ends{' '}
                  <span className="font-semibold text-slate-700">
                    {new Date(entitlement.endsAt).toLocaleDateString()}
                  </span>
                  .
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-black text-slate-700">
                <Package className="h-4 w-4 text-emerald-700" />
                Bundle order
              </div>
              <div className="mt-2 text-[12px] text-slate-600">{bundleCopy}</div>
            </div>
          </div>

          {summary ? (
            <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-black text-slate-700">Checkout snapshot</div>
              <div className="mt-1 text-[11px] text-slate-500">
                Presentation-only browser cache. It does not prove payment or plan entitlement.
              </div>
              <pre className="mt-2 overflow-auto rounded-2xl bg-slate-50 p-3 text-[11px] text-slate-700">
{JSON.stringify(
  {
    orderId: summary?.orderId,
    offer: summary?.offer,
    provider: summary?.provider,
    currency: summary?.currency,
    amountCents: summary?.amountCents,
    requiresShipping: summary?.requiresShipping,
    createdAt: summary?.createdAt,
  },
  null,
  2,
)}
              </pre>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-900 hover:bg-slate-50"
            >
              Go to dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <div className="text-[11px] text-slate-500">
              Plan access is read from your server-verified account entitlement.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <React.Suspense fallback={null}>
      <CheckoutSuccessPageContent />
    </React.Suspense>
  );
}
