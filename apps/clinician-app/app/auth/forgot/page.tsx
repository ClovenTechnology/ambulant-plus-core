// apps/clinician-app/app/auth/forgot/page.tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Mail, Loader2, ArrowRight, Sparkles } from 'lucide-react';

type ForgotResponse = { ok?: boolean; message?: string; redirectTo?: string };

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export default function ClinicianForgotPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setErr(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = (await res.json().catch(() => ({} as ForgotResponse))) as ForgotResponse;

      if (!res.ok || data?.ok === false) throw new Error(data?.message || 'Could not start reset');

      setSent(true);

      // Optional: if server returns a redirectTo (e.g., Auth0 ticket)
      if (data?.redirectTo && typeof data.redirectTo === 'string') {
        window.location.href = data.redirectTo;
        return;
      }
    } catch (er: any) {
      setErr(er?.message || 'Could not start reset');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(99,102,241,0.18),transparent_55%),radial-gradient(900px_circle_at_100%_0%,rgba(16,185,129,0.12),transparent_50%)]">
      <div className="mx-auto max-w-xl px-6 py-12">
        <div className="rounded-[28px] border border-slate-200 bg-white/80 p-6 shadow-sm shadow-black/[0.06] backdrop-blur">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-700">
            <Sparkles className="h-4 w-4 text-indigo-700" />
            Ambulant+ · Clinician
          </div>

          <div className="mt-4 text-2xl font-black text-slate-950">Reset your password</div>
          <div className="mt-1 text-sm text-slate-600">
            Enter your email and we’ll send you a secure reset link.
          </div>

          {err ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {err}
            </div>
          ) : null}

          {sent ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              If an account exists for that email, we’ve sent a reset link. Check your inbox.
            </div>
          ) : null}

          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block">
              <div className="text-xs font-black text-slate-700">Email</div>
              <div className="mt-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  className={cx(
                    'w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-300',
                  )}
                  required
                />
              </div>
            </label>

            <button
              disabled={loading}
              type="submit"
              className={cx(
                'w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-extrabold text-white',
                'hover:bg-indigo-700 transition',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    Send reset link <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </span>
            </button>

            <div className="text-center text-xs text-slate-600">
              <Link href="/auth/login" className="font-bold text-slate-800 hover:underline">
                Back to sign in
              </Link>
            </div>
          </form>
        </div>

        <div className="mt-4 text-center text-[11px] text-slate-500">
          For security, we don’t confirm whether an email is registered.
        </div>
      </div>
    </main>
  );
}
