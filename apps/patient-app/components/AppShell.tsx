// apps/patient-app/components/AppShell.tsx
'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import Sidebar from './Sidebar';
import ActiveEncounterPicker from './context/ActiveEncounterPicker';

function isUnder(pathname: string, base: string) {
  if (base === '/') return pathname === '/';
  return pathname === base || pathname.startsWith(base + '/');
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';

  // Fullscreen/public experiences: no sidebar, no topbar.
  const hideAllChrome =
    isUnder(pathname, '/app/auth') ||
    isUnder(pathname, '/auth') ||
    isUnder(pathname, '/sfu') ||
    isUnder(pathname, '/app/sfu') ||
    isUnder(pathname, '/privacy');

  // Televisit: no sidebar, but keep topbar.
  const hideSidebarOnly =
    isUnder(pathname, '/televisit') || isUnder(pathname, '/app/televisit');

  const showTopbar = !hideAllChrome;
  const showSidebar = !hideAllChrome && !hideSidebarOnly;

  return (
    <div className="min-h-screen bg-slate-50">
      {showTopbar ? (
        <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/76 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
            <Link
              href="/"
              className="inline-flex min-w-0 items-center rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25"
              aria-label="Ambulant+ home"
            >
              <img
                src="/brand/ambulant-logo-full@2x.png"
                alt="Ambulant+"
                className="h-7 w-auto select-none object-contain opacity-100"
                draggable={false}
              />
            </Link>

            <div className="ml-auto flex items-center gap-2">
              <ActiveEncounterPicker />
              <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 sm:inline-flex">
                Patient plan active
              </span>
            </div>
          </div>
        </header>
      ) : null}

      {showSidebar ? (
        <div className="mx-auto flex max-w-7xl gap-6 px-3 py-4 md:px-4">
          <Sidebar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      ) : (
        <main className={showTopbar ? 'mx-auto max-w-7xl px-3 py-4 md:px-4' : ''}>
          {children}
        </main>
      )}
    </div>
  );
}