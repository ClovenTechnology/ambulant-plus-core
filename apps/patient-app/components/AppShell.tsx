'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';

import Sidebar from './Sidebar';
import ActiveEncounterPicker from './context/ActiveEncounterPicker';

function isUnder(pathname: string, base: string) {
  if (base === '/') return pathname === '/';
  return pathname === base || pathname.startsWith(base + '/');
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-slate-50">
      {showTopbar ? (
        <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 sm:px-4">
            {showSidebar ? (
              <button
                type="button"
                data-p-ui="patient-mobile-menu-trigger"
                onClick={() => setMobileSidebarOpen(true)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 lg:hidden"
                aria-label="Open patient menu"
                aria-expanded={mobileSidebarOpen}
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : null}

            <Link
              href="/"
              className="inline-flex min-w-0 items-center rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25"
              aria-label="Ambulant+ home"
            >
              <img
                src="/brand/ambulant-logo-full@2x.png"
                alt="Ambulant+"
                className="h-7 w-auto max-w-[145px] select-none object-contain opacity-100 sm:max-w-none"
                draggable={false}
              />
            </Link>

            <div className="ml-auto flex min-w-0 items-center gap-2">
              <ActiveEncounterPicker />
              <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 sm:inline-flex">
                Patient plan active
              </span>
            </div>
          </div>
        </header>
      ) : null}

      {showSidebar ? (
        <>
          <Sidebar
            variant="mobile"
            mobileOpen={mobileSidebarOpen}
            onMobileClose={() => setMobileSidebarOpen(false)}
          />

          <div className="mx-auto flex max-w-7xl gap-0 px-3 py-4 sm:px-4 lg:gap-6">
            <Sidebar variant="desktop" />
            <main data-p-ui="patient-page-safety" className="min-w-0 flex-1">{children}</main>
          </div>
        </>
      ) : (
        <main data-p-ui="patient-page-safety" className={showTopbar ? 'mx-auto max-w-7xl px-3 py-4 sm:px-4' : ''}>
          {children}
        </main>
      )}
    </div>
  );
}
