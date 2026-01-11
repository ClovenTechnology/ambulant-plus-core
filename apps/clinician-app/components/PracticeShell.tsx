// apps/clinician-app/components/PracticeShell.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  CalendarDays,
  Users,
  ClipboardList,
  FileText,
  Receipt,
  Wallet,
  LineChart,
  Settings,
  BadgeCheck,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { href: '/practice', label: 'Overview', icon: Building2, exact: true },
      { href: '/practice/today', label: 'Today', icon: CalendarDays },
      { href: '/practice/members', label: 'Team', icon: Users },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/practice/cases', label: 'Cases', icon: ClipboardList },
      { href: '/practice/claims', label: 'Claims', icon: Receipt },
      { href: '/practice/payout', label: 'Payouts', icon: Wallet },
    ],
  },
  {
    label: 'Insights',
    items: [{ href: '/practice/analytics', label: 'Analytics', icon: LineChart }],
  },
  {
    label: 'Admin',
    items: [
      { href: '/practice/profile', label: 'Practice profile', icon: BadgeCheck },
      { href: '/practice/settings', label: 'Settings', icon: Settings },
      { href: '/practice/claims', label: 'Funding rules', icon: FileText, badge: 'WIP' },
    ],
  },
];

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

function findActiveLabel(pathname: string) {
  // pick the longest matching href (best match)
  let best: { href: string; label: string; len: number } | null = null;

  for (const g of NAV_GROUPS) {
    for (const it of g.items) {
      const ok = isActive(pathname, it);
      if (!ok) continue;
      const len = it.href.length;
      if (!best || len > best.len) best = { href: it.href, label: it.label, len };
    }
  }

  if (best) return best.label;
  if (pathname.startsWith('/practice')) return 'Practice';
  return 'Workspace';
}

export function PracticeShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem('ambulant.practice.sidebar.collapsed');
      if (v === '1') setCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  const activeLabel = useMemo(() => findActiveLabel(pathname), [pathname]);

  const toggle = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem('ambulant.practice.sidebar.collapsed', next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside
          className={cx(
            'sticky top-0 h-screen border-r border-slate-200 bg-white/90 backdrop-blur',
            collapsed ? 'w-[84px]' : 'w-[300px]',
          )}
        >
          <div className="flex h-full flex-col">
            {/* Brand / header */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-3">
              <Link href="/practice" className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                  <Building2 className="h-5 w-5 text-slate-900" />
                </div>
                {!collapsed ? (
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-black text-slate-900">
                        Practice Workspace
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700">
                        <Sparkles className="h-3 w-3" />
                        Host
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-slate-500">
                      Multi-clinician ops & funding
                    </div>
                  </div>
                ) : null}
              </Link>

              <button
                type="button"
                onClick={toggle}
                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-2 py-3">
              {NAV_GROUPS.map((g) => (
                <div key={g.label} className="mb-4">
                  {!collapsed ? (
                    <div className="px-2 pb-2 text-[11px] font-black text-slate-500">
                      {g.label}
                    </div>
                  ) : (
                    <div className="pb-2" />
                  )}

                  <ul className="space-y-1">
                    {g.items.map((it) => {
                      const active = isActive(pathname, it);
                      const Icon = it.icon;
                      return (
                        <li key={it.href}>
                          <Link
                            href={it.href}
                            className={cx(
                              'group flex items-center gap-3 rounded-2xl border px-3 py-2 text-xs font-extrabold transition',
                              active
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50',
                              collapsed && 'justify-center px-2',
                            )}
                            title={collapsed ? it.label : undefined}
                          >
                            <Icon className={cx('h-4 w-4', active ? 'text-white' : 'text-slate-700')} />
                            {!collapsed ? (
                              <div className="flex w-full items-center justify-between gap-2">
                                <span className="truncate">{it.label}</span>
                                {it.badge ? (
                                  <span
                                    className={cx(
                                      'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold',
                                      active
                                        ? 'border-white/30 bg-white/10 text-white'
                                        : 'border-slate-200 bg-slate-50 text-slate-600',
                                    )}
                                  >
                                    {it.badge}
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>

            {/* Footer */}
            <div className="border-t border-slate-200 p-3">
              <Link
                href="/today"
                className={cx(
                  'flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50',
                  collapsed && 'justify-center px-2',
                )}
                title={collapsed ? 'Back to clinician workspace' : undefined}
              >
                <ArrowLeft className="h-4 w-4" />
                {!collapsed ? <span>Back to clinician workspace</span> : null}
              </Link>

              {!collapsed ? (
                <div className="mt-2 text-[11px] text-slate-500">
                  Practice workspace is for multi-member clinics (roles, funding, payouts, analytics).
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
            <div className="mx-auto w-full max-w-[1280px] px-4 py-3 lg:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-[220px]">
                  <div className="text-[11px] font-black text-slate-500">Practice workspace</div>
                  <div className="text-sm font-extrabold text-slate-900">{activeLabel}</div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href="/practice/members"
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-extrabold text-white hover:bg-slate-800"
                  >
                    <Users className="h-4 w-4" />
                    Team
                  </Link>
                  <Link
                    href="/practice/settings"
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <main className="mx-auto w-full max-w-[1280px] px-4 py-6 lg:px-6 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
