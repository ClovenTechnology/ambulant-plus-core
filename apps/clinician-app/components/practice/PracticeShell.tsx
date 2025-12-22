// apps/clinician-app/components/practice/PracticeShell.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  BarChart2,
  FileText,
  Banknote,
  Settings,
  IdCard,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ClinicianShell } from '@/components/ClinicianShell';

type PracticeShellProps = {
  children: React.ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: '/practice/today',
    label: 'Today',
    description: 'Practice-wide agenda & sessions',
    icon: LayoutDashboard,
  },
  {
    href: '/practice/members',
    label: 'Members',
    description: 'Clinicians, nurses & admin staff',
    icon: Users,
  },
  {
    href: '/practice/cases',
    label: 'Cases',
    description: 'Open & closed cases across practice',
    icon: Stethoscope,
  },
  {
    href: '/practice/analytics',
    label: 'Analytics',
    description: 'Volumes, punctuality & trends',
    icon: BarChart2,
  },
  {
    href: '/practice/claims',
    label: 'Claims',
    description: 'Funding, vouchers & insurers',
    icon: FileText,
  },
  {
    href: '/practice/payout',
    label: 'Payouts',
    description: 'Practice revenue & splits',
    icon: Banknote,
  },
  {
    href: '/practice/profile',
    label: 'Profile',
    description: 'Public profile & branding',
    icon: IdCard,
  },
  {
    href: '/practice/settings',
    label: 'Settings',
    description: 'Departments, services & rules',
    icon: Settings,
  },
];

export function PracticeShell({ children }: PracticeShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Simple check so highlighting works on nested routes like /practice/members/[id]
  function isActive(href: string) {
    if (!pathname) return false;
    if (href === '/practice/today' && pathname === '/practice') return true;
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <ClinicianShell>
      <div className="flex h-[calc(100vh-56px)] min-h-[540px] overflow-hidden bg-slate-50">
        {/* Sideways practice nav */}
        <aside
          className={`relative flex flex-col border-r bg-white transition-all duration-200 ${
            collapsed ? 'w-16' : 'w-72'
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Practice
              </span>
              {!collapsed && (
                <span className="text-xs text-slate-400">
                  Host / clinic_enterprise module
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border bg-white text-slate-500 hover:bg-slate-50"
              aria-label={collapsed ? 'Expand practice navigation' : 'Collapse practice navigation'}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-2 text-sm">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'mb-1 flex items-center gap-2 rounded-md px-2 py-2 transition',
                    active
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                      : 'text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100">
                    <Icon
                      className={
                        active
                          ? 'h-4 w-4 text-indigo-700'
                          : 'h-4 w-4 text-slate-500'
                      }
                    />
                  </span>
                  {!collapsed && (
                    <span className="flex flex-1 flex-col">
                      <span className="text-[13px] font-medium">
                        {item.label}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {item.description}
                      </span>
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="border-t px-3 py-2 text-[11px] text-slate-400">
            {!collapsed ? (
              <>
                Practice view is primarily for{' '}
                <span className="font-medium">Host / clinic_enterprise</span>{' '}
                plans. It will honour your practice roles & visibility rules.
              </>
            ) : (
              <span>Host</span>
            )}
          </div>
        </aside>

        {/* Main practice content area */}
        <section className="flex-1 overflow-y-auto">
          <div className="mx-auto h-full max-w-6xl p-4 md:p-6">
            {children}
          </div>
        </section>
      </div>
    </ClinicianShell>
  );
}
