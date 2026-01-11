// file: apps/patient-app/app/billing/checkout/pay/page.tsx
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, CreditCard, Landmark, ShieldCheck, XCircle } from 'lucide-react';

type Provider = 'payfast' | 'stripe' | 'eft';
type PremiumOffer = 'bundle_40_free_year' | 'annual_premium_raffle';

const LS_LAST_CHECKOUT = 'ambulant.checkout.last';

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function formatMoney(currency: string, cents: number) {
  const val = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(val);
  } catch {
    return `${currency} ${val.toFixed(2)}`;
  }
}

export default function CheckoutPayPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const orderId = sp?.get('orderId') || '';

  const [summary, setSummary] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_LAST_CHECKOUT);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setSummary(parsed);
    } catch {
      // ignore
    }
  }, []);

  const provider = (summary?.provider || 'payfast') as Provider;
  const offer = (summary?.offer || 'bundle_40_free_year') as PremiumOffer;
  const currency = (summary?.currency || 'ZAR') as string;
  const amountCents = Number(summary?.amountCents || 0);
  const requiresShipping = Boolean(summary?.requiresShipping);

  const backHref = useMemo(() => '/billing/checkout', []);

  async function confirm(status: 'success' | 'cancel') {
    if (!orderId) {
      setErr('Missing orderId.');
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/billing/checkout/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId, status, offer }),
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || data?.message || 'Could not confirm payment');
      }

      if (status === 'success') {
        router.replace(`/billing/checkout/success?orderId=${encodeURIComponent(orderId)}&offer=${encodeURIComponent(offer)}`);
      } else {
        router.replace(`/billing/checkout/cancel?orderId=${encodeURIComponent(orderId)}&offer=${encodeURIComponent(offer)}`);
      }
    } catch (e: any) {
      setErr(e?.message || 'Could not confirm payment');
    } finally {
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
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-black text-slate-800 backdrop-blur hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to checkout
        </Link>

        <div className="mt-6 rounded-[28px] border border-slate-200 bg-white/80 p-6 shadow-sm shadow-black/[0.06] backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black text-slate-500">Payment step</div>
              <div className="mt-1 text-2xl font-black tracking-tight text-slate-950">Complete payment</div>
              <div className="mt-1 text-sm text-slate-600">
                Provider: <span className="font-black text-slate-900">{provider.toUpperCase()}</span> · Order:{' '}
                <span className="font-black text-slate-900">{orderId || '—'}</span>
              </div>
            </div>

            <div className="h-12 w-12 rounded-2xl border border-slate-200 bg-white flex items-center justify-center">
              {provider === 'eft' ? (
                <Landmark className="h-5 w-5 text-slate-700" />
              ) : (
                <CreditCard className="h-5 w-5 text-emerald-700" />
              )}
            </div>
          </div>

          {err ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {err}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-black text-slate-700">Amount</div>
              <div className="mt-1 text-2xl font-black text-slate-950">{formatMoney(currency, amountCents)}</div>
              <div className="mt-2 text-[12px] text-slate-600">
                Offer: <span className="font-semibold text-slate-800">{offer}</span>
              </div>
              <div className="mt-1 text-[12px] text-slate-600">
                Shipping: <span className="font-semibold text-slate-800">{requiresShipping ? 'Included' : 'Not required'}</span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-black text-slate-700">
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                Secure
              </div>
              <div className="mt-2 text-[12px] text-slate-600">
                This screen is an internal payment step for dev/testing. When you wire PayFast/Stripe hosted checkout,
                your server will redirect there automatically.
              </div>
            </div>
          </div>

          {provider === 'eft' ? (
            <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-black text-slate-700">EFT instructions</div>
              <div className="mt-2 text-[12px] text-slate-600">
                Use your order ID as reference: <span className="font-black text-slate-900">{orderId || '—'}</span>
              </div>
              <div className="mt-3 text-[12px] text-slate-600">
                Bank details can be injected from env later. For now, click “I’ve completed EFT” to continue.
              </div>

              <button
                disabled={busy}
                onClick={() => confirm('success')}
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                I’ve completed EFT
              </button>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                disabled={busy}
                onClick={() => confirm('success')}
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Simulate successful payment
              </button>
              <button
                disabled={busy}
                onClick={() => confirm('cancel')}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancel payment
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
