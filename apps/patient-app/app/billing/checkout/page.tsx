// apps/patient-app/app/billing/checkout/page.tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  CheckCircle2,
  CreditCard,
  Landmark,
  Package,
  ShieldCheck,
  Trophy,
} from 'lucide-react';

type Provider = 'payfast' | 'stripe' | 'eft';
type PremiumOffer = 'bundle_40_free_year' | 'annual_premium_raffle';

const LS_LAST_CHECKOUT = 'ambulant.checkout.last';

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function formatMoney(currency: string, cents: number) {
  const val = (cents || 0) / 100;

  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency,
    }).format(val);
  } catch {
    return `${currency} ${val.toFixed(2)}`;
  }
}

function makeOrderId() {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  return `bill_${Date.now().toString(36)}_${suffix}`;
}

function offerAmountCents(offer: PremiumOffer) {
  switch (offer) {
    case 'annual_premium_raffle':
      return 12_000;
    case 'bundle_40_free_year':
    default:
      return 26_500;
  }
}

function offerTitle(offer: PremiumOffer) {
  switch (offer) {
    case 'annual_premium_raffle':
      return 'Annual Premium Plan';
    case 'bundle_40_free_year':
    default:
      return 'DueCare IoMT Bundle + 1 Year Premium';
  }
}

function offerDescription(offer: PremiumOffer) {
  switch (offer) {
    case 'annual_premium_raffle':
      return 'Unlock Premium access for one year and enter the promotional bundle draw.';
    case 'bundle_40_free_year':
    default:
      return 'Confirm the DueCare bundle purchase and unlock one year of Premium access.';
  }
}

export default function BillingCheckoutPage() {
  const router = useRouter();

  const [offer, setOffer] = useState<PremiumOffer>('bundle_40_free_year');
  const [provider, setProvider] = useState<Provider>('payfast');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const currency = 'ZAR';
  const amountCents = useMemo(() => offerAmountCents(offer), [offer]);
  const requiresShipping = offer === 'bundle_40_free_year';

  function continueToPayment() {
    setBusy(true);
    setErr(null);

    try {
      const orderId = makeOrderId();

      const summary = {
        orderId,
        offer,
        provider,
        currency,
        amountCents,
        requiresShipping,
        createdAt: new Date().toISOString(),
      };

      localStorage.setItem(LS_LAST_CHECKOUT, JSON.stringify(summary));

      router.push(
        `/billing/checkout/pay?orderId=${encodeURIComponent(orderId)}&offer=${encodeURIComponent(
          offer,
        )}`,
      );
    } catch (error) {
      setErr(
        error instanceof Error
          ? error.message
          : 'Could not prepare checkout. Please try again.',
      );
      setBusy(false);
    }
  }

  return (
    <main
      className={cx(
        'min-h-screen bg-slate-50',
        'bg-[radial-gradient(1000px_circle_at_18%_-12%,rgba(16,185,129,0.18),transparent_58%),radial-gradient(820px_circle_at_102%_0%,rgba(99,102,241,0.16),transparent_55%),radial-gradient(900px_circle_at_55%_105%,rgba(2,132,199,0.12),transparent_52%),linear-gradient(to_bottom,rgba(255,255,255,0.88),rgba(248,250,252,1))]',
      )}
    >
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link
          href="/premium"
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-black text-slate-800 backdrop-blur hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Premium
        </Link>

        <div className="mt-6 rounded-[28px] border border-slate-200 bg-white/80 p-6 shadow-sm shadow-black/[0.06] backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                Billing checkout
              </div>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
                Choose your checkout option
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Select the offer and payment method. The next screen completes the payment step.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
              <ShieldCheck className="mr-1 inline h-4 w-4" />
              Secure checkout flow
            </div>
          </div>

          {err ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {err}
            </div>
          ) : null}

          <section className="mt-6 grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setOffer('bundle_40_free_year')}
              className={cx(
                'rounded-3xl border bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md',
                offer === 'bundle_40_free_year'
                  ? 'border-emerald-400 ring-2 ring-emerald-100'
                  : 'border-slate-200',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-black text-emerald-700">
                    <Package className="h-4 w-4" />
                    Bundle offer
                  </div>
                  <h2 className="mt-2 text-lg font-black text-slate-950">
                    DueCare IoMT Bundle + Premium
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Health Monitor, Digital Stethoscope, HD Otoscope, NexRing, consumables pack, and one year Premium.
                  </p>
                </div>
                {offer === 'bundle_40_free_year' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                ) : null}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setOffer('annual_premium_raffle')}
              className={cx(
                'rounded-3xl border bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md',
                offer === 'annual_premium_raffle'
                  ? 'border-indigo-400 ring-2 ring-indigo-100'
                  : 'border-slate-200',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-black text-indigo-700">
                    <Trophy className="h-4 w-4" />
                    Annual Premium
                  </div>
                  <h2 className="mt-2 text-lg font-black text-slate-950">
                    Annual Premium + Prize Draw
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Unlock Premium for one year and stand a chance to win device-bundle benefits.
                  </p>
                </div>
                {offer === 'annual_premium_raffle' ? (
                  <CheckCircle2 className="h-5 w-5 text-indigo-700" />
                ) : null}
              </div>
            </button>
          </section>

          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">
              Payment method
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                {
                  key: 'payfast' as const,
                  label: 'PayFast',
                  icon: CreditCard,
                },
                {
                  key: 'stripe' as const,
                  label: 'Stripe',
                  icon: CreditCard,
                },
                {
                  key: 'eft' as const,
                  label: 'EFT',
                  icon: Landmark,
                },
              ].map((item) => {
                const Icon = item.icon;
                const active = provider === item.key;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setProvider(item.key)}
                    className={cx(
                      'flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-extrabold transition',
                      active
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-black text-slate-700">
                  <BadgePercent className="h-4 w-4 text-emerald-700" />
                  Checkout summary
                </div>
                <div className="mt-2 text-lg font-black text-slate-950">
                  {offerTitle(offer)}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {offerDescription(offer)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Shipping: {requiresShipping ? 'Required for bundle delivery' : 'Not required'}
                </div>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Amount
                </div>
                <div className="mt-1 text-3xl font-black text-slate-950">
                  {formatMoney(currency, amountCents)}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={continueToPayment}
              className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue to payment
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}