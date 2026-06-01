// file: apps/patient-app/app/auth/signup/premium/page.tsx
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useMemo, useState, Suspense } from 'react';
import {
  UserPlus,
  Mail,
  Lock,
  User,
  ArrowRight,
  ShieldCheck,
  Package,
  BadgePercent,
  Stethoscope,
  Microscope,
  Watch,
  ClipboardCheck,
  ArrowLeft,
  HeartPulse,
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
  checkoutUrl?: string;
  redirectTo?: string;
  offer?: PremiumOffer;
};

function PremiumPatientSignupPageContent() {
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
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');

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
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return 'Password must include uppercase, lowercase, a number, and a symbol';
    }
    if (!dob) return 'Date of birth is required';
    if (!gender) return 'Gender is required';
    if (!addressLine1.trim()) return 'Address line 1 is required';
    if (!city.trim()) return 'City is required';
    if (!agreeTerms) return 'Please accept Terms and Privacy to continue';
    if (!agreePromoRules) return 'Please accept the promotion terms to continue';
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
          dob,
          gender,
          phone: phone.trim(),
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim(),
          city: city.trim(),
          postalCode: postalCode.trim(),
          redirectTo,
          marketingOk,
        }),
      });

      const data = (await res.json().catch(() => ({} as PremiumSignupResponse))) as PremiumSignupResponse;

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || data?.message || 'Premium sign up failed');
      }

      if (data?.token) localStorage.setItem('ambulant.token', data.token);
      if (data?.profile) localStorage.setItem('ambulant.profile', JSON.stringify(data.profile));

      if (data?.checkoutUrl) {
        setPostSignup({ checkoutUrl: data.checkoutUrl, offer: data.offer || offer });
        window.location.assign(data.checkoutUrl);
        return;
      }

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
        pill: 'Device bundle - 40% off',
        headline: 'Premium with IoMT bundle',
        sub: 'Get the supported device bundle and unlock one year of Premium access.',
        accent: 'from-teal-700 to-sky-700',
        icon: BadgePercent,
        button: 'Create account and continue to bundle checkout',
      };
    }
    return {
      pill: 'Annual Premium',
      headline: 'Premium annual access',
      sub: 'Get Premium access with eligible promotional benefits where available.',
      accent: 'from-sky-700 to-teal-700',
      icon: ClipboardCheck,
      button: 'Create account and continue to Premium checkout',
    };
  }, [offer]);

  const OfferIcon = offerCopy.icon;

  return (
    <main
      className={cx(
        'min-h-screen overflow-hidden bg-slate-50',
        'bg-[radial-gradient(1000px_circle_at_18%_-12%,rgba(20,184,166,0.18),transparent_58%),radial-gradient(820px_circle_at_102%_0%,rgba(59,130,246,0.12),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.92),rgba(248,250,252,1))]',
      )}
    >
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href={freeSignupHref}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-black text-slate-800 shadow-sm backdrop-blur hover:bg-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to free signup
          </Link>

          <div className="text-xs text-slate-600">
            Already have an account?{' '}
            <Link href={loginHref} className="font-black text-teal-700 hover:underline">
              Sign in
            </Link>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <section className="order-2 lg:order-1 lg:pt-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-white/80 px-3 py-1 text-xs font-black text-slate-700 shadow-sm backdrop-blur">
              <ShieldCheck className="h-4 w-4 text-teal-700" />
              Ambulant+ - Premium Patient
            </div>

            <h1 className="mt-5 max-w-xl text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
              Choose a Premium
              <span className={cx('block bg-gradient-to-r bg-clip-text text-transparent', offerCopy.accent)}>
                care pathway
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">
              Premium supports deeper health insights, device-supported care context,
              family-ready workflows and stronger continuity across remote consultation,
              MedReach diagnostics and CarePort fulfilment where available.
            </p>

            <div className="mt-7 grid max-w-xl gap-3 sm:grid-cols-2">
              <div className="rounded-[28px] border border-white/80 bg-white/75 p-5 shadow-sm backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-950">
                  <ShieldCheck className="h-4 w-4 text-teal-700" />
                  Secure by design
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-600">
                  Designed for privacy-first records and continuity of care.
                </div>
              </div>

              <div className="rounded-[28px] border border-white/80 bg-white/75 p-5 shadow-sm backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-950">
                  <HeartPulse className="h-4 w-4 text-sky-700" />
                  Premium care tools
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-600">
                  Advanced analytics, device trends and expanded care features.
                </div>
              </div>
            </div>

            <div className="mt-7 max-w-xl">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Select Premium option
              </div>

              <div className="mt-3 grid gap-3">
                <button
                  type="button"
                  onClick={() => setOffer('bundle_40_free_year')}
                  className={cx(
                    'w-full rounded-[28px] border p-5 text-left shadow-sm backdrop-blur transition',
                    offer === 'bundle_40_free_year'
                      ? 'border-teal-200 bg-teal-50/80 shadow-teal-900/5'
                      : 'border-white/80 bg-white/75 hover:bg-white',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl border border-teal-100 bg-white text-teal-700">
                      <BadgePercent className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-black text-slate-950">DueCare IoMT bundle - 40% off</div>
                        <span className="inline-flex items-center rounded-full border border-teal-200 bg-white px-2 py-0.5 text-[11px] font-black text-teal-800">
                          Best value
                        </span>
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-600">
                        Health Monitor, Digital Stethoscope, HD Otoscope, NexRing and consumables,
                        with one year of Premium access included.
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOffer('annual_premium_raffle')}
                  className={cx(
                    'w-full rounded-[28px] border p-5 text-left shadow-sm backdrop-blur transition',
                    offer === 'annual_premium_raffle'
                      ? 'border-sky-200 bg-sky-50/80 shadow-sky-900/5'
                      : 'border-white/80 bg-white/75 hover:bg-white',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-100 bg-white text-sky-700">
                      <ClipboardCheck className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-black text-slate-950">Annual Premium access</div>
                        <span className="inline-flex items-center rounded-full border border-sky-200 bg-white px-2 py-0.5 text-[11px] font-black text-sky-800">
                          Eligible offer
                        </span>
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-600">
                        Annual Premium access with eligible promotional benefits where available
                        and subject to the published promotion terms.
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              <div className="mt-4 rounded-[28px] border border-teal-100 bg-teal-50/70 p-5 text-sm leading-7 text-slate-700">
                <div className="flex items-start gap-3">
                  <ClipboardCheck className="mt-1 h-5 w-5 shrink-0 text-teal-700" />
                  <div>
                    <span className="font-extrabold text-slate-950">Note for minors.</span>{' '}
                    A parent or guardian should complete payment and device purchase steps for users under 18.
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-7 max-w-xl rounded-[30px] border border-white/80 bg-white/75 p-5 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-black text-slate-950">Supported device bundle</div>
                <span className="text-xs font-black text-slate-500">Where selected</span>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <Package className="h-4 w-4 text-teal-700" />
                  <div className="text-xs font-extrabold text-slate-900">Health Monitor</div>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <Stethoscope className="h-4 w-4 text-sky-700" />
                  <div className="text-xs font-extrabold text-slate-900">Digital Stethoscope</div>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <Microscope className="h-4 w-4 text-sky-700" />
                  <div className="text-xs font-extrabold text-slate-900">HD Otoscope</div>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <Watch className="h-4 w-4 text-teal-700" />
                  <div className="text-xs font-extrabold text-slate-900">NexRing</div>
                </div>
              </div>
            </div>
          </section>

          <section className="order-1 lg:order-2">
            <div className="mx-auto w-full max-w-md">
              <div className="rounded-[36px] border border-white/80 bg-white/88 p-7 shadow-xl shadow-teal-900/[0.08] backdrop-blur">
                <div className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] border border-teal-100 bg-teal-50 text-teal-700 shadow-sm">
                    <OfferIcon className="h-7 w-7" />
                  </div>

                  <div className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-teal-700">
                    {offerCopy.pill}
                  </div>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                    {offerCopy.headline}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{offerCopy.sub}</p>
                </div>

                {err ? (
                  <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    {err}
                  </div>
                ) : null}

                {postSignup && !loading ? (
                  <div className="mt-5 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
                    <div className="font-black">Account created.</div>
                    <div className="mt-1">
                      {postSignup.checkoutUrl
                        ? 'Redirecting you to secure checkout...'
                        : 'Your account has been created. You will be redirected to your dashboard.'}
                    </div>
                  </div>
                ) : null}

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <label className="block">
                    <div className="text-xs font-black text-slate-700">Full name</div>
                    <div className="relative mt-1">
                      <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-600" />
                      <input
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (err) setErr(null);
                        }}
                        placeholder="e.g. Lerato Mokoena"
                        autoComplete="name"
                        autoCapitalize="words"
                        disabled={loading}
                        className={cx('w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 text-sm shadow-sm focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60')}
                        required
                      />
                    </div>
                  </label>

                  <label className="block">
                    <div className="text-xs font-black text-slate-700">Email</div>
                    <div className="relative mt-1">
                      <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-600" />
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
                        className={cx('w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 text-sm shadow-sm focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60')}
                        required
                      />
                    </div>
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <div className="text-xs font-black text-slate-700">Date of birth</div>
                      <input
                        value={dob}
                        onChange={(e) => {
                          setDob(e.target.value);
                          if (err) setErr(null);
                        }}
                        type="date"
                        autoComplete="bday"
                        disabled={loading}
                        className={cx('mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60')}
                        required
                      />
                    </label>

                    <label className="block">
                      <div className="text-xs font-black text-slate-700">Gender</div>
                      <select
                        value={gender}
                        onChange={(e) => {
                          setGender(e.target.value);
                          if (err) setErr(null);
                        }}
                        disabled={loading}
                        className={cx('mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60')}
                        required
                      >
                        <option value="">Select gender</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="other">Other</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <div className="text-xs font-black text-slate-700">Mobile number</div>
                    <input
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (err) setErr(null);
                      }}
                      type="tel"
                      autoComplete="tel"
                      placeholder="e.g. +27 72 123 4567"
                      disabled={loading}
                      className={cx('mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60')}
                    />
                  </label>

                  <label className="block">
                    <div className="text-xs font-black text-slate-700">Address line 1</div>
                    <input
                      value={addressLine1}
                      onChange={(e) => {
                        setAddressLine1(e.target.value);
                        if (err) setErr(null);
                      }}
                      autoComplete="address-line1"
                      placeholder="Street address"
                      disabled={loading}
                      className={cx('mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60')}
                      required
                    />
                  </label>

                  <label className="block">
                    <div className="text-xs font-black text-slate-700">Address line 2</div>
                    <input
                      value={addressLine2}
                      onChange={(e) => {
                        setAddressLine2(e.target.value);
                        if (err) setErr(null);
                      }}
                      autoComplete="address-line2"
                      placeholder="Apartment, building, suburb (optional)"
                      disabled={loading}
                      className={cx('mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60')}
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <div className="text-xs font-black text-slate-700">City</div>
                      <input
                        value={city}
                        onChange={(e) => {
                          setCity(e.target.value);
                          if (err) setErr(null);
                        }}
                        autoComplete="address-level2"
                        placeholder="City"
                        disabled={loading}
                        className={cx('mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60')}
                        required
                      />
                    </label>

                    <label className="block">
                      <div className="text-xs font-black text-slate-700">Postal code</div>
                      <input
                        value={postalCode}
                        onChange={(e) => {
                          setPostalCode(e.target.value);
                          if (err) setErr(null);
                        }}
                        autoComplete="postal-code"
                        placeholder="Postal code"
                        disabled={loading}
                        className={cx('mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60')}
                      />
                    </label>
                  </div>

                  <label className="block">
                    <div className="text-xs font-black text-slate-700">Password</div>
                    <div className="relative mt-1">
                      <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-600" />
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
                        className={cx('w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 text-sm shadow-sm focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60')}
                        required
                      />
                    </div>
                    <div className="mt-2 text-xs leading-5 text-slate-500">
                      Use a strong password with uppercase, lowercase, a number and a symbol.
                    </div>
                  </label>

                  <div className="space-y-3 rounded-[28px] border border-slate-200 bg-white/75 p-4 text-xs leading-5 text-slate-700">
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
                          promotion terms
                        </Link>
                        .
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
                      <span className="text-slate-600">Send me product updates and premium offers. Optional.</span>
                    </label>
                  </div>

                  <button
                    disabled={loading}
                    type="submit"
                    aria-busy={loading}
                    className={cx(
                      'w-full rounded-2xl bg-gradient-to-r px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-teal-900/10 transition',
                      offer === 'bundle_40_free_year'
                        ? 'from-teal-600 to-cyan-500 hover:from-teal-700 hover:to-cyan-600'
                        : 'from-sky-700 to-teal-600 hover:from-sky-800 hover:to-teal-700',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      {loading ? 'Creating account...' : offerCopy.button}
                      {!loading ? <ArrowRight className="h-4 w-4" /> : null}
                    </span>
                  </button>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <Link href={loginHref} className="font-bold text-teal-700 hover:underline">
                      I already have an account
                    </Link>

                    <Link href={freeSignupHref} className="font-semibold text-slate-500 hover:text-slate-800 hover:underline">
                      Prefer free signup?
                    </Link>
                  </div>
                </form>
              </div>

              <div className="mt-5 text-center text-xs leading-6 text-slate-500">
                Promotions are subject to availability, eligibility and published terms.
                Ambulant+ is not an emergency service.
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function PremiumPatientSignupPage() {
  return (
    <Suspense fallback={null}>
      <PremiumPatientSignupPageContent />
    </Suspense>
  );
}
