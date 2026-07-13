// apps/patient-app/app/auth/login/page.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import {
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  HeartPulse,
  MessageSquareText,
  RotateCcw,
  Fingerprint,
} from 'lucide-react';

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

type LoginResponse = {
  ok?: boolean;
  token?: string;
  profile?: any;
  actorType?: string;
  userId?: string;
  error?: string;
  message?: string;
  redirectTo?: string;
};

type OtpStage = 'idle' | 'code_sent';

function safeInternalPath(p: string | null | undefined, fallback: string) {
  const v = String(p || '').trim();
  if (!v) return fallback;
  if (v.startsWith('/') && !v.startsWith('//')) return v;
  return fallback;
}

function PatientLoginPageContent() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextParam = sp?.get('next') || '';
  const reason = sp?.get('reason') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [otpStage, setOtpStage] = useState<OtpStage>('idle');
  const [otpCode, setOtpCode] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpInfo, setOtpInfo] = useState<string | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  const redirectTo = useMemo(() => {
    return safeInternalPath(nextParam, '/');
  }, [nextParam]);

  useEffect(() => {
    if (!reason) return;
    if (reason === 'signed_out') setErr('You have been signed out. Please sign in again.');
    if (reason === 'expired') setErr('Your session expired. Please sign in again.');
  }, [reason]);

  const canSubmit = useMemo(() => {
    return !loading && email.trim().length > 0 && password.length > 0;
  }, [loading, email, password]);

  const canRequestOtp = useMemo(() => {
    return !otpBusy && email.trim().length > 0;
  }, [otpBusy, email]);

  const canVerifyOtp = useMemo(() => {
    return !otpBusy && email.trim().length > 0 && otpCode.replace(/\D/g, '').length === 6;
  }, [otpBusy, email, otpCode]);

  async function completeLoginFromResponse(data: LoginResponse) {
    if (data?.token) localStorage.setItem('ambulant.token', data.token);
    if (data?.profile) localStorage.setItem('ambulant.profile', JSON.stringify(data.profile));

    const safeServerRedirect = safeInternalPath(data?.redirectTo, '');
    router.replace(safeServerRedirect || redirectTo);
    router.refresh();
  }

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
    setOtpInfo(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: eNorm, password }),
      });

      const data = (await res.json().catch(() => ({} as LoginResponse))) as LoginResponse;

      if (!res.ok || data?.ok === false) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('Invalid email or password.');
        }
        throw new Error(data?.error || data?.message || 'Login failed. Please try again.');
      }

      await completeLoginFromResponse(data);
    } catch (er: any) {
      setErr(er?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  async function requestOtp() {
    if (otpBusy) return;

    const eNorm = email.trim().toLowerCase();
    if (!eNorm) {
      setErr('Please enter your email before requesting a code.');
      return;
    }

    setErr(null);
    setOtpInfo(null);
    setOtpBusy(true);

    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: eNorm }),
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || 'Could not send sign-in code. Please try again.');
      }

      setOtpStage('code_sent');
      setOtpCode('');
      setOtpInfo('If an account exists for this email, a 6-digit code has been sent.');
    } catch (er: any) {
      setErr(er?.message || 'Could not send sign-in code.');
    } finally {
      setOtpBusy(false);
    }
  }

  async function verifyOtp(e?: React.FormEvent) {
    e?.preventDefault?.();
    if (otpBusy) return;

    const eNorm = email.trim().toLowerCase();
    const code = otpCode.replace(/\D/g, '').slice(0, 6);

    if (!eNorm) {
      setErr('Please enter your email.');
      return;
    }
    if (code.length !== 6) {
      setErr('Enter the 6-digit sign-in code.');
      return;
    }

    setErr(null);
    setOtpInfo(null);
    setOtpBusy(true);

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: eNorm, code }),
      });

      const data = (await res.json().catch(() => ({} as LoginResponse))) as LoginResponse;

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || 'Code is invalid or expired.');
      }

      await completeLoginFromResponse(data);
    } catch (er: any) {
      setErr(er?.message || 'Could not verify code.');
    } finally {
      setOtpBusy(false);
    }
  }


  async function signInWithPasskey() {
    if (passkeyBusy) return;

    setErr(null);
    setOtpInfo(null);
    setPasskeyBusy(true);

    try {
      if (typeof window === 'undefined' || !window.PublicKeyCredential) {
        throw new Error('Passkeys are not supported on this browser or device.');
      }

      const optionsRes = await fetch('/api/auth/passkey/login/options', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });

      const optionsData = await optionsRes.json().catch(() => ({} as any));
      if (!optionsRes.ok || optionsData?.ok === false || !optionsData?.options) {
        throw new Error(optionsData?.error || 'Could not start passkey sign-in.');
      }

      const authResponse = await startAuthentication(optionsData.options);

      const verifyRes = await fetch('/api/auth/passkey/login/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ response: authResponse }),
      });

      const verifyData = (await verifyRes.json().catch(() => ({} as LoginResponse))) as LoginResponse;

      if (!verifyRes.ok || verifyData?.ok === false) {
        throw new Error(verifyData?.error || 'Could not verify passkey.');
      }

      await completeLoginFromResponse(verifyData);
    } catch (er: any) {
      const message = String(er?.message || er || 'Passkey sign-in failed.');
      if (message.toLowerCase().includes('abort')) {
        setErr('Passkey sign-in was cancelled.');
      } else {
        setErr(message);
      }
    } finally {
      setPasskeyBusy(false);
    }
  }

  return (
    <main data-p-ui="patient-login-page" className="min-w-0 overflow-x-clip min-h-screen overflow-hidden bg-slate-50 bg-[radial-gradient(1100px_circle_at_18%_-15%,rgba(20,184,166,0.18),transparent_58%),radial-gradient(900px_circle_at_100%_5%,rgba(59,130,246,0.12),transparent_50%),linear-gradient(to_bottom,rgba(255,255,255,0.92),rgba(240,253,250,0.45),rgba(248,250,252,1))]">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-10">
        <div className="grid w-full gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <section className="order-2 lg:order-1">
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
              Secure access to your
              <span className="block bg-gradient-to-r from-teal-700 to-sky-700 bg-clip-text text-transparent">
                health dashboard
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">
              View appointments, vitals, medical records, prescriptions, diagnostics,
              reminders and care updates from one protected patient workspace.
            </p>

            <div className="mt-7 grid max-w-xl gap-3 sm:grid-cols-2">
              <div className="rounded-[28px] border border-white/80 bg-white/75 p-5 shadow-sm backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-950">
                  <Lock className="h-4 w-4 text-teal-700" />
                  Secure session
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-600">
                  Privacy-first access with protected clinical handoff.
                </div>
              </div>

              <div className="rounded-[28px] border border-white/80 bg-white/75 p-5 shadow-sm backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-950">
                  <MessageSquareText className="h-4 w-4 text-sky-700" />
                  OTP access
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-600">
                  Use your password or a one-time email code where supported.
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
              Clinician portal?{' '}
              <span className="font-semibold text-slate-800">
                Use the Clinician app domain for clinician workspace access.
              </span>
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
                    Patient sign in
                  </div>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                    Welcome back
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Sign in with your password, email OTP, or passkey where supported.
                  </p>
                </div>

                {err ? (
                  <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    {err}
                  </div>
                ) : null}

                {otpInfo ? (
                  <div className="mt-5 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
                    {otpInfo}
                  </div>
                ) : null}

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <label className="block">
                    <div className="text-xs font-black text-slate-700">Email</div>
                    <div className="relative mt-1">
                      <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-600" />
                      <input
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (err) setErr(null);
                          if (otpInfo) setOtpInfo(null);
                        }}
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        placeholder="name@example.com"
                        className={cx(
                          'w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 text-sm shadow-sm',
                          'focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20',
                        )}
                        required
                      />
                    </div>
                  </label>

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
                        type={showPw ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="Password"
                        className={cx(
                          'w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 pr-12 text-sm shadow-sm',
                          'focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20',
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((s) => !s)}
                        aria-label={showPw ? 'Hide password' : 'Show password'}
                        className={cx(
                          'absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700',
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
                      'w-full rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-500 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-teal-900/10',
                      'transition hover:from-teal-700 hover:to-cyan-600',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        <>Sign in</>
                      )}
                    </span>
                  </button>
                </form>

                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <div className="text-xs font-semibold text-slate-400">or</div>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <div className="space-y-3">

                  <button
                    type="button"
                    onClick={signInWithPasskey}
                    disabled={passkeyBusy || loading || otpBusy}
                    className={cx(
                      'w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-slate-900/10',
                      'transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      {passkeyBusy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Checking passkey...
                        </>
                      ) : (
                        <>
                          <Fingerprint className="h-4 w-4" />
                          Sign in with passkey
                        </>
                      )}
                    </span>
                  </button>

                  <div className="text-center text-xs leading-5 text-slate-500">
                    Use Face ID, fingerprint, Windows Hello, Android device lock,
                    or your device screen lock where supported.
                  </div>

                  {otpStage === 'code_sent' ? (
                    <form onSubmit={verifyOtp} className="space-y-3">
                      <label className="block">
                        <div className="text-xs font-black text-slate-700">One-time code</div>
                        <input
                          value={otpCode}
                          onChange={(e) => {
                            setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                            if (err) setErr(null);
                          }}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="6-digit code"
                          className={cx(
                            'mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-lg font-black tracking-[0.28em] shadow-sm',
                            'focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20',
                          )}
                        />
                      </label>

                      <button
                        disabled={!canVerifyOtp}
                        type="submit"
                        aria-busy={otpBusy}
                        className={cx(
                          'w-full rounded-2xl border border-teal-200 bg-white px-4 py-3 text-sm font-extrabold text-teal-800 shadow-sm',
                          'transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50',
                        )}
                      >
                        {otpBusy ? 'Verifying...' : 'Verify code and sign in'}
                      </button>

                      <button
                        type="button"
                        onClick={requestOtp}
                        disabled={!canRequestOtp}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Resend code
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={requestOtp}
                      disabled={!canRequestOtp}
                      className={cx(
                        'w-full rounded-2xl border border-teal-200 bg-white px-4 py-3 text-sm font-extrabold text-teal-800 shadow-sm',
                        'transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50',
                      )}
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        <MessageSquareText className="h-4 w-4" />
                        Continue with email OTP
                      </span>
                    </button>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 text-sm">
                  <Link href="/auth/signup" className="font-bold text-teal-700 hover:underline">
                    New to Ambulant+? Create account
                  </Link>

                  <Link
                    href="/auth/forgot"
                    className="font-semibold text-slate-500 hover:text-slate-800 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              <div className="mt-5 text-center text-xs leading-6 text-slate-500">
                By signing in, you agree to Ambulant+ terms and privacy policy.
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function PatientLoginPage() {
  return (
    <Suspense fallback={null}>
      <PatientLoginPageContent />
    </Suspense>
  );
}