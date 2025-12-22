// apps/patient-app/app/app/auth/logout/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, LogIn, ShieldCheck } from 'lucide-react';

function clearCookieBestEffort(name: string) {
  // Best-effort client-side cookie clearing (won't touch HttpOnly cookies).
  const expires = 'Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = `${name}=; expires=${expires}; path=/`;
  document.cookie = `${name}=; expires=${expires}; path=/; samesite=lax`;
}

type Phase = 'clearing' | 'done';

export default function LogoutPage() {
  const [phase, setPhase] = useState<Phase>('clearing');
  const [detail, setDetail] = useState<string>('Clearing your session…');
  const [serverNotified, setServerNotified] = useState<boolean | null>(null);

  const nextSteps = useMemo(
    () => [
      {
        href: '/auth/login',
        label: 'Sign in again',
        icon: LogIn,
        primary: true,
      },
    ],
    [],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 1) Local cleanup FIRST (so any client guards stop thinking you're logged in)
      try {
        setDetail('Clearing local session…');
        localStorage.removeItem('ambulant.token');
        localStorage.removeItem('ambulant.profile');

        localStorage.removeItem('ambulant_uid');
        localStorage.removeItem('ambulant_identity');
        localStorage.removeItem('patient_session');
        localStorage.removeItem('token');

        sessionStorage.clear();
      } catch {
        // ignore best-effort
      }

      // 2) Best-effort cookie cleanup (non-HttpOnly only)
      try {
        setDetail('Clearing browser cookies…');
        const commonCookies = [
          'ambulant.token',
          'ambulant_token',
          'ambulant_session',
          'patient_session',
          'ambulant_identity',
          'ambulant_uid',

          'token',
          'access_token',
          'refresh_token',

          // if you ever used next-auth (harmless to clear)
          'next-auth.session-token',
          '__Secure-next-auth.session-token',
        ];
        for (const c of commonCookies) clearCookieBestEffort(c);
      } catch {
        // ignore best-effort
      }

      // 3) Tell server to clear HttpOnly cookies (best effort; do NOT block UX)
      try {
        setDetail('Notifying server to close session…');
        const ctrl = new AbortController();
        const t = window.setTimeout(() => ctrl.abort(), 1200);

        const res = await fetch('/api/auth/logout', {
          method: 'POST',
          cache: 'no-store',
          signal: ctrl.signal,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reason: 'user_logout' }),
        }).catch(() => null);

        window.clearTimeout(t);

        if (cancelled) return;
        setServerNotified(Boolean(res && 'ok' in res ? res.ok : false));
      } catch {
        if (cancelled) return;
        setServerNotified(false);
      }

      if (cancelled) return;
      setDetail('Done.');
      setPhase('done');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(900px_circle_at_20%_-10%,rgba(16,185,129,0.16),transparent_58%),radial-gradient(850px_circle_at_100%_0%,rgba(99,102,241,0.14),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.86),rgba(248,250,252,1))]">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-[28px] border border-slate-200 bg-white/80 p-6 shadow-sm shadow-black/[0.06] backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black text-slate-500">Ambulant+</div>

                {phase === 'clearing' ? (
                  <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                    Signing you out…
                  </h1>
                ) : (
                  <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                    You’re signed out
                  </h1>
                )}

                <p className="mt-2 text-sm text-slate-600">
                  {phase === 'clearing'
                    ? 'We’re clearing your session on this device for your safety.'
                    : 'Your session has been cleared on this device. Happy to have you back again anytime.'}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                {phase === 'clearing' ? (
                  <Loader2 className="h-5 w-5 text-emerald-700 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                )}
              </div>
            </div>

            {/* Status line */}
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-slate-600" />
                <div className="text-xs font-bold text-slate-800">
                  {phase === 'clearing' ? 'Signing out in progress' : 'Signed out successfully'}
                </div>
              </div>

              <div className="mt-1 text-xs text-slate-600">{detail}</div>

              {phase === 'done' ? (
                <div className="mt-2 text-[11px] text-slate-500">
                  Server session close:{' '}
                  {serverNotified === null ? (
                    <span className="font-semibold text-slate-700">unknown</span>
                  ) : serverNotified ? (
                    <span className="font-semibold text-emerald-700">confirmed</span>
                  ) : (
                    <span className="font-semibold text-amber-700">
                      best-effort (may already be expired)
                    </span>
                  )}
                </div>
              ) : null}
            </div>

            {/* Actions */}
            <div className="mt-6 space-y-3">
              {nextSteps.map((a) => {
                const Icon = a.icon;
                const base =
                  'w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold transition';
                return (
                  <Link
                    key={a.href}
                    href={a.href}
                    className={cx(
                      base,
                      'bg-emerald-600 text-white hover:bg-emerald-700',
                      phase === 'clearing' && 'pointer-events-none opacity-60',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {a.label}
                  </Link>
                );
              })}
            </div>

            {/* Footer helper */}
            <div className="mt-5 text-center text-[11px] text-slate-500">
              Tip: if you’re on a shared device, closing the browser after signing out adds another layer of safety.
              <div className="mt-2">
                <Link href="/privacy" className="font-semibold text-slate-600 hover:underline">
                  Privacy
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center text-[11px] text-slate-500">
            Ambulant+ is designed with privacy-first principles and secure session handling.
          </div>
        </div>
      </div>
    </main>
  );
}

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}
