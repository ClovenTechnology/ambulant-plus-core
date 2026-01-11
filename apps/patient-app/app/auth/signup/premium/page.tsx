// file: apps/patient-app/app/auth/signup/premium/page.tsx
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  UserPlus,
  Mail,
  Lock,
  User,
  ArrowRight,
  ShieldCheck,
  Crown,
  Gift,
  BadgePercent,
  Package,
  Stethoscope,
  Microscope,
  Watch,
  ClipboardCheck,
  ArrowLeft,
  Trophy,
} from 'lucide-react';

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

type PremiumOffer = 'bundle_40_free_year' | 'annual_premium_raffle';

type PremiumSignupResponse = {
  ok?: boolean;
  token?: string;
  profile?: any;
  error?: string;
  message?: string;

  // If payments are wired, server can return a checkout URL (Stripe/PayFast/etc)
  checkoutUrl?: string;

  // Optional internal redirect (kept relative)
  redirectTo?: string;

  offer?: PremiumOffer;
};

export default function PremiumPatientSignupPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextParam = sp?.get('next') || '';
  const redirectTo = useMemo(() => {
    const fallback = '/';
    if (!nextParam) return fallback;
    if (nextParam.startsWith('/') && !nextParam.startsWith('//')) return nextParam;
    return fallback;
  }, [nextParam]);

  const freeSignupHref = useMemo(() => {
    const base = '/auth/signup';
    return nextParam ? `${base}?next=${encodeURIComponent(nextParam)}` : base;
  }, [nextParam]);

  const loginHref = useMemo(() => {
    const base = '/auth/login';
    return nextParam ? `${base}?next=${encodeURIComponent(nextParam)}` : base;
  }, [nextParam]);

  const [offer, setOffer] = useState<PremiumOffer>('bundle_40_free_year');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePromoRules, setAgreePromoRules] = useState(false);
  const [marketingOk, setMarketingOk] = useState(true);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [postSignup, setPostSignup] = useState<{
    checkoutUrl?: string;
    offer?: PremiumOffer;
  } | null>(null);

  function validate(): string | null {
    const name = fullName.trim().replace(/\s+/g, ' ');
    const em = email.trim();

    if (!name) return 'Full name is required';
    if (!em) return 'Email is required';
    if (!password) return 'Password is required';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!agreeTerms) return 'Please accept Terms & Privacy to continue';
    if (!agreePromoRules) return 'Please accept the Promotion Rules to continue';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    setErr(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/premium-signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: fullName.trim().replace(/\s+/g, ' '),
          email: email.trim().toLowerCase(),
          password,
          offer,
          redirectTo,
          marketingOk,
        }),
      });

      const data = (await res.json().catch(() => ({} as PremiumSignupResponse))) as PremiumSignupResponse;

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || data?.message || 'Premium sign up failed');
      }

      // Mirror login storage
      if (data?.token) localStorage.setItem('ambulant.token', data.token);
      if (data?.profile) localStorage.setItem('ambulant.profile', JSON.stringify(data.profile));

      // If we have a checkout URL, go there (external checkout allowed)
      if (data?.checkoutUrl) {
        setPostSignup({ checkoutUrl: data.checkoutUrl, offer: data.offer || offer });
        // Redirect immediately (still keep UI fallback if popup blockers etc)
        window.location.assign(data.checkoutUrl);
        return;
      }

      // Otherwise: safe internal redirect (same safety rules as your free page)
      const serverRedirect = data?.redirectTo;
      const safeServerRedirect =
        typeof serverRedirect === 'string' &&
        serverRedirect.startsWith('/') &&
        !serverRedirect.startsWith('//')
          ? serverRedirect
          : null;

      setPostSignup({ checkoutUrl: undefined, offer: data.offer || offer });
      router.replace(safeServerRedirect || redirectTo);
    } catch (er: any) {
      setErr(er?.message || 'Premium sign up failed');
    } finally {
      setLoading(false);
    }
  }

  const offerCopy = useMemo(() => {
    if (offer === 'bundle_40_free_year') {
      return {
        pill: 'Bundle Deal · 40% OFF',
        headline: 'Buy the DueCare IoMT Bundle',
        sub: 'Get all 4 IoMTs + full consumable pack — and unlock 1 year Premium Plan access free.',
        accent: 'from-emerald-700 to-indigo-700',
        icon: BadgePercent,
      };
    }
    return {
      pill: 'Annual Premium · Prize Draw',
      headline: 'Pay Premium for 1 year',
      sub: 'Get full Premium access and stand a chance to win the IoMT bundle or branded Ambulant+ merch.',
      accent: 'from-indigo-700 to-emerald-700',
      icon: Trophy,
    };
  }, [offer]);

  const OfferIcon = offerCopy.icon;

  return (
    <main
      className={cx(
        'min-h-screen',
        'bg-slate-50',
        'bg-[radial-gradient(1000px_circle_at_18%_-12%,rgba(16,185,129,0.18),transparent_58%),radial-gradient(820px_circle_at_102%_0%,rgba(99,102,241,0.16),transparent_55%),radial-gradient(900px_circle_at_55%_105%,rgba(2,132,199,0.12),transparent_52%),linear-gradient(to_bottom,rgba(255,255,255,0.88),rgba(248,250,252,1))]',
      )}
    >
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href={freeSignupHref}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-black text-slate-800 backdrop-blur hover:bg-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Free Signup
          </Link>

          <div className="text-xs text-slate-600">
            Already have an account?{' '}
            <Link href={loginHref} className="font-black text-slate-900 hover:underline">
              Sign in
            </Link>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
          {/* Left */}
          <section className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-black text-slate-700 backdrop-blur">
              <Sparkles className="h-4 w-4 text-emerald-700" />
              Ambulant+ · Premium Patient Signup
            </div>

            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
              Upgrade your care to
              <span className={cx('block bg-gradient-to-r bg-clip-text text-transparent', offerCopy.accent)}>
                Premium + IoMT-ready
              </span>
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
              Choose your premium path: secure your DueCare IoMT bundle at a massive discount (and get 1-year Premium
              access free), or subscribe to Premium annually and enter the draw for the bundle and exclusive Ambulant+
              merch. Built for real-world care: streaming vitals, eRx workflows, MedReach logistics, and privacy-first EHR.
            </p>

            <div className="mt-6 grid max-w-xl gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" />
                  Secure by design
                </div>
                <div className="mt-1 text-[12px] text-slate-600">
                  Designed for clinical-grade continuity and secure health records.
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <Crown className="h-4 w-4 text-indigo-700" />
                  Premium experience
                </div>
                <div className="mt-1 text-[12px] text-slate-600">
                  Deeper insights, smarter workflows, and extended care tools.
                </div>
              </div>
            </div>

            {/* Offer selector cards */}
            <div className="mt-6 max-w-xl">
              <div className="text-xs font-black text-slate-700">Choose your Premium path</div>

              <div className="mt-2 grid gap-3">
                <button
                  type="button"
                  onClick={() => setOffer('bundle_40_free_year')}
                  className={cx(
                    'w-full text-left rounded-[26px] border p-4 backdrop-blur transition',
                    offer === 'bundle_40_free_year'
                      ? 'border-emerald-200 bg-emerald-50/60 shadow-sm shadow-emerald-900/5'
                      : 'border-slate-200 bg-white/70 hover:bg-white',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-10 w-10 rounded-2xl border border-slate-200 bg-white flex items-center justify-center">
                      <BadgePercent className="h-5 w-5 text-emerald-700" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-black text-slate-950">DueCare IoMT Bundle — 40% OFF</div>
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11px] font-black text-emerald-800">
                          Best Value
                        </span>
                      </div>
                      <div className="mt-1 text-[12px] text-slate-600">
                        Health Monitor, Digital Stethoscope, HD Otoscope, NexRing + consumables (2 glucose strip packs +
                        lancets, pill sorter, gloves) — plus FREE 1-year Premium access.
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOffer('annual_premium_raffle')}
                  className={cx(
                    'w-full text-left rounded-[26px] border p-4 backdrop-blur transition',
                    offer === 'annual_premium_raffle'
                      ? 'border-indigo-200 bg-indigo-50/60 shadow-sm shadow-indigo-900/5'
                      : 'border-slate-200 bg-white/70 hover:bg-white',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-10 w-10 rounded-2xl border border-slate-200 bg-white flex items-center justify-center">
                      <Trophy className="h-5 w-5 text-indigo-700" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-black text-slate-950">Annual Premium — Prize Draw</div>
                        <span className="inline-flex items-center rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-[11px] font-black text-indigo-800">
                          Win Big
                        </span>
                      </div>
                      <div className="mt-1 text-[12px] text-slate-600">
                        Pay for 1-year Premium access and enter the draw to win the DueCare IoMT bundle or Ambulant+
                        branded merch.
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              <div className="mt-3 rounded-3xl border border-slate-200 bg-white/60 p-4 text-[12px] text-slate-600 backdrop-blur">
                <div className="flex items-start gap-2">
                  <ClipboardCheck className="mt-0.5 h-4 w-4 text-slate-500" />
                  <div>
                    <div className="font-black text-slate-900">Note for minors</div>
                    <div className="mt-1">
                      If you’re under 18, please ask a parent/guardian to complete payment and device purchase steps.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bundle contents quick list */}
            <div className="mt-6 max-w-xl rounded-[28px] border border-slate-200 bg-white/70 p-5 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-black text-slate-950">What’s included</div>
                <span className="text-[11px] font-black text-slate-500">Offer depends on selection</span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <Package className="h-4 w-4 text-emerald-700" />
                  <div className="text-[12px] font-extrabold text-slate-900">DueCare Health Monitor</div>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <Stethoscope className="h-4 w-4 text-indigo-700" />
                  <div className="text-[12px] font-extrabold text-slate-900">Digital Stethoscope</div>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <Microscope className="h-4 w-4 text-sky-700" />
                  <div className="text-[12px] font-extrabold text-slate-900">HD Otoscope</div>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <Watch className="h-4 w-4 text-emerald-700" />
                  <div className="text-[12px] font-extrabold text-slate-900">NexRing</div>
                </div>
              </div>

              <div className="mt-3 flex items-start gap-2 text-[12px] text-slate-600">
                <Gift className="mt-0.5 h-4 w-4 text-slate-500" />
                <div>
                  Consumables pack includes <span className="font-semibold text-slate-800">2 glucose strip packs + lancets</span>,
                  a <span className="font-semibold text-slate-800">pill sorter</span>, and <span className="font-semibold text-slate-800">gloves</span>.
                  Bundle offer includes a <span className="font-semibold text-slate-800">40% discount</span> and
                  <span className="font-semibold text-slate-800"> 1-year Premium access free</span>.
                </div>
              </div>
            </div>
          </section>

          {/* Right: form */}
          <section className="order-1 lg:order-2">
            <div className="mx-auto w-full max-w-md">
              <div className="rounded-[28px] border border-slate-200 bg-white/80 p-6 shadow-sm shadow-black/[0.06] backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black text-slate-500">{offerCopy.pill}</div>
                    <div className="mt-1 text-2xl font-black tracking-tight text-slate-950">{offerCopy.headline}</div>
                    <div className="mt-1 text-sm text-slate-600">{offerCopy.sub}</div>
                  </div>

                  <div className="h-12 w-12 rounded-2xl border border-slate-200 bg-white flex items-center justify-center">
                    <OfferIcon className={cx('h-5 w-5', offer === 'bundle_40_free_year' ? 'text-emerald-700' : 'text-indigo-700')} />
                  </div>
                </div>

                {err ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    {err}
                  </div>
                ) : null}

                {postSignup && !loading ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900">
                    <div className="font-black">Account created.</div>
                    <div className="mt-1">
                      {postSignup.checkoutUrl
                        ? 'Redirecting you to secure checkout…'
                        : 'If checkout isn’t enabled yet, you’ll still land on your dashboard — and we can complete billing in the next step.'}
                    </div>
                  </div>
                ) : null}

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                  <label className="block">
                    <div className="text-xs font-black text-slate-700">Full name</div>
                    <div className="mt-1 relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (err) setErr(null);
                        }}
                        placeholder="e.g., Lerato Toto"
                        autoComplete="name"
                        autoCapitalize="words"
                        disabled={loading}
                        className={cx(
                          'w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm',
                          'focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-300',
                          'disabled:opacity-60 disabled:cursor-not-allowed',
                        )}
                        required
                      />
                    </div>
                  </label>

                  <label className="block">
                    <div className="text-xs font-black text-slate-700">Email</div>
                    <div className="mt-1 relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (err) setErr(null);
                        }}
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        autoCapitalize="none"
                        placeholder="name@example.com"
                        disabled={loading}
                        className={cx(
                          'w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm',
                          'focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-300',
                          'disabled:opacity-60 disabled:cursor-not-allowed',
                        )}
                        required
                      />
                    </div>
                  </label>

                  <label className="block">
                    <div className="text-xs font-black text-slate-700">Password</div>
                    <div className="mt-1 relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (err) setErr(null);
                        }}
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        placeholder="At least 8 characters"
                        disabled={loading}
                        className={cx(
                          'w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm',
                          'focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-300',
                          'disabled:opacity-60 disabled:cursor-not-allowed',
                        )}
                        required
                      />
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">Use a strong password you don’t reuse elsewhere.</div>
                  </label>

                  {/* Agreements */}
                  <div className="space-y-2 rounded-3xl border border-slate-200 bg-white/70 p-4 text-[12px] text-slate-700">
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={agreeTerms}
                        onChange={(e) => {
                          setAgreeTerms(e.target.checked);
                          if (err) setErr(null);
                        }}
                        disabled={loading}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300"
                      />
                      <span>
                        I agree to the{' '}
                        <Link href="/terms" className="font-black text-slate-900 hover:underline">
                          Terms
                        </Link>{' '}
                        and{' '}
                        <Link href="/privacy" className="font-black text-slate-900 hover:underline">
                          Privacy Policy
                        </Link>
                        .
                      </span>
                    </label>

                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={agreePromoRules}
                        onChange={(e) => {
                          setAgreePromoRules(e.target.checked);
                          if (err) setErr(null);
                        }}
                        disabled={loading}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300"
                      />
                      <span>
                        I agree to the{' '}
                        <Link href="/promotions/premium-signup" className="font-black text-slate-900 hover:underline">
                          Promotion Rules
                        </Link>
                        {offer === 'annual_premium_raffle' ? ' (Prize Draw terms apply).' : '.'}
                      </span>
                    </label>

                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={marketingOk}
                        onChange={(e) => setMarketingOk(e.target.checked)}
                        disabled={loading}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300"
                      />
                      <span className="text-slate-600">You may send me product updates and premium offers (optional).</span>
                    </label>
                  </div>

                  <button
                    disabled={loading}
                    type="submit"
                    aria-busy={loading}
                    className={cx(
                      'w-full rounded-2xl px-4 py-3 text-sm font-extrabold text-white transition',
                      offer === 'bundle_40_free_year' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    {loading ? 'Creating…' : offer === 'bundle_40_free_year' ? 'Create account & go to Bundle Checkout' : 'Create account & go to Premium Checkout'}
                    <ArrowRight className="ml-2 inline h-4 w-4" />
                  </button>

                  <div className="flex items-center justify-between gap-3 text-xs">
                    <Link href={loginHref} className="font-bold text-slate-800 hover:underline">
                      I already have an account
                    </Link>

                    <Link href={freeSignupHref} className="font-semibold text-slate-500 hover:text-slate-700 hover:underline">
                      Prefer Free signup?
                    </Link>
                  </div>

                  <div className="pt-2 text-[11px] text-slate-500">
                    After sign up, you’ll proceed to secure checkout (if enabled). Your post-signup landing is:{' '}
                    <span className="font-semibold text-slate-700">{redirectTo}</span>
                  </div>
                </form>
              </div>

              <div className="mt-4 text-center text-[11px] text-slate-500">
                By creating an account you agree to Ambulant+&apos;s Terms and Privacy Policy. Promotions are subject to
                availability and the posted rules. Ambulant+ and related modules (e.g., MedReach, CarePort, DueCare,
                InsightCore) are products of Cloven Technology group entities.
              </div>
            </div>
          </section>
        </div>

        <div className="mt-8 text-center text-[11px] text-slate-500">
          <span className="font-semibold">Prize Draw note:</span> “Stand a chance to win” is subject to official Promotion
          Rules, eligibility, and availability. No guarantee of winning.
        </div>
      </div>
    </main>
  );
}
