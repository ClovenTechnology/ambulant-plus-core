// apps/patient-app/app/app/auth/forgot/page.tsx
'use client';

import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import { Mail, ShieldCheck, Loader2, ArrowLeft, Send } from 'lucide-react';

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

type ForgotResp = {
  ok?: boolean;
  message?: string;
  error?: string;
};

function normalizeEmail(v: string) {
  return String(v || '').trim().toLowerCase();
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [err, setErr] = useState<string | null>(null);

  const cleanEmail = useMemo(() => normalizeEmail(email), [email]);

  function validate(): string | null {
    if (!cleanEmail) return 'Please enter your email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return 'Please enter a valid email address.';
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phase === 'sending') return;

    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    setErr(null);
    setPhase('sending');

    try {
      const res = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = (await res.json().catch(() => ({} as ForgotResp))) as ForgotResp;

      // SECURITY: prevent account enumeration.
      // Always show success messaging regardless of whether the email exists.
      if (!res.ok && data?.error) {
        console.warn('Forgot password request returned non-OK:', data?.error);
      }

      setPhase('sent');
    } catch {
      setErr('We couldn’t reach the server. Please check your connection and try again.');
      setPhase('idle');
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(900px_circle_at_18%_-10%,rgba(16,185,129,0.16),transparent_58%),radial-gradient(820px_circle_at_102%_0%,rgba(99,102,241,0.14),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.86),rgba(248,250,252,1))]">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-[28px] border border-slate-200 bg-white/80 p-6 shadow-sm shadow-black/[0.06] backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black text-slate-500">Ambulant+</div>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                  {phase === 'sent' ? 'Check your email' : 'Forgot your password?'}
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  {phase === 'sent'
                    ? 'If an account exists for that email, we’ve sent a secure password reset link.'
                    : 'Enter your email and we’ll send a secure password reset link (if an account exists).'}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                {phase === 'sending' ? (
                  <Loader2 className="h-5 w-5 text-emerald-700 animate-spin" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-emerald-700" />
                )}
              </div>
            </div>

            {err ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {err}
              </div>
            ) : null}

            {phase !== 'sent' ? (
              <form onSubmit={onSubmit} className="mt-5 space-y-4">
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
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      placeholder="name@example.com"
                      disabled={phase === 'sending'}
                      className={cx(
                        'w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm',
                        'focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-300',
                        'disabled:opacity-60 disabled:cursor-not-allowed',
                      )}
                      required
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    For privacy, we’ll always show the same message whether the email exists or not.
                  </div>
                </label>

                <button
                  disabled={phase === 'sending'}
                  type="submit"
                  aria-busy={phase === 'sending'}
                  className={cx(
                    'w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white',
                    'transition hover:bg-emerald-700',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    {phase === 'sending' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send reset link
                      </>
                    )}
                  </span>
                </button>

                <div className="flex items-center justify-between gap-3 text-xs">
                  <Link
                    href="/auth/login"
                    className="inline-flex items-center gap-2 font-bold text-slate-800 hover:underline"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to login
                  </Link>

                  <Link href="/privacy" className="font-semibold text-slate-500 hover:text-slate-700 hover:underline">
                    Privacy
                  </Link>
                </div>
              </form>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-xs font-extrabold text-slate-900">Next steps</div>
                  <ul className="mt-2 space-y-2 text-xs text-slate-600">
                    <li>• Check your inbox for a message from Ambulant+.</li>
                    <li>• If you don’t see it, check spam/junk and search for “Ambulant+”.</li>
                    <li>• Reset links are time-limited for your safety.</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPhase('idle');
                    setErr(null);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
                >
                  Send another link
                </button>

                <div className="flex items-center justify-between gap-3 text-xs">
                  <Link href="/auth/login" className="font-bold text-slate-800 hover:underline">
                    Go to login
                  </Link>

                  <Link href="/privacy" className="font-semibold text-slate-500 hover:text-slate-700 hover:underline">
                    Privacy
                  </Link>
                </div>
              </div>
            )}

            <div className="mt-5 text-center text-[11px] text-slate-500">
              Need help? If you can’t access your email, contact support through your organization or clinic administrator.
            </div>
          </div>

          <div className="mt-4 text-center text-[11px] text-slate-500">
            Ambulant+ uses secure, time-limited reset links and privacy-safe messaging.
          </div>
        </div>
      </div>
    </main>
  );
}
