//apps/patient-app/app/auth/reset/page.tsx
'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Sparkles,
} from 'lucide-react';

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

type ResetResp = { ok?: boolean; message?: string; error?: string };

function safeToken(sp: ReturnType<typeof useSearchParams>) {
  // Never log this. Never render this.
  return (sp?.get('token') || '').trim();
}

function passwordIssues(pw: string): string[] {
  const issues: string[] = [];
  if (pw.length < 8) issues.push('At least 8 characters');
  if (!/[A-Z]/.test(pw)) issues.push('One uppercase letter');
  if (!/[a-z]/.test(pw)) issues.push('One lowercase letter');
  if (!/[0-9]/.test(pw)) issues.push('One number');
  if (!/[^A-Za-z0-9]/.test(pw)) issues.push('One symbol');
  return issues;
}

function scorePassword(pw: string) {
  // Simple, dependency-free score (0..4)
  const len = pw.length;
  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasNum = /[0-9]/.test(pw);
  const hasSym = /[^A-Za-z0-9]/.test(pw);

  let score = 0;
  if (len >= 8) score++;
  if (len >= 12) score++;
  if (hasUpper && hasLower) score++;
  if ((hasNum && hasSym) || (hasNum && hasUpper) || (hasSym && hasUpper)) score++;

  // Clamp 0..4
  score = Math.max(0, Math.min(4, score));

  const label =
    score <= 1 ? 'Weak' : score === 2 ? 'Fair' : score === 3 ? 'Strong' : 'Very strong';

  const hint =
    score <= 1
      ? 'Add length and variety (upper/lower/number/symbol).'
      : score === 2
        ? 'Good start — strengthen a bit more.'
        : score === 3
          ? 'Nice — this is a strong password.'
          : 'Excellent — hard to guess.';

  return { score, label, hint };
}

export default function ResetPasswordPage() {
  const sp = useSearchParams();
  const router = useRouter();

  const token = useMemo(() => safeToken(sp), [sp]);
  const tokenMissing = !token;

  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [phase, setPhase] = useState<'ready' | 'submitting' | 'success'>('ready');
  const [err, setErr] = useState<string | null>(null);

  const submitBtnRef = useRef<HTMLButtonElement | null>(null);

  const issues = useMemo(() => passwordIssues(pw), [pw]);
  const pwMatches = pw.length > 0 && pw2.length > 0 && pw === pw2;
  const strength = useMemo(() => scorePassword(pw), [pw]);

  // Keep UI tidy if token missing
  useEffect(() => {
    if (tokenMissing) {
      setErr(null);
      setPhase('ready');
    }
  }, [tokenMissing]);

  function validate(): string | null {
    if (!token) return 'Reset token is missing. Please use the link from your email.';
    if (!pw) return 'Please enter a new password.';
    if (issues.length > 0) return 'Please strengthen your password to meet the requirements.';
    if (!pw2) return 'Please confirm your new password.';
    if (pw !== pw2) return 'Passwords do not match.';
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phase === 'submitting') return;

    const v = validate();
    if (v) {
      setErr(v);
      submitBtnRef.current?.focus();
      return;
    }

    setErr(null);
    setPhase('submitting');

    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password: pw }),
      });

      const data = (await res.json().catch(() => ({} as ResetResp))) as ResetResp;

      if (!res.ok || data?.ok === false) {
        throw new Error(
          data?.error ||
            data?.message ||
            'We could not reset your password. The link may be expired or already used.',
        );
      }

      setPhase('success');
      setPw('');
      setPw2('');
    } catch (e: any) {
      // No token leakage: we never log token; we only show a generic message.
      setErr(e?.message || 'Password reset failed.');
      setPhase('ready');
      submitBtnRef.current?.focus();
    }
  }

  const meterWidth = `${(strength.score / 4) * 100}%`;
  const meterClass =
    strength.score <= 1
      ? 'bg-rose-500'
      : strength.score === 2
        ? 'bg-amber-500'
        : strength.score === 3
          ? 'bg-emerald-500'
          : 'bg-emerald-600';

  return (
    <main className="min-h-screen bg-[radial-gradient(900px_circle_at_18%_-10%,rgba(16,185,129,0.16),transparent_58%),radial-gradient(820px_circle_at_102%_0%,rgba(99,102,241,0.14),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.86),rgba(248,250,252,1))]">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-[28px] border border-slate-200 bg-white/80 p-6 shadow-sm shadow-black/[0.06] backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black text-slate-500">Ambulant+</div>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                  {phase === 'success' ? 'Password updated' : 'Reset your password'}
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  {phase === 'success'
                    ? 'Your password has been changed successfully. You can sign in with your new password.'
                    : 'Choose a strong new password for your account.'}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                {phase === 'submitting' ? (
                  <Loader2 className="h-5 w-5 text-emerald-700 animate-spin" />
                ) : phase === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                ) : tokenMissing ? (
                  <XCircle className="h-5 w-5 text-rose-600" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-emerald-700" />
                )}
              </div>
            </div>

            {tokenMissing ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                This reset link is missing a token. Please open the password reset link from your email again.
              </div>
            ) : null}

            {err ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {err}
              </div>
            ) : null}

            {phase !== 'success' ? (
              <form onSubmit={onSubmit} className="mt-5 space-y-4">
                {/* Strength meter */}
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-extrabold text-slate-800 inline-flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-slate-500" />
                      Strength: <span className="text-slate-950">{strength.label}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">{strength.hint}</div>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cx('h-2 rounded-full transition-all', meterClass)}
                      style={{ width: pw.length ? meterWidth : '0%' }}
                      aria-hidden="true"
                    />
                  </div>
                </div>

                <label className="block">
                  <div className="text-xs font-black text-slate-700">New password</div>
                  <div className="mt-1 relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      value={pw}
                      onChange={(e) => {
                        setPw(e.target.value);
                        if (err) setErr(null);
                      }}
                      type={showPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      disabled={phase === 'submitting' || tokenMissing}
                      className={cx(
                        'w-full rounded-2xl border border-slate-200 bg-white px-10 pr-12 py-3 text-sm',
                        'focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-300',
                        'disabled:opacity-60 disabled:cursor-not-allowed',
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
                        (phase === 'submitting' || tokenMissing) && 'pointer-events-none opacity-50',
                      )}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="mt-2 grid gap-1 text-[11px] text-slate-500">
                    <div className="font-semibold text-slate-600">Password requirements</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {[
                        { ok: pw.length >= 8, label: '8+ chars' },
                        { ok: /[A-Z]/.test(pw), label: 'Uppercase' },
                        { ok: /[a-z]/.test(pw), label: 'Lowercase' },
                        { ok: /[0-9]/.test(pw), label: 'Number' },
                        { ok: /[^A-Za-z0-9]/.test(pw), label: 'Symbol' },
                      ].map((r) => (
                        <span
                          key={r.label}
                          className={cx(
                            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
                            r.ok
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-white text-slate-500',
                          )}
                        >
                          <span
                            className={cx('h-1.5 w-1.5 rounded-full', r.ok ? 'bg-emerald-500' : 'bg-slate-300')}
                          />
                          {r.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </label>

                <label className="block">
                  <div className="text-xs font-black text-slate-700">Confirm password</div>
                  <div className="mt-1 relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      value={pw2}
                      onChange={(e) => {
                        setPw2(e.target.value);
                        if (err) setErr(null);
                      }}
                      type={showPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Re-enter new password"
                      disabled={phase === 'submitting' || tokenMissing}
                      className={cx(
                        'w-full rounded-2xl border bg-white px-10 py-3 text-sm',
                        pw2.length === 0
                          ? 'border-slate-200'
                          : pwMatches
                            ? 'border-emerald-200 focus:border-emerald-300 focus:ring-emerald-500/25'
                            : 'border-rose-200 focus:border-rose-300 focus:ring-rose-500/20',
                        'focus:outline-none focus:ring-2',
                        'disabled:opacity-60 disabled:cursor-not-allowed',
                      )}
                      required
                    />
                  </div>
                  {pw2.length > 0 ? (
                    <div className={cx('mt-1 text-[11px]', pwMatches ? 'text-emerald-700' : 'text-rose-700')}>
                      {pwMatches ? 'Passwords match.' : 'Passwords do not match.'}
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-slate-500">Make sure both passwords match exactly.</div>
                  )}
                </label>

                <button
                  ref={submitBtnRef}
                  disabled={phase === 'submitting' || tokenMissing}
                  type="submit"
                  aria-busy={phase === 'submitting'}
                  className={cx(
                    'w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white',
                    'transition hover:bg-emerald-700',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    {phase === 'submitting' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Updating…
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        Update password
                      </>
                    )}
                  </span>
                </button>

                <div className="flex items-center justify-between gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="inline-flex items-center gap-2 font-bold text-slate-800 hover:underline"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>

                  <Link href="/privacy" className="font-semibold text-slate-500 hover:text-slate-700 hover:underline">
                    Privacy
                  </Link>
                </div>
              </form>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                  <div className="text-xs font-extrabold text-emerald-900">Success</div>
                  <div className="mt-1 text-xs text-emerald-800">
                    Your password has been updated. Please sign in with your new password.
                  </div>
                </div>

                <Link
                  href="/auth/login"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-emerald-700 transition"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Go to login
                </Link>

                <div className="text-center text-[11px] text-slate-500">
                  If you did not request this change, please reset again immediately and contact support.
                </div>

                <div className="text-center">
                  <Link href="/privacy" className="text-[11px] font-semibold text-slate-600 hover:underline">
                    Privacy
                  </Link>
                </div>
              </div>
            )}

            <div className="mt-5 text-center text-[11px] text-slate-500">
              Reset links are time-limited and can only be used once for security.
            </div>
          </div>

          <div className="mt-4 text-center text-[11px] text-slate-500">
            Ambulant+ uses secure password reset workflows and privacy-first messaging.
          </div>
        </div>
      </div>
    </main>
  );
}
