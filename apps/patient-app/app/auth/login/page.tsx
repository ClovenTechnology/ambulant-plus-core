// apps/patient-app/app/auth/login/page.tsx
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

type LoginResponse = {
  ok?: boolean;
  // Optional: token-based sessions (you may also be cookie-only)
  token?: string;
  profile?: any;
  actorType?: string;
  userId?: string;
  error?: string;
  message?: string;
  redirectTo?: string;
};

function safeInternalPath(p: string | null | undefined, fallback: string) {
  const v = String(p || '').trim();
  if (!v) return fallback;
  // Prevent open-redirects: only allow internal paths.
  if (v.startsWith('/') && !v.startsWith('//')) return v;
  return fallback;
}

export default function PatientLoginPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextParam = sp?.get('next') || '';
  const reason = sp?.get('reason') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    // Default patient landing route
    const fallback = '/';
    return safeInternalPath(nextParam, fallback);
  }, [nextParam]);

  useEffect(() => {
    if (!reason) return;
    if (reason === 'signed_out') setErr('You have been signed out. Please sign in again.');
    if (reason === 'expired') setErr('Your session expired. Please sign in again.');
  }, [reason]);

  const canSubmit = useMemo(() => {
    return !loading && email.trim().length > 0 && password.length > 0;
  }, [loading, email, password]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const eNorm = email.trim().toLowerCase();
    if (!eNorm) {
      setErr('Please enter your email.');
      return;
    }
    if (!password) {
      setErr('Please enter your password.');
      return;
    }

    setErr(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // Important if your /api/auth/login sets httpOnly cookies
        credentials: 'include',
        body: JSON.stringify({ email: eNorm, password }),
      });

      const data = (await res.json().catch(() => ({} as LoginResponse))) as LoginResponse;

      // Normalize messaging (avoid leaking extra details)
      if (!res.ok || data?.ok === false) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('Invalid email or password.');
        }
        throw new Error(data?.error || data?.message || 'Login failed. Please try again.');
      }

      // Optional token support (if your API returns it)
      if (data?.token) localStorage.setItem('ambulant.token', data.token);
      if (data?.profile) localStorage.setItem('ambulant.profile', JSON.stringify(data.profile));

      // Server may optionally supply redirectTo
      const safeServerRedirect = safeInternalPath(data?.redirectTo, '');
      router.replace(safeServerRedirect || redirectTo);
      router.refresh();
    } catch (er: any) {
      setErr(er?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(16,185,129,0.14),transparent_55%),radial-gradient(900px_circle_at_100%_0%,rgba(99,102,241,0.12),transparent_50%)]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          {/* Left: brand / message */}
          <section className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-black text-slate-700 backdrop-blur">
              <Sparkles className="h-4 w-4 text-emerald-700" />
              Ambulant+ · Patient
            </div>

            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
              Sign in to your
              <span className="block bg-gradient-to-r from-emerald-700 to-indigo-700 bg-clip-text text-transparent">
                health dashboard
              </span>
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
              Access vitals, appointments, CarePort eRx, MedReach labs, reminders, and your Lady Center insights — all in
              one place.
            </p>

            <div className="mt-6 grid max-w-xl gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" />
                  Secure session
                </div>
                <div className="mt-1 text-[12px] text-slate-600">
                  Privacy-first care workflows with clean clinical handoff.
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <ArrowRight className="h-4 w-4 text-indigo-700" />
                  Fast access
                </div>
                <div className="mt-1 text-[12px] text-slate-600">
                  Jump straight back to where you left off after signing in.
                </div>
              </div>
            </div>

            <div className="mt-6 text-xs text-slate-500">
              Clinician portal?{' '}
              <span className="text-slate-600">
                Use the Clinician app domain (recommended).
              </span>
            </div>
          </section>

          {/* Right: form */}
          <section className="order-1 lg:order-2">
            <div className="mx-auto w-full max-w-md">
              <div className="rounded-[28px] border border-slate-200 bg-white/80 p-6 shadow-sm shadow-black/[0.06] backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black text-slate-500">Patient Sign in</div>
                    <div className="mt-1 text-2xl font-black tracking-tight text-slate-950">Welcome back</div>
                    <div className="mt-1 text-sm text-slate-600">Use your email + password.</div>
                  </div>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
                    ) : (
                      <Lock className="h-5 w-5 text-emerald-700" />
                    )}
                  </div>
                </div>

                {err ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    {err}
                  </div>
                ) : null}

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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
                        placeholder="name@example.com"
                        className={cx(
                          'w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm',
                          'focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-300',
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
                        type={showPw ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className={cx(
                          'w-full rounded-2xl border border-slate-200 bg-white px-10 pr-12 py-3 text-sm',
                          'focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-300',
                        )}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((s) => !s)}
                        aria-label={showPw ? 'Hide password' : 'Show password'}
                        className={cx(
                          'absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:text-slate-700',
                          'hover:bg-slate-100',
                          loading && 'pointer-events-none opacity-60',
                        )}
                      >
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>

                  <button
                    disabled={!canSubmit}
                    type="submit"
                    aria-busy={loading}
                    className={cx(
                      'w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white',
                      'hover:bg-emerald-700 transition',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Signing in…
                        </>
                      ) : (
                        <>Sign in</>
                      )}
                    </span>
                  </button>

                  <div className="flex items-center justify-between gap-3 text-xs">
                    <Link href="/auth/signup" className="font-bold text-slate-800 hover:underline">
                      Create account
                    </Link>

                    <Link
                      href="/auth/forgot"
                      className="font-semibold text-slate-500 hover:text-slate-700 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <div className="pt-2 text-[11px] text-slate-500">
                    Redirect after sign in: <span className="font-semibold text-slate-700">{redirectTo}</span>
                  </div>
                </form>
              </div>

              <div className="mt-4 text-center text-[11px] text-slate-500">
                By signing in you agree to Ambulant+'s terms and privacy policy.
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
