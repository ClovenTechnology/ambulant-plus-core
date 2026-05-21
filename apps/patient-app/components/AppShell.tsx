// apps/patient-app/components/AppShell.tsx
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

import Sidebar from './Sidebar';
import PlanToggle from './PlanToggle';
import ActiveEncounterPicker from './context/ActiveEncounterPicker';

const BRAND_FULL_WEBP = '/brand/ambulant-logo-full.webp';
const BRAND_FULL_PNG = '/brand/ambulant-logo-full.png';
const BRAND_MARK_WEBP = '/brand/ambulant-mark.webp';
const BRAND_MARK_PNG = '/brand/ambulant-mark.png';

function isUnder(pathname: string, base: string) {
  if (base === '/') return pathname === '/';
  return pathname === base || pathname.startsWith(`${base}/`);
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function AmbulantBrand({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-cyan-100 bg-white shadow-sm">
          <picture>
            <source srcSet={BRAND_MARK_WEBP} type="image/webp" />
            <img
              src={BRAND_MARK_PNG}
              alt=""
              className="h-7 w-7 object-contain"
              draggable={false}
            />
          </picture>
        </span>
        <span className="min-w-0 truncate text-sm font-black tracking-tight text-slate-950">
          Ambulant<span className="text-cyan-600">+</span>
        </span>
      </span>
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-100 bg-white shadow-sm">
        <picture>
          <source srcSet={BRAND_MARK_WEBP} type="image/webp" />
          <img
            src={BRAND_MARK_PNG}
            alt=""
            className="h-8 w-8 object-contain"
            draggable={false}
          />
        </picture>
      </span>

      <span className="hidden min-w-0 sm:block">
        <picture>
          <source srcSet={BRAND_FULL_WEBP} type="image/webp" />
          <img
            src={BRAND_FULL_PNG}
            alt="Ambulant+ Contactless Medicine"
            className="h-9 w-auto max-w-[188px] object-contain"
            draggable={false}
          />
        </picture>
      </span>
    </span>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const hideAllChrome =
    isUnder(pathname, '/app/auth') ||
    isUnder(pathname, '/auth') ||
    isUnder(pathname, '/sfu') ||
    isUnder(pathname, '/app/sfu') ||
    isUnder(pathname, '/privacy');

  const hideSidebarOnly =
    isUnder(pathname, '/televisit') || isUnder(pathname, '/app/televisit');

  const showTopbar = !hideAllChrome;
  const showSidebar = !hideAllChrome && !hideSidebarOnly;

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_48%,#f8faff_100%)] text-slate-950">
      {showTopbar ? (
        <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/78 backdrop-blur-2xl supports-[backdrop-filter]:bg-white/68">
          <div className="mx-auto flex h-16 w-full max-w-[1680px] items-center gap-3 px-4 sm:px-5 lg:h-14 lg:px-6">
            {showSidebar ? (
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-cyan-200 hover:text-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 lg:hidden"
                aria-label="Open navigation menu"
                aria-expanded={mobileNavOpen}
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : null}

            <Link
              href="/"
              className="inline-flex min-w-0 items-center rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
              aria-label="Go to Ambulant+ home"
            >
              <AmbulantBrand />
            </Link>

            <div className="ml-auto flex min-w-0 items-center gap-2">
              <div className="hidden min-w-0 sm:block">
                <ActiveEncounterPicker />
              </div>
              <PlanToggle />
            </div>
          </div>
        </header>
      ) : null}

      {showSidebar ? (
        <>
          <div className="mx-auto flex w-full max-w-[1680px] gap-5 px-3 py-4 sm:px-4 lg:px-6">
            <div className="hidden shrink-0 lg:block">
              <Sidebar mode="desktop" />
            </div>

            <main className="min-w-0 flex-1">{children}</main>
          </div>

          {mobileNavOpen ? (
            <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
              <button
                type="button"
                className="absolute inset-0 bg-slate-950/34 backdrop-blur-sm"
                aria-label="Close navigation menu"
                onClick={() => setMobileNavOpen(false)}
              />

              <aside className="absolute inset-y-0 left-0 flex w-[min(90vw,23rem)] flex-col border-r border-slate-200 bg-white shadow-2xl">
                <div className="flex h-16 items-center justify-between gap-3 border-b border-slate-100 px-4">
                  <Link
                    href="/"
                    className="inline-flex min-w-0 items-center rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
                    aria-label="Go to Ambulant+ home"
                  >
                    <AmbulantBrand compact />
                  </Link>

                  <button
                    type="button"
                    onClick={() => setMobileNavOpen(false)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-cyan-200 hover:text-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
                    aria-label="Close navigation menu"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  <Sidebar mode="mobile" onNavigate={() => setMobileNavOpen(false)} />
                </div>
              </aside>
            </div>
          ) : null}
        </>
      ) : (
        <main
          className={cx(
            showTopbar && 'mx-auto w-full max-w-[1680px] px-3 py-4 sm:px-4 lg:px-6',
          )}
        >
          {children}
        </main>
      )}
    </div>
  );
}
