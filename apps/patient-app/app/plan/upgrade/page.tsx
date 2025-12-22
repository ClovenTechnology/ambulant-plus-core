// apps/patient-app/app/plan/upgrade/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Plan } from '../../../lib/plans';
import { PATIENT_PLANS, planMeta } from '../../../lib/plans';
import { usePlan } from '../../../components/context/PlanContext';
import RedeemCodeModal from '../../../components/plan/RedeemCodeModal';
import { applyRedemption, loadEntitlements, pruneExpired } from '../../../lib/entitlements';

type CheckoutResp = { ok: boolean; checkoutUrl?: string; error?: string };

type BillingPeriod = 'monthly' | 'annual';
type FeatureGroupKey = 'Core' | 'Care' | 'Insights' | 'Devices' | 'Family';

const ANNUAL_MONTHS_FREE = 2; // “2 months free”

function annualPriceFromMonthly(monthly: number) {
  const payMonths = Math.max(1, 12 - ANNUAL_MONTHS_FREE);
  return monthly * payMonths;
}
function pctOffAnnual() {
  const payMonths = Math.max(1, 12 - ANNUAL_MONTHS_FREE);
  return Math.round(((12 - payMonths) / 12) * 100);
}
function formatZar(n: number) {
  const s = Math.round(n).toString();
  const spaced = s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `R${spaced}`;
}

function effectiveBullets(planKey: Plan, baseBullets: string[]) {
  const bullets = [...(baseBullets || [])];

  const isFree = planKey === 'free';
  const isPremium = planKey === 'premium';
  const isFamily = planKey === 'family';

  if (isPremium || isFamily) {
    bullets.push('See clinicians online at a glance (live Online / Offline status).');
    bullets.push('Book in-person visits at practices (where available).');
    bullets.push('Direct booking with practices & care teams (not just individual clinicians).');
  } else if (isFree) {
    bullets.push('Upgrade to see live clinician status and book in-person visits.');
  }

  if (isFamily) {
    bullets.push('Family sharing for care coordination (add loved ones and manage together).');
    bullets.push('Household access designed for real care journeys, not just one-off visits.');
  }

  return bullets;
}

function classifyFeature(text: string): FeatureGroupKey {
  const s = String(text || '').toLowerCase();
  const has = (...parts: string[]) => parts.some((p) => s.includes(p));

  if (has('family', 'depend', 'member', 'caregiver', 'loved one', 'household', 'sharing', 'share')) return 'Family';
  if (has('insight', 'ai', 'analytics', 'analysis', 'trend', 'report', 'export', 'history', 'score', 'readiness'))
    return 'Insights';
  if (
    has(
      'consult',
      'appointment',
      'doctor',
      'clinician',
      'online',
      'offline',
      'status',
      'practice',
      'team',
      'in-person',
      'tele',
      'video',
      'chat',
      'rx',
      'prescription',
      'lab',
      'booking',
      'book'
    )
  )
    return 'Care';
  if (has('device', 'iomt', 'ring', 'monitor', 'wearable', 'integration', 'google fit', 'samsung', 'apple health'))
    return 'Devices';
  return 'Core';
}

function groupFeatures(bullets: string[]) {
  const groups: Record<FeatureGroupKey, string[]> = { Core: [], Care: [], Insights: [], Devices: [], Family: [] };
  for (const b of bullets || []) groups[classifyFeature(b)].push(b);

  const ordered: FeatureGroupKey[] = ['Core', 'Care', 'Insights', 'Devices', 'Family'];
  return ordered.map((k) => ({ key: k, items: groups[k] })).filter((g) => g.items.length > 0);
}

function normFeature(s: string) {
  return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export default function UpgradePlanPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { plan, effectivePlan, setPlan, refreshEntitlements } = usePlan() as any;

  const planKeys = useMemo(() => PATIENT_PLANS.map((p) => p.key), []);
  const defaultPick = (planKeys.includes('premium' as Plan) ? ('premium' as Plan) : (planKeys[0] as Plan)) || 'free';

  const rawInitial = (sp.get('plan') as Plan) || defaultPick;
  const initialPlan = planKeys.includes(rawInitial) ? rawInitial : defaultPick;

  const initialCycle = (sp.get('cycle') || sp.get('billing') || '').toLowerCase().trim();
  const initialBilling: BillingPeriod = initialCycle === 'annual' ? 'annual' : 'monthly';

  const [selected, setSelected] = useState<Plan>(initialPlan);
  const [billing, setBilling] = useState<BillingPeriod>(initialBilling);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);

  const status = sp.get('status'); // success/cancel (mock)
  const paidPlan = sp.get('paidPlan') as Plan | null;
  const tx = sp.get('tx') ?? '';
  const back = sp.get('back') ?? '';
  const cycleFromReturn = (sp.get('cycle') || '').toLowerCase().trim() === 'annual' ? 'annual' : 'monthly';

  const currentMeta = useMemo(() => planMeta(plan), [plan]);
  const selectedMeta = useMemo(() => planMeta(selected), [selected]);

  const mostPopularKey = useMemo<Plan | null>(() => {
    if (PATIENT_PLANS.some((p) => p.key === 'premium')) return 'premium';
    const sorted = [...PATIENT_PLANS].sort((a, b) => (b.priceMonthlyZar ?? 0) - (a.priceMonthlyZar ?? 0));
    const pick = sorted.find((p) => p.key !== 'free');
    return (pick?.key as Plan) ?? null;
  }, []);

  // Payment confirm
  useEffect(() => {
    if (status !== 'success' || !paidPlan) return;

    let cancelled = false;
    (async () => {
      setBusy(true);
      setMsg('Finishing up… securing your new plan and syncing your access.');

      const res = await fetch('/api/plan/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: paidPlan, tx, cycle: cycleFromReturn }),
      }).catch(() => null);

      const data = (await res?.json().catch(() => null)) as any;

      if (cancelled) return;

      if (!res?.ok || !data?.ok) {
        setMsg('We couldn’t confirm that payment. Nothing changed — please try again.');
        setBusy(false);
        return;
      }

      setPlan(paidPlan);
      try {
        refreshEntitlements?.();
      } catch {}

      setMsg(`You’re in. ${planMeta(paidPlan).name} is now active. Redirecting…`);

      setTimeout(() => {
        if (back) router.push(back);
        else router.push('/vitals');
      }, 650);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, paidPlan, tx, cycleFromReturn]);

  async function startCheckout() {
    setMsg(null);
    setBusy(true);

    // ✅ IMPORTANT: backend expects `cycle`. We also send `billing` for backwards tolerance.
    const cycle = billing;

    const resp = await fetch('/api/plan/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        plan: selected,
        cycle,
        billing,
        back: back || '/vitals',
      }),
    }).catch(() => null);

    const data = (await resp?.json().catch(() => null)) as CheckoutResp | null;

    if (!resp?.ok || !data?.ok || !data.checkoutUrl) {
      setMsg(data?.error || 'Checkout couldn’t start. Please try again.');
      setBusy(false);
      return;
    }

    window.location.href = data.checkoutUrl;
  }

  function onRedeemedServer(data: {
    redeemed: { plan: 'premium' | 'family'; days: number; label: string };
    effect: 'upgraded' | 'credit_saved';
    message: string;
    allowShopSpend?: boolean;
  }) {
    // Apply entitlements locally (demo): Family+Premium => credit
    const result = applyRedemption({
      basePlan: plan,
      redeemedPlan: data.redeemed.plan,
      days: data.redeemed.days,
      source: 'promo',
    });

    // If it truly upgraded, reflect base plan immediately for feature gating
    if (data.effect === 'upgraded') {
      const next = data.redeemed.plan === 'family' ? ('family' as Plan) : ('premium' as Plan);
      setPlan(next);
      if (data.redeemed.plan === 'family') setSelected('family');
      if (data.redeemed.plan === 'premium') setSelected((prev) => (prev === 'family' ? prev : 'premium'));
    }

    try {
      refreshEntitlements?.();
    } catch {}

    // After applying, compute remaining credit and surface it in the message.
    const s = pruneExpired(loadEntitlements());
    const prem = s.credits?.premiumDays ?? 0;
    const fam = s.credits?.familyDays ?? 0;

    const creditLine =
      prem > 0 || fam > 0
        ? ` Remaining credit — Premium: ${prem} days, Family: ${fam} days.`
        : '';

    // Prefer server message (world-class copy), but still respect local computed rule message.
    const primary = data.message || result.message;
    const shopLine =
      (data.allowShopSpend ?? true) && (prem > 0 || fam > 0)
        ? ' You can also use credit in the Shop.'
        : '';

    setMsg(primary + creditLine + shopLine);
  }

  const annualSavePct = useMemo(() => pctOffAnnual(), []);
  const canCheckout = !busy && selected !== 'free' && selected !== plan;

  const entitlementSummary = useMemo(() => {
    const s = pruneExpired(loadEntitlements());
    const premiumCredit = s.credits?.premiumDays ?? 0;
    const familyCredit = s.credits?.familyDays ?? 0;
    const active = s.active && s.active.endsAtISO ? s.active : null;
    return { premiumCredit, familyCredit, active };
  }, [effectivePlan, plan, msg]);

  const planCards = useMemo(() => {
    return PATIENT_PLANS.map((p) => {
      const active = p.key === selected;
      const isCurrent = p.key === plan;
      const isPopular = mostPopularKey ? p.key === mostPopularKey : false;

      const bullets = effectiveBullets(p.key as Plan, p.bullets || []);
      const grouped = groupFeatures(bullets);

      const cardGroups = grouped.slice(0, 2).map((g) => ({ ...g, items: g.items.slice(0, 2) }));
      const shownCount = cardGroups.reduce((a, g) => a + g.items.length, 0);
      const extraCount = Math.max(0, bullets.length - shownCount);

      const monthly = p.priceMonthlyZar ?? 0;
      const annual = monthly === 0 ? 0 : annualPriceFromMonthly(monthly);
      const annualEffective = monthly === 0 ? 0 : Math.round(annual / 12);

      return { p, active, isCurrent, isPopular, cardGroups, extraCount, monthly, annual, annualEffective };
    });
  }, [selected, plan, mostPopularKey]);

  const compareModel = useMemo(() => {
    const byPlan = new Map<Plan, Set<string>>();
    for (const p of PATIENT_PLANS) {
      const bullets = effectiveBullets(p.key as Plan, p.bullets || []);
      byPlan.set(p.key as Plan, new Set(bullets.map(normFeature)));
    }

    const all = new Map<FeatureGroupKey, { label: string; key: string }[]>();
    const ordered: FeatureGroupKey[] = ['Core', 'Care', 'Insights', 'Devices', 'Family'];
    for (const k of ordered) all.set(k, []);

    const seen = new Set<string>();
    for (const p of PATIENT_PLANS) {
      const bullets = effectiveBullets(p.key as Plan, p.bullets || []);
      for (const raw of bullets) {
        const key = normFeature(raw);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        all.get(classifyFeature(raw))!.push({ label: raw, key });
      }
    }

    for (const [k, arr] of all.entries()) {
      arr.sort((a, b) => a.label.localeCompare(b.label));
      all.set(k, arr);
    }

    return { all, byPlan, ordered };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <RedeemCodeModal
        open={redeemOpen}
        onClose={() => setRedeemOpen(false)}
        currentPlan={plan}
        onRedeemed={(data) => {
          onRedeemedServer({
            redeemed: data.redeemed,
            effect: data.effect,
            message: data.message,
            allowShopSpend: data.allowShopSpend,
          });
        }}
      />

      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="text-[28px] leading-[1.15] font-semibold tracking-tight">Plans that fit real life</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              Upgrade when you want deeper access — like live clinician status and practice bookings. You’re currently on{' '}
              <span className="font-semibold text-slate-900">{currentMeta.name}</span>
              {effectivePlan !== plan ? (
                <span className="text-slate-500">
                  {' '}
                  (temporary access: <span className="font-semibold">{planMeta(effectivePlan).name}</span>)
                </span>
              ) : null}
              .
            </div>

            <div className="mt-5 flex items-center gap-3 flex-wrap">
              {/* Billing toggle */}
              <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setBilling('monthly')}
                  className={[
                    'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                    billing === 'monthly' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBilling('annual')}
                  className={[
                    'rounded-full px-3 py-1.5 text-xs font-semibold transition flex items-center gap-2',
                    billing === 'annual' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  Annual
                  <span
                    className={[
                      'text-[10px] font-extrabold px-2 py-0.5 rounded-full',
                      billing === 'annual'
                        ? 'bg-white/15 text-white'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200',
                    ].join(' ')}
                  >
                    Save {annualSavePct}%
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowCompare((v) => !v)}
                className="text-xs font-medium text-slate-700 hover:text-slate-900 underline underline-offset-4 decoration-slate-300"
              >
                {showCompare ? 'Hide comparison' : 'Compare plans'}
              </button>

              <button
                type="button"
                onClick={() => setRedeemOpen(true)}
                className="text-xs font-semibold text-slate-900 hover:text-slate-700 underline underline-offset-4 decoration-slate-300"
              >
                Redeem a code
              </button>
            </div>
          </div>

          <button
            onClick={() => router.back()}
            className="rounded-xl px-3 py-2 text-sm bg-white hover:bg-slate-50 border border-slate-200 shadow-sm"
          >
            Back
          </button>
        </div>

        {/* Status */}
        {msg ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            {msg}{' '}
            {(entitlementSummary.premiumCredit > 0 || entitlementSummary.familyCredit > 0) ? (
              <Link
                href="/shop?useCredits=1"
                className="ml-1 font-semibold text-sky-700 hover:text-sky-600 underline underline-offset-4 decoration-sky-200"
              >
                Use in Shop
              </Link>
            ) : null}
          </div>
        ) : null}

        {/* Credits / entitlements hint */}
        {(entitlementSummary.active || entitlementSummary.premiumCredit > 0 || entitlementSummary.familyCredit > 0) ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            <div className="font-semibold text-slate-900">Your extras</div>
            <div className="mt-1 text-sm text-slate-600">
              {entitlementSummary.active ? (
                <div>
                  Temporary access:{' '}
                  <span className="font-semibold">{planMeta(entitlementSummary.active.plan).name}</span> until{' '}
                  <span className="font-semibold">
                    {new Date(entitlementSummary.active.endsAtISO).toLocaleDateString()}
                  </span>
                  .
                </div>
              ) : null}

              {(entitlementSummary.premiumCredit > 0 || entitlementSummary.familyCredit > 0) ? (
                <div className="mt-1">
                  Credit balance:{' '}
                  <span className="font-semibold">{entitlementSummary.premiumCredit}</span> Premium days ·{' '}
                  <span className="font-semibold">{entitlementSummary.familyCredit}</span> Family days.{' '}
                  <span className="text-slate-500">Family + Premium redemption becomes saved Premium credit.</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {planCards.map(({ p, active, isCurrent, isPopular, cardGroups, extraCount, monthly, annual, annualEffective }) => {
            const isFree = p.key === 'free';

            return (
              <button
                key={p.key}
                onClick={() => setSelected(p.key)}
                disabled={busy}
                className={[
                  'relative text-left rounded-3xl border transition shadow-sm',
                  'bg-white hover:bg-slate-50',
                  'p-6',
                  active ? 'border-sky-400 ring-2 ring-sky-100' : 'border-slate-200',
                  isPopular && !active ? 'shadow-[0_10px_30px_rgba(2,6,23,0.08)]' : '',
                  busy ? 'opacity-80 cursor-not-allowed' : '',
                ].join(' ')}
              >
                <div className="absolute -top-3 left-6 flex items-center gap-2">
                  {isPopular ? (
                    <span className="inline-flex items-center rounded-full bg-sky-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
                      Most popular
                    </span>
                  ) : null}
                  {!isFree && billing === 'annual' ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
                      {ANNUAL_MONTHS_FREE} months free
                    </span>
                  ) : null}
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold tracking-tight text-slate-900">{p.name}</div>
                    <div className="mt-1 text-sm text-slate-600">{p.tagline}</div>
                  </div>

                  <span className="shrink-0 text-[10px] px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                    {p.badge}
                  </span>
                </div>

                <div className="mt-5">
                  {isFree ? (
                    <div className="text-[34px] leading-none font-semibold tracking-tight text-slate-900 tabular-nums">
                      {formatZar(0)}
                      <span className="ml-1 text-sm font-medium text-slate-500">/mo</span>
                    </div>
                  ) : billing === 'monthly' ? (
                    <>
                      <div className="text-[34px] leading-none font-semibold tracking-tight text-slate-900 tabular-nums">
                        {formatZar(monthly)}
                        <span className="ml-1 text-sm font-medium text-slate-500">/mo</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">Flexible month-to-month.</div>
                    </>
                  ) : (
                    <>
                      <div className="text-[34px] leading-none font-semibold tracking-tight text-slate-900 tabular-nums">
                        {formatZar(annual)}
                        <span className="ml-1 text-sm font-medium text-slate-500">/yr</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500 tabular-nums">
                        About <span className="font-semibold text-slate-700">{formatZar(annualEffective)}</span>/month.
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-5 space-y-4">
                  {cardGroups.map((g) => (
                    <div key={g.key}>
                      <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{g.key}</div>
                      <ul className="mt-2 space-y-2 text-sm text-slate-700">
                        {g.items.map((b, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-slate-400/80" />
                            <span className="leading-5">{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {extraCount > 0 ? <div className="text-xs text-slate-500">+{extraCount} more in comparison</div> : null}
                </div>

                <div className="mt-6 flex items-center justify-between">
                  {isCurrent ? (
                    <div className="text-xs font-medium text-emerald-700">Current plan</div>
                  ) : (
                    <div className="text-xs text-slate-500">{active ? 'Selected' : 'Tap to select'}</div>
                  )}
                  <div className={['text-xs font-medium', active ? 'text-sky-700' : 'text-slate-600'].join(' ')}>
                    {active ? '✓' : ''}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom actions */}
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm text-slate-600">Selected plan</div>
              <div className="mt-1 text-lg font-semibold tracking-tight text-slate-900">{selectedMeta.name}</div>
              <div className="mt-1 text-sm text-slate-600">
                {billing === 'annual'
                  ? `Annual billing gives you ${ANNUAL_MONTHS_FREE} months free — best value for long-term care.`
                  : 'Monthly billing stays flexible — switch anytime.'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCompare(true)}
                className="rounded-xl px-4 py-2 text-sm bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800"
              >
                Compare
              </button>

              <button
                onClick={startCheckout}
                disabled={!canCheckout}
                className="rounded-xl px-4 py-2 text-sm text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {busy
                  ? 'Working…'
                  : selected === plan
                    ? 'Already on this plan'
                    : selected === 'free'
                      ? 'Choose Premium or Family'
                      : billing === 'annual'
                        ? 'Continue — Annual'
                        : 'Continue — Monthly'}
              </button>
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-500">
            Test checkout redirects back with <code className="text-slate-700">status=success</code>.
          </div>
        </div>

        {/* Comparison */}
        {showCompare ? (
          <div className="mt-10">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <div className="text-lg font-semibold tracking-tight text-slate-900">Compare plans</div>
                <div className="mt-1 text-sm text-slate-600">
                  Built from plan feature lists. Later we can swap this to a strict feature-flag matrix for perfect accuracy.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCompare(false)}
                className="text-sm font-medium text-slate-700 hover:text-slate-900 underline underline-offset-4 decoration-slate-300"
              >
                Close
              </button>
            </div>

            <div className="mt-5 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-[780px] w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left text-xs font-semibold tracking-wide text-slate-600 px-5 py-4 w-[44%]">
                        What you get
                      </th>
                      {PATIENT_PLANS.map((p) => {
                        const isPopular = mostPopularKey ? p.key === mostPopularKey : false;
                        const isSel = p.key === selected;
                        const isCur = p.key === plan;
                        return (
                          <th key={p.key} className="text-left px-5 py-4">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-semibold text-slate-900">{p.name}</div>
                              {isPopular ? (
                                <span className="text-[10px] px-2 py-1 rounded-full bg-sky-600 text-white font-semibold">
                                  Popular
                                </span>
                              ) : null}
                              {isCur ? (
                                <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                                  Current
                                </span>
                              ) : null}
                              {isSel && !isCur ? (
                                <span className="text-[10px] px-2 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200 font-semibold">
                                  Selected
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 text-xs text-slate-500 tabular-nums">
                              {p.priceMonthlyZar === 0
                                ? 'R0/mo'
                                : billing === 'monthly'
                                  ? `${formatZar(p.priceMonthlyZar)}/mo`
                                  : `${formatZar(annualPriceFromMonthly(p.priceMonthlyZar))}/yr`}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody>
                    {compareModel.ordered.map((gk) => {
                      const rows = compareModel.all.get(gk) || [];
                      if (!rows.length) return null;

                      return (
                        <React.Fragment key={gk}>
                          <tr className="bg-white">
                            <td colSpan={1 + PATIENT_PLANS.length} className="px-5 pt-6 pb-2">
                              <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{gk}</div>
                            </td>
                          </tr>

                          {rows.map((r) => (
                            <tr key={r.key} className="border-t border-slate-100">
                              <td className="px-5 py-3 text-sm text-slate-700">{r.label}</td>
                              {PATIENT_PLANS.map((p) => {
                                const set = compareModel.byPlan.get(p.key as Plan) || new Set<string>();
                                const hasIt = set.has(r.key);
                                return (
                                  <td key={`${p.key}-${r.key}`} className="px-5 py-3">
                                    <span
                                      className={[
                                        'inline-flex items-center justify-center w-7 h-7 rounded-full text-sm',
                                        hasIt
                                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                          : 'bg-slate-50 text-slate-300 border border-slate-200',
                                      ].join(' ')}
                                      aria-label={hasIt ? 'Included' : 'Not included'}
                                    >
                                      {hasIt ? '✓' : '—'}
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 text-xs text-slate-500">
              Annual billing changes the price — not the features. Same access, best value.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
