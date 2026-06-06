'use client';

import { useEffect, useState } from 'react';
import { Loader2, LogOut } from 'lucide-react';

const LOGIN_URL = '/auth/login?reason=signed_out';

const STORAGE_KEYS = [
  'ambulant.token',
  'ambulant.profile',
  'token',
  'ambulant.clinician.token',
  'ambulant.clinician.profile',
  'clinician_session',
  'ambulant_identity',
  'ambulant_uid',
];

const COOKIE_NAMES = [
  'ambulant.token',
  'ambulant_token',
  'ambulant_session',
  '__Host-ambulant_session',
  'ambulant.session',
  'ambulant_identity',
  'ambulant_uid',
  'token',
  'access_token',
  'refresh_token',
  'session',
  'auth_session',
  'clinician_session',
  'ambulant_clinician_session',
  '__Host-ambulant_clinician_session',
  'ambulant.clinician.token',
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
];

function clearCookieBestEffort(name: string) {
  const expires = 'Thu, 01 Jan 1970 00:00:00 GMT';

  document.cookie = `${name}=; expires=${expires}; max-age=0; path=/`;
  document.cookie = `${name}=; expires=${expires}; max-age=0; path=/; SameSite=Lax`;
  document.cookie = `${name}=; expires=${expires}; max-age=0; path=/; Secure; SameSite=Lax`;
}

export default function ClinicianLogoutPage() {
  const [detail, setDetail] = useState('Clearing your clinician session…');

  useEffect(() => {
    let redirected = false;

    const goLogin = () => {
      if (redirected) return;
      redirected = true;
      window.location.replace(LOGIN_URL);
    };

    const run = async () => {
      try {
        setDetail('Clearing local session…');

        for (const key of STORAGE_KEYS) {
          localStorage.removeItem(key);
        }

        sessionStorage.clear();
      } catch {
        // Best effort only.
      }

      try {
        setDetail('Clearing browser cookies…');

        for (const cookie of COOKIE_NAMES) {
          clearCookieBestEffort(cookie);
        }
      } catch {
        // Best effort only.
      }

      try {
        setDetail('Closing server session…');

        await fetch('/api/auth/logout', {
          method: 'POST',
          cache: 'no-store',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reason: 'clinician_logout' }),
        });
      } catch {
        // Do not trap user on logout page.
      }

      setDetail('Redirecting to sign in…');
      window.setTimeout(goLogin, 250);
    };

    run();

    const fallback = window.setTimeout(goLogin, 2500);

    return () => window.clearTimeout(fallback);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(900px_circle_at_18%_-10%,rgba(15,23,42,0.08),transparent_58%),radial-gradient(850px_circle_at_100%_0%,rgba(99,102,241,0.12),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.9),rgba(248,250,252,1))] px-6">
      <section className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white/85 p-6 text-center shadow-sm shadow-black/[0.06] backdrop-blur">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <LogOut className="h-5 w-5 text-slate-700" />
        </div>

        <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-950">
          Signing you out…
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          Please wait while we close your clinician session securely.
        </p>

        <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          {detail}
        </div>
      </section>
    </main>
  );
}
