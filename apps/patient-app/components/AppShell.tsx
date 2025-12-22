'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import Sidebar from './Sidebar';
import PlanToggle from './PlanToggle';
import ActiveEncounterPicker from './ActiveEncounterPicker';

function isUnder(pathname: string, base: string) {
  if (base === '/') return pathname === '/';
  return pathname === base || pathname.startsWith(base + '/');
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';

  // Fullscreen experiences: no sidebar, no topbar
  const hideAllChrome =
    isUnder(pathname, '/app/auth') ||
    isUnder(pathname, '/auth') ||
    isUnder(pathname, '/sfu') ||
    isUnder(pathname, '/app/sfu') ||
    // Treat privacy like auth/legal standalone page (no sidebar, no topbar)
    isUnder(pathname, '/privacy');

  // Televisit: no sidebar, but keep topbar
  const hideSidebarOnly = isUnder(pathname, '/televisit') || isUnder(pathname, '/app/televisit');

  const showTopbar = !hideAllChrome;
  const showSidebar = !hideAllChrome && !hideSidebarOnly;

  return (
    <div className="min-h-screen bg-slate-50">
      {showTopbar ? (
        <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-3">
            <Link href="/" className="font-black tracking-tight text-slate-950 hover:opacity-90">
              Ambulant<span className="text-emerald-600">+</span>
            </Link>

            <div className="ml-auto flex items-center gap-2">
              <ActiveEncounterPicker />
              <PlanToggle />
            </div>
          </div>
        </header>
      ) : null}

      {showSidebar ? (
        <div className="mx-auto max-w-7xl flex gap-6 px-3 md:px-4 py-4">
          <Sidebar />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      ) : (
        // No sidebar layout (auth / sfu / privacy / televist-without-sidebar)
        <main className={showTopbar ? 'mx-auto max-w-7xl px-3 md:px-4 py-4' : ''}>{children}</main>
      )}
    </div>
  );
}
