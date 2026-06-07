// apps/clinician-app/components/ClinicianChrome.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';

import InboxBell from '@/components/InboxBell';
import ClinicianSidebar from '@/components/ClinicianSidebar';

const CHROME_EXCLUDED_PREFIXES = [
  '/auth/login',
  '/auth/signup',
  '/auth/forgot',
  '/auth/reset',
  '/auth/logout',
  '/logout',
  '/sign-out',
  '/training',
];

function isExcludedPath(pathname?: string | null) {
  const p = pathname || '';
  return CHROME_EXCLUDED_PREFIXES.some(
    (prefix) => p === prefix || p.startsWith(prefix + '/'),
  );
}

function safeNext(pathname?: string | null) {
  const p = pathname || '/';
  return p.startsWith('/') && !p.startsWith('//') ? p : '/';
}

function trainingUrl(params: {
  clinicianId?: string | null;
  next?: string | null;
}) {
  const qs = new URLSearchParams();
  if (params.clinicianId) qs.set('clinicianId', params.clinicianId);
  qs.set('reason', 'training_required');
  qs.set('next', safeNext(params.next));
  return `/training/schedule?${qs.toString()}`;
}

function loginUrl(next?: string | null) {
  const qs = new URLSearchParams();
  qs.set('next', safeNext(next));
  return `/auth/login?${qs.toString()}`;
}

type GateState =
  | { status: 'checking' }
  | { status: 'allowed' }
  | { status: 'redirecting'; message: string }
  | { status: 'error'; message: string };

export default function ClinicianChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome = useMemo(() => isExcludedPath(pathname), [pathname]);
  const [gate, setGate] = useState<GateState>({ status: 'checking' });

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      if (hideChrome) {
        setGate({ status: 'allowed' });
        return;
      }

      setGate({ status: 'checking' });

      try {
        const res = await fetch('/api/me', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
          headers: { accept: 'application/json' },
        });

        const data = await res.json().catch(() => null);

        if (cancelled) return;

        if (res.status === 401 || res.status === 403 || !data?.ok) {
          setGate({ status: 'redirecting', message: 'Redirecting to sign in…' });
          window.location.replace(loginUrl(pathname));
          return;
        }

        const role = String(data?.role || '').toLowerCase();
        const canPractice =
          data?.canPractice === true ||
          role === 'admin' ||
          role === 'admin_staff';

        if (!canPractice) {
          const clinicianId =
            data?.clinicianId ||
            data?.clinician?.id ||
            data?.clinician?.clinicianId ||
            null;

          setGate({
            status: 'redirecting',
            message: 'Training is required before workspace access…',
          });

          window.location.replace(
            trainingUrl({
              clinicianId: clinicianId ? String(clinicianId) : null,
              next: pathname,
            }),
          );
          return;
        }

        setGate({ status: 'allowed' });
      } catch {
        if (cancelled) return;

        setGate({
          status: 'error',
          message: 'Unable to verify your clinician access. Please sign in again.',
        });

        window.setTimeout(() => {
          window.location.replace(loginUrl(pathname));
        }, 900);
      }
    }

    checkAccess();

    return () => {
      cancelled = true;
    };
  }, [hideChrome, pathname]);

  if (gate.status !== 'allowed') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <section className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white">
            {gate.status === 'error' ? (
              <ShieldAlert className="h-5 w-5 text-amber-700" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-slate-700" />
            )}
          </div>

          <h1 className="mt-5 text-xl font-black tracking-tight text-slate-950">
            Checking clinician access…
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            {gate.status === 'checking'
              ? 'Please wait while we verify your training and workspace eligibility.'
              : gate.message}
          </p>
        </section>
      </main>
    );
  }

  if (hideChrome) {
    return (
      <div className="min-h-[calc(100vh-56px)]">
        <main className="min-h-[calc(100vh-56px)]">{children}</main>
      </div>
    );
  }

  return (
    <>
      <header className="h-14 border-b bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-[1400px] h-full px-4 flex items-center gap-4">
          <Link href="/today" className="font-semibold tracking-tight">
            Ambulant+
          </Link>

          <nav className="hidden md:flex items-center gap-3 text-sm text-black/70">
            <Link className="hover:text-black" href="/today">
              Today
            </Link>
            <span className="text-black/20">•</span>
            <Link className="hover:text-black" href="/appointments">
              Appointments
            </Link>
            <span className="text-black/20">•</span>
            <Link className="hover:text-black" href="/calendar">
              Calendar
            </Link>
            <span className="text-black/20">•</span>
            <Link className="hover:text-black" href="/patients">
              Patients
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <InboxBell clinicianId="clin-za-001" />
          </div>
        </div>
      </header>

      <div className="min-h-[calc(100vh-56px)]">
        <div className="mx-auto max-w-[1400px] flex min-h-[calc(100vh-56px)]">
          <ClinicianSidebar />
          <main className="flex-1 min-w-0 p-4 lg:p-6">{children}</main>
        </div>
      </div>

      <div className="scanline pointer-events-none" />
    </>
  );
}
