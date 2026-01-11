// file: apps/patient-app/app/billing/checkout/success/page.tsx
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Crown, Package, ArrowRight } from 'lucide-react';

type PremiumOffer = 'bundle_40_free_year' | 'annual_premium_raffle';

const LS_LAST_CHECKOUT = 'ambulant.checkout.last';

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function addOneYearISO(from = new Date()) {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}

export default function CheckoutSuccessPage() {
  const sp = useSearchParams();
  const orderId = sp?.get('orderId') || '';
  const offer = (sp?.get('offer') || 'bundle_40_free_year') as PremiumOffer;

  const [summary, setSummary] = useState<any | null>(null);

  useEffect(() => {
    // 1) Load local summary for nice confirmation UI
    try {
      const raw = localStorage.getItem(LS_LAST_CHECKOUT);
      if (raw) setSummary(JSON.parse(raw));
    } catch {
      // ignore
    }

    // 2) Unlock premium locally (PlanContext uses ambulant.plan in your repo)
    try {
      localStorage.setItem('ambulant.plan', 'premium');
      localStorage.setItem('ambulant.premiumUntil', addOneYearISO());
    } catch {
      // ignore
    }

    // 3) Update local profile for UI/feature gates
    try {
      const raw = localStorage.getItem('ambulant.profile');
      const p = raw ? JSON.parse(raw) : {};
      const updated = {
        ...p,
        plan: 'premium',
        premiumUntil: addOneYearISO(),
        premiumActivatedAt: new Date().toISOString(),
      };
      localStorage.setItem('ambulant.profile', JSON.stringify(updated));
    } catch {
      // ignore
    }

    // 4) If bundle offer, store a “bundle order confirmed” record locally too
    if (offer === 'bundle_40_free_year') {
      try {
        const bundle = {
          orderId,
          confirmedAt: new Date().toISOString(),
          status: 'confirmed',
          items: ['DueCare Health Monitor', 'Digital Stethoscope', 'HD Otoscope', 'NexRing', 'Consumables pack'],
        };
        localStorage.setItem('ambulant.bundle.order', JSON.stringify(bundle));
      } catch {
        // ignore
      }
    }
  }, [offer, orderId]);

  const title = useMemo(() => {
    if (offer === 'bundle_40_free_year') return 'Payment successful — Bundle confirmed';
    return 'Payment successful — Premium unlocked';
  }, [offer]);

  return (
    <main
      className={cx(
        'min-h-screen bg-slate-50',
        'bg-[radial-gradient(1000px_circle_at_18%_-12%,rgba(16,185,129,0.18),transparent_58%),radial-gradient(820px_circle_at_102%_0%,rgba(99,102,241,0.16),transparent_55%),radial-gradient(900px_circle_at_55%_105%,rgba(2,132,199,0.12),transparent_52%),linear-gradient(to_bottom,rgba(255,255,255,0.88),rgba(248,250,252,1))]',
      )}
    >
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-[28px] border border-slate-200 bg-white/80 p-6 shadow-sm shadow-black/[0.06] backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black text-slate-500">Success</div>
              <div className="mt-1 text-2xl font-black tracking-tight text-slate-950">{title}</div>
              <div className="mt-1 text-sm text-slate-600">
                Order: <span className="font-black text-slate-900">{orderId || '—'}</span>
              </div>
            </div>
            <div className="h-12 w-12 rounded-2xl border border-slate-200 bg-white flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-700" />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-black text-slate-700">
                <Crown className="h-4 w-4 text-indigo-700" />
                Premium status
              </div>
              <div className="mt-2 text-[12px] text-slate-600">
                Premium has been unlocked on this device/account session. Your dashboard should now show Premium features.
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-black text-slate-700">
                <Package className="h-4 w-4 text-emerald-700" />
                Bundle order
              </div>
              <div className="mt-2 text-[12px] text-slate-600">
                {offer === 'bundle_40_free_year'
                  ? 'Bundle marked confirmed. Delivery steps can be managed in Orders (when you add it).'
                  : 'Not applicable for this offer.'}
              </div>
            </div>
          </div>

          {summary ? (
            <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-black text-slate-700">Receipt snapshot</div>
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
              If Premium doesn’t reflect immediately, refresh once.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
