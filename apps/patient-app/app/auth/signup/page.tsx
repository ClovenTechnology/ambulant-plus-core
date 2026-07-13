// file: apps/patient-app/app/auth/signup/page.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useMemo, useState, Suspense } from 'react';
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  ShieldCheck,
  BadgePercent,
  HeartPulse,
} from 'lucide-react';

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

type SignupResponse = {
  ok?: boolean;
  token?: string;
  profile?: any;
  error?: string;
  message?: string;
  redirectTo?: string;
};

function PatientSignupPageContent() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextParam = sp?.get('next') || '';
  const redirectTo = useMemo(() => {
    const fallback = '/';
    if (!nextParam) return fallback;
    if (nextParam.startsWith('/') && !nextParam.startsWith('//')) return nextParam;
    return fallback;
  }, [nextParam]);

  const premiumHref = useMemo(() => {
    return nextParam ? `/auth/signup/premium?next=${encodeURIComponent(nextParam)}` : '/auth/signup/premium';
  }, [nextParam]);

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

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: fullName.trim().replace(/\s+/g, ' '),
          email: email.trim().toLowerCase(),
          password,
          dob,
          gender,
          phone: phone.trim(),
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim(),
          city: city.trim(),
          postalCode: postalCode.trim(),
          redirectTo,
        }),
      });

      const data = (await res.json().catch(() => ({} as SignupResponse))) as SignupResponse;

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || data?.message || 'Sign up failed');
      }

      if (data?.token) localStorage.setItem('ambulant.token', data.token);
      if (data?.profile) localStorage.setItem('ambulant.profile', JSON.stringify(data.profile));

      const serverRedirect = data?.redirectTo;
      const safeServerRedirect =
        typeof serverRedirect === 'string' && serverRedirect.startsWith('/') && !serverRedirect.startsWith('//')
          ? serverRedirect
          : null;

      router.replace(safeServerRedirect || redirectTo);
    } catch (er: any) {
      setErr(er?.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main data-p-ui="patient-signup-page"
      className={cx(
        'min-h-screen overflow-hidden bg-slate-50',
        'bg-[radial-gradient(1000px_circle_at_18%_-12%,rgba(20,184,166,0.18),transparent_58%),radial-gradient(820px_circle_at_102%_0%,rgba(59,130,246,0.12),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.92),rgba(248,250,252,1))]',
      )}
    >
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-10">
        <div className="grid w-full gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <section className="order-2 lg:order-1 lg:pt-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-white/80 px-3 py-1 text-xs font-black text-slate-700 shadow-sm backdrop-blur">
              <Image
                src="/brand/ambulant-mark.webp"
                alt=""
                width={18}
                height={18}
                className="h-4 w-4 object-contain"
              />
              Ambulant+ Patient
            </div>

            <h1 className="mt-5 max-w-xl text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
              Create your
              <span className="block bg-gradient-to-r from-teal-700 to-sky-700 bg-clip-text text-transparent">
                patient account
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">
              Create a secure Ambulant+ patient profile to book clinicians, manage
              appointments, connect supported devices, view care records, receive reminders
              and continue care through MedReach and CarePort where applicable.
            </p>

            <div className="mt-7 grid max-w-xl gap-3 sm:grid-cols-2">
              <div className="rounded-[28px] border border-white/80 bg-white/75 p-5 shadow-sm backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-950">
                  <ShieldCheck className="h-4 w-4 text-teal-700" />
                  Privacy-first records
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-600">
                  Secure care history designed for continuity across supported workflows.
                </div>
              </div>

              <div className="rounded-[28px] border border-white/80 bg-white/75 p-5 shadow-sm backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-950">
                  <HeartPulse className="h-4 w-4 text-sky-700" />
                  Start free
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-600">
                  Start with free patient access. Premium and family features are optional.
                </div>
              </div>
            </div>

            <div className="mt-7 rounded-[28px] border border-teal-100 bg-teal-50/70 p-5 text-sm leading-7 text-slate-700">
              <div className="flex items-start gap-3">
                <HeartPulse className="mt-1 h-5 w-5 shrink-0 text-teal-700" />
                <div>
                  <span className="font-extrabold text-slate-950">Not an emergency service.</span>{' '}
                  In a medical emergency, contact local emergency services immediately.
                </div>
              </div>
            </div>

            <div className="mt-6 text-sm text-slate-600">
              Already have an account?{' '}
              <Link href="/auth/login" className="font-bold text-teal-700 hover:underline">
                Sign in
              </Link>
              .
            </div>
          </section>

          <section className="order-1 lg:order-2">
            <div className="mx-auto w-full max-w-md">
              <div className="rounded-[36px] border border-white/80 bg-white/88 p-7 shadow-xl shadow-teal-900/[0.08] backdrop-blur">
                <div className="text-center">
                  <div className="mx-auto flex justify-center">
                    <Image
                      src="/brand/ambulant-logo-full.webp"
                      alt="Ambulant+ Contactless Medicine"
                      width={220}
                      height={74}
                      priority
                      className="h-auto w-[190px] object-contain"
                    />
                  </div>

                  <div className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-teal-700">
                    Patient profile
                  </div>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                    Create account
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Complete the required details to activate your patient workspace.
                  </p>
                </div>

                <Link
                  href={premiumHref}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm font-black text-teal-800 hover:bg-teal-50"
                >
                  <BadgePercent className="h-4 w-4" />
                  View Premium and device bundle options
                </Link>

                {err ? (
                  <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    {err}
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
                        className={cx(
                          'w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 text-sm shadow-sm',
                          'focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20',
                          'disabled:cursor-not-allowed disabled:opacity-60',
                        )}
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
                        className={cx(
                          'w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 text-sm shadow-sm',
                          'focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20',
                          'disabled:cursor-not-allowed disabled:opacity-60',
                        )}
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
                        className={cx(
                          'mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm',
                          'focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20',
                          'disabled:cursor-not-allowed disabled:opacity-60',
                        )}
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
                        className={cx(
                          'mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm',
                          'focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20',
                          'disabled:cursor-not-allowed disabled:opacity-60',
                        )}
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
                      className={cx(
                        'mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm',
                        'focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20',
                        'disabled:cursor-not-allowed disabled:opacity-60',
                      )}
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
                      className={cx(
                        'mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm',
                        'focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20',
                        'disabled:cursor-not-allowed disabled:opacity-60',
                      )}
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
                      className={cx(
                        'mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm',
                        'focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20',
                        'disabled:cursor-not-allowed disabled:opacity-60',
                      )}
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
                        className={cx(
                          'mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm',
                          'focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20',
                          'disabled:cursor-not-allowed disabled:opacity-60',
                        )}
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
                        className={cx(
                          'mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm',
                          'focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20',
                          'disabled:cursor-not-allowed disabled:opacity-60',
                        )}
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
                        className={cx(
                          'w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 text-sm shadow-sm',
                          'focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20',
                          'disabled:cursor-not-allowed disabled:opacity-60',
                        )}
                        required
                      />
                    </div>
                    <div className="mt-2 text-xs leading-5 text-slate-500">
                      Use a strong password with uppercase, lowercase, a number and a symbol.
                    </div>
                  </label>

                  <button
                    disabled={loading}
                    type="submit"
                    aria-busy={loading}
                    className={cx(
                      'w-full rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-500 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-teal-900/10',
                      'transition hover:from-teal-700 hover:to-cyan-600',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      {loading ? 'Creating account...' : 'Create account'}
                      {!loading ? <ArrowRight className="h-4 w-4" /> : null}
                    </span>
                  </button>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <Link href="/auth/login" className="font-bold text-teal-700 hover:underline">
                      Already have an account? Login
                    </Link>

                    <Link href="/privacy" className="font-semibold text-slate-500 hover:text-slate-800 hover:underline">
                      Privacy
                    </Link>
                  </div>

                  <div className="pt-2 text-xs leading-5 text-slate-500">
                    After sign up, you can complete or update your profile from your dashboard.
                  </div>
                </form>
              </div>

              <div className="mt-5 text-center text-xs leading-6 text-slate-500">
                By creating an account, you agree to Ambulant+ terms and privacy policy.
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function PatientSignupPage() {
  return (
    <Suspense fallback={null}>
      <PatientSignupPageContent />
    </Suspense>
  );
}
