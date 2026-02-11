// file: apps/patient-app/app/auth/signup/page.tsx
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useMemo, useState } from 'react';
import { Sparkles, UserPlus, Mail, Lock, User, ArrowRight, ShieldCheck, Crown } from 'lucide-react';

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

export default function PatientSignupPage() {
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

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function validate(): string | null {
    const name = fullName.trim().replace(/\s+/g, ' ');
    const em = email.trim();

    if (!name) return 'Full name is required';
    if (!em) return 'Email is required';
    if (!password) return 'Password is required';
    if (password.length < 8) return 'Password must be at least 8 characters';
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
        }),
      });

      const data = (await res.json().catch(() => ({} as SignupResponse))) as SignupResponse;

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || data?.message || 'Sign up failed');
      }

      // Mirror login storage
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
    <main
      className={cx(
        'min-h-screen',
        // Worldclass gradient (clean + “health-tech” glow, no image)
        'bg-slate-50',
        'bg-[radial-gradient(1000px_circle_at_18%_-12%,rgba(16,185,129,0.18),transparent_58%),radial-gradient(820px_circle_at_102%_0%,rgba(99,102,241,0.14),transparent_55%),radial-gradient(900px_circle_at_55%_105%,rgba(2,132,199,0.10),transparent_52%),linear-gradient(to_bottom,rgba(255,255,255,0.85),rgba(248,250,252,1))]',
      )}
    >
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          {/* Left */}
          <section className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-black text-slate-700 backdrop-blur">
              <Sparkles className="h-4 w-4 text-emerald-700" />
              Ambulant+ · Patient Portal
            </div>

            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
              Create your
              <span className="block bg-gradient-to-r from-emerald-700 to-indigo-700 bg-clip-text text-transparent">
                Ambulant+ account
              </span>
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
              Track & stream live vitals (integrated IoMTs) during virtual consultations, manage medications (smart
              scheduler/reminder with eRx sync), book visits (electronic appointment booking), and keep your medical
              history organized, with privacy-first EHR and care workflows for yourself and loved ones (spouse/children/aged relatives). Best part? Zero monthly platform fees.
            </p>

            <div className="mt-6 grid max-w-xl gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" />
                  Bank-grade data security
                </div>
                <div className="mt-1 text-[12px] text-slate-600">
                  With blockchain-backed built-in EHR, Ambulant+ is designed to support secure, reliable clinical reconciliation and uninterupted continuity of care. Major medical aids accepted.
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <ArrowRight className="h-4 w-4 text-indigo-700" />
                  Quick 1-min sign up · No fees
                </div>
                <div className="mt-1 text-[12px] text-slate-600">
                  Create your account in under a minute and access a clinician/clinic instantly. Complete profile details later at your pace. You can access care, use your IoMTs and without mandatory subscription. 
                </div>
              </div>
            </div>

            <div className="mt-6 text-xs text-slate-500">
              Already have an account?{' '}
              <Link href="/app/auth/login" className="font-bold text-slate-800 hover:underline">
                Sign in
              </Link>
              .
            </div>
          </section>

          {/* Right: form */}
          <section className="order-1 lg:order-2">
            <div className="mx-auto w-full max-w-md">
              <div className="rounded-[28px] border border-slate-200 bg-white/80 p-6 shadow-sm shadow-blaack/[0.06] backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black text-slate-500">1 Minute Man - Quick Patient Sign up</div>
                    <div className="mt-1 text-2xl font-black tracking-tight text-slate-950">Ambulant+</div>
                    <div className="mt-1 text-sm text-slate-600">... secure health wallet in your pocket - contactless</div>
                  </div>

                  <div className="h-12 w-12 rounded-2xl border border-slate-200 bg-white flex items-center justify-center">
                    <UserPlus className="h-5 w-5 text-emerald-700" />
                  </div>
                </div>

                {/* ✅ Premium link patch */}
                <Link
                  href={premiumHref}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-black text-slate-800 backdrop-blur hover:bg-white"
                >
                  <Crown className="mr-2 h-4 w-4 text-indigo-700" />
                  Upgrade: Premium signup + IoMT bundle offers
                </Link>

                {err ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    {err}
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

                  <button
                    disabled={loading}
                    type="submit"
                    aria-busy={loading}
                    className={cx(
                      'w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white',
                      'hover:bg-emerald-700 transition',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    {loading ? 'Creating…' : 'Create account'}
                  </button>

                  <div className="flex items-center justify-between gap-3 text-xs">
                    <Link href="/auth/login" className="font-bold text-slate-800 hover:underline">
                      I already have an account
                    </Link>

                    <Link href="/privacy" className="font-semibold text-slate-500 hover:text-slate-700 hover:underline">
                      Privacy
                    </Link>
                  </div>

                  <div className="pt-2 text-[11px] text-slate-500">
                    After sign up you’ll be redirected to your Main Dashboard. You can update your profile later.
                  </div>
                </form>
              </div>

              <div className="mt-4 text-center text-[11px] text-slate-500">
                By creating an account you agree to Ambulant+&apos;s Terms and Privacy Policy. Ambulant+ and related
                modules (e.g., MedReach, CarePort, DueCare, InsightCore) are products of Cloven Technology group entities.
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
