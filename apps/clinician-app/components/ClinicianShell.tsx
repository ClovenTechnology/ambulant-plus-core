// apps/clinician-app/components/ClinicianShell.tsx
'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Stethoscope,
  FileText,
  WalletCards,
  Store,
  Settings,
  HeartPulse,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavGroup = {
  key: string;
  label: string;
  items: NavItem[];
};

const COLLAPSE_KEY = 'clinician.sidebar-collapsed';

// Exclude these routes from showing the sidebar shell UI
const SIDEBAR_EXCLUDED_PREFIXES = [
  '/auth/login',
  '/auth/signup',
  '/auth/forgot',
  '/auth/reset',
  '/auth/logout',
];

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function ClinicianShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const hideShellChrome = useMemo(() => {
    const p = pathname || '';
    return SIDEBAR_EXCLUDED_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix + '/'));
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(COLLAPSE_KEY);
    if (raw === '1') setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      }
      return next;
    });
  };

  const nav: NavGroup[] = useMemo(
    () => [
      {
        key: 'workspace',
        label: 'Workspace',
        items: [
          { href: '/', label: 'Landing', icon: LayoutDashboard },
          { href: '/today', label: 'Today', icon: CalendarDays },
          { href: '/appointments', label: 'Appointments', icon: HeartPulse },
          { href: '/encounters', label: 'Encounters', icon: Stethoscope },
          { href: '/practice', label: 'My Practice', icon: Users },
          { href: '/claims', label: 'Claims', icon: FileText },
          { href: '/payout', label: 'Payouts & Plan', icon: WalletCards },
          { href: '/shop', label: 'Shop', icon: Store },
        ],
      },
      {
        key: 'settings',
        label: 'Settings',
        items: [{ href: '/settings/profile', label: 'Profile & Practice', icon: Settings }],
      },
    ],
    [],
  );

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || (pathname || '').startsWith(href + '/');
  };

  // ✅ Auth routes: render page content without sidebar/top chrome
  if (hideShellChrome) {
    return <div className="min-h-screen bg-slate-50 text-slate-900">{children}</div>;
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside
        className={classNames(
          'flex h-screen flex-col border-r border-slate-200 bg-white/90 backdrop-blur-sm sticky top-0 z-20 transition-all duration-200',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {/* Logo + collapse */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-slate-900 flex items-center justify-center text-xs font-bold text-white">
              A+
            </div>
            {!collapsed && (
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-semibold text-slate-900">Ambulant+</span>
                <span className="text-[10px] text-slate-500">Clinician Console</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-3">
          <div className="flex flex-col gap-4 px-2">
            {nav.map((group) => (
              <div key={group.key} className="space-y-1">
                {!collapsed && (
                  <div className="px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {group.label}
                  </div>
                )}
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={classNames(
                            'flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors',
                            active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100',
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        {/* Footer hint */}
        <div className="border-t border-slate-200 px-2 py-2 text-[10px] text-slate-500">
          {!collapsed && (
            <div className="line-clamp-2">
              Powered by <span className="font-semibold">Ambulant+ InsightCore</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-screen flex-1 flex-col">
        {/* Optional top bar (kept minimal) */}
        <header className="h-10 border-b border-slate-200 bg-white/60 backdrop-blur-sm flex items-center justify-end px-4 text-[11px] text-slate-500">
          <span>Signed in as clinician</span>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

export default ClinicianShell;
