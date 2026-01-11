// apps/clinician-app/app/auth/reset/page.tsx
'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Lock, Loader2, ArrowRight, Sparkles, Eye, EyeOff } from 'lucide-react';

type ResetResponse = { ok?: boolean; message?: string };

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export default function ClinicianResetPage() {
  const sp = useSearchParams();
  const router = useRouter();

  const token = sp?.get('token') || '';

  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return !loading && token && pw1.length >= 8 && pw1 === pw2;
  }, [loading, token, pw1, pw2]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setErr('Missing reset token.');
      return;
    }
    if (pw1.length < 8) {
      setErr('Password must be at least 8 characters.');
      return;
    }
    if (pw1 !== pw2) {
      setErr('Passwords do not match.');
      return;
    }

    setErr(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, newPassword: pw1 }),
      });
      const data = (await res.json().catch(() => ({} as ResetResponse))) as ResetResponse;
      if (!res.ok || data?.ok === false) throw new Error(data?.message || 'Reset failed');

      setOk(true);
      router.replace('/auth/login?reason=reset_done');
      router.refresh();
    } catch (er: any) {
      setErr(er?.message || 'Reset failed');
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

          <div className="mt-4 text-2xl font-black text-slate-950">Set a new password</div>
          <div className="mt-1 text-sm text-slate-600">Choose a strong password (min 8 characters).</div>

          {err ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {err}
            </div>
          ) : null}

          {ok ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Password updated. Redirecting to sign in…
            </div>
          ) : null}

          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block">
              <div className="text-xs font-black text-slate-700">New password</div>
              <div className="mt-1 relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  type={show ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={cx(
                    'w-full rounded-2xl border border-slate-200 bg-white px-10 pr-12 py-3 text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-300',
                  )}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <label className="block">
              <div className="text-xs font-black text-slate-700">Confirm password</div>
              <div className="mt-1">
                <input
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  type={show ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={cx(
                    'w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-300',
                  )}
                  required
                />
              </div>
            </label>

            <button
              disabled={!canSubmit}
              type="submit"
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
                    Updating…
                  </>
                ) : (
                  <>
                    Update password <ArrowRight className="h-4 w-4" />
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
          If your reset link expired, request a new one from{' '}
          <Link href="/auth/forgot" className="font-bold text-slate-700 hover:underline">
            Forgot password
          </Link>
          .
        </div>
      </div>
    </main>
  );
}
