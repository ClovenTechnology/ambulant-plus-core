'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BadgeCheck,
  CheckCircle2,
  Loader2,
  PackageCheck,
  ShieldCheck,
} from 'lucide-react';

type Pricing = {
  standardPriceCents: number;
  promotionalPriceCents?: number | null;
  promotionStartsAt?: string | null;
  promotionEndsAt?: string | null;
  promotionLabel?: string | null;
  promotionActive: boolean;
  effectivePriceCents: number;
  amountDueTodayCents: number;
  savingsCents: number;
};

type Pathway = {
  key: 'START_NOW_PAY_LATER' | 'QUALIFYING_DEPOSIT' | 'FULL_PAYMENT';
  displayOrder: number;
  label: string;
  badge?: string | null;
  description: string;
  ctaLabel: string;
  featured: boolean;
  conditions: string[];
  privileges: {
    trainingAccess: boolean;
    practiceActivation: boolean;
    starterKitRelease: 'none' | 'deposit' | 'full';
    platformIndemnityEligible: boolean;
    balanceRecoveryApplies: boolean;
  };
  pricing: Pricing;
};

type Offer = {
  currency: string;
  starterKitItems: string[];
  starterKitDepositItems: string[];
  signupPresentation?: {
    noticeHeading?: string;
    noticeBody?: string;
    noticeSecondary?: string;
  };
  commercialPathways: Pathway[];
};

function money(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Math.max(0, Number(cents || 0)) / 100);
  } catch {
    return `${currency} ${(Math.max(0, Number(cents || 0)) / 100).toFixed(0)}`;
  }
}

function expiry(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function kitLabel(pathway: Pathway) {
  if (pathway.privileges.starterKitRelease === 'full') return 'Full C-Med Kit';
  if (pathway.privileges.starterKitRelease === 'deposit') return 'C-Med Flex package';
  return 'No C-Med Kit required';
}

export default function CMedOptionsClient() {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/training/public-options', { cache: 'no-store' });
        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.ok || !json?.offer) {
          throw new Error('C-Med options are temporarily unavailable.');
        }
        if (!cancelled) setOffer(json.offer as Offer);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'C-Med options are temporarily unavailable.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const pathways = useMemo(
    () => (offer?.commercialPathways || []).slice().sort((a, b) => a.displayOrder - b.displayOrder),
    [offer?.commercialPathways],
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-7 text-white shadow-xl sm:p-10">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Ambulant+ Clinicians</div>
          <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">C-Med Kit & flexible options</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
            Training is required, but purchasing a C-Med Kit is optional. Compare the direct R0 pathway with the current C-Med offers published by Ambulant+ Admin.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/auth/signup" className="rounded-xl bg-white px-5 py-3 text-sm font-black text-indigo-950">Apply to join Ambulant+</Link>
            <Link href="/auth/login?next=%2Ftraining%2Fschedule" className="rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-black text-white">Sign in & continue</Link>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">{error}</div>
        ) : null}

        {!offer && !error ? (
          <div className="mt-8 flex items-center gap-2 rounded-2xl border bg-white p-5 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading current options…
          </div>
        ) : null}

        {offer ? (
          <>
            <section className="mt-10" aria-labelledby="continue-heading">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">Current published offer</div>
              <h2 id="continue-heading" className="mt-1 text-2xl font-black sm:text-3xl">Choose how you'd like to continue</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">The direct training pathway does not require payment. C-Med Flex and C-Med Full are optional equipment-and-benefit upgrades.</p>

              <div className="mt-6 grid gap-5 lg:grid-cols-3">
                {pathways.map((pathway) => {
                  const pricing = pathway.pricing;
                  const direct = pathway.key === 'START_NOW_PAY_LATER';
                  return (
                    <article key={pathway.key} className={`flex h-full flex-col rounded-3xl border bg-white p-6 shadow-sm ${pathway.featured ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Option {pathway.displayOrder}</div>
                          <h3 className="mt-1 text-xl font-black">{pathway.label}</h3>
                        </div>
                        {pathway.badge ? <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black text-indigo-800">{pathway.badge}</span> : null}
                      </div>

                      <div className="mt-5">
                        {direct ? (
                          <div className="text-3xl font-black text-emerald-700">R0 upfront</div>
                        ) : (
                          <>
                            {pricing.promotionActive && pricing.standardPriceCents > pricing.effectivePriceCents ? (
                              <div className="text-sm font-bold text-slate-400 line-through">{money(pricing.standardPriceCents, offer.currency)}</div>
                            ) : null}
                            <div className="text-3xl font-black">{money(pricing.effectivePriceCents, offer.currency)}</div>
                            {pricing.promotionActive && pricing.savingsCents > 0 ? (
                              <div className="mt-1 text-sm font-black text-emerald-700">Save {money(pricing.savingsCents, offer.currency)}</div>
                            ) : null}
                            {pathway.key === 'QUALIFYING_DEPOSIT' && pricing.amountDueTodayCents > 0 ? (
                              <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-black text-amber-900">{money(pricing.amountDueTodayCents, offer.currency)} due today</div>
                            ) : null}
                            {pricing.promotionActive && pricing.promotionEndsAt ? (
                              <div className="mt-2 text-xs font-semibold text-slate-500">{pricing.promotionLabel || 'Promotional offer'} · Ends {expiry(pricing.promotionEndsAt)}</div>
                            ) : null}
                          </>
                        )}
                      </div>

                      <p className="mt-4 text-sm leading-7 text-slate-600">{pathway.description}</p>

                      <div className="mt-5 space-y-2 rounded-2xl border bg-slate-50 p-4 text-xs text-slate-700">
                        <div className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> Required training access</div>
                        <div className="flex gap-2"><PackageCheck className="h-4 w-4 shrink-0 text-indigo-600" /> {kitLabel(pathway)}</div>
                        {pathway.privileges.platformIndemnityEligible ? (
                          <div className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-indigo-600" /> PI / Medical Malpractice cover eligibility</div>
                        ) : null}
                      </div>

                      {pathway.conditions?.length ? (
                        <ul className="mt-5 flex-1 space-y-2 text-xs leading-6 text-slate-600">
                          {pathway.conditions.map((condition, index) => (
                            <li key={index} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />{condition}</li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
              <div className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 h-5 w-5 text-emerald-700" />
                <div>
                  <h2 className="font-black text-emerald-950">Professional Indemnity / Medical Malpractice cover</h2>
                  <p className="mt-2 text-sm leading-7 text-emerald-900">Qualifying C-Med options include access to Ambulant+'s platform-wide Professional Indemnity / Medical Malpractice cover, subject to eligibility and the applicable published policy terms.</p>
                </div>
              </div>
            </section>

            {offer.starterKitItems?.length ? (
              <section className="mt-8 rounded-3xl border bg-white p-6 shadow-sm">
                <h2 className="text-xl font-black">Contactless Medicine Kit</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">The current C-Med contents are maintained by Ambulant+ Admin. Package release depends on the C-Med option selected.</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {offer.starterKitItems.map((item) => (
                    <div key={item} className="flex gap-2 rounded-xl border bg-slate-50 p-3 text-sm"><CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600" />{item}</div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
