// apps/clinician-app/components/ClinicianChrome.tsx
'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import InboxBell from '@/components/InboxBell';
import ClinicianSidebar from '@/components/ClinicianSidebar';

const SIDEBAR_EXCLUDED_PREFIXES = [
  '/auth/login',
  '/auth/signup',
  '/auth/forgot',
  '/auth/reset',
  '/auth/logout',
];

export default function ClinicianChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const hideChrome = useMemo(() => {
    const p = pathname || '';
    return SIDEBAR_EXCLUDED_PREFIXES.some(
      (prefix) => p === prefix || p.startsWith(prefix + '/'),
    );
  }, [pathname]);

  // ✅ Auth pages: no header, no sidebar
  if (hideChrome) {
    return (
      <div className="min-h-[calc(100vh-56px)]">
        <main className="min-h-[calc(100vh-56px)]">{children}</main>
      </div>
    );
  }

  // ✅ App pages: header + sidebar + main
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
