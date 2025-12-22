// apps/clinician-app/components/ClinicianSidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Sun,
  CalendarDays,
  Calendar,
  Users,
  Building2,
  LayoutGrid,
  BarChart3,
  ShoppingBag,
  Video,
  ClipboardList,
  Brain,
  Receipt,
  WalletCards,
  Store,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Dot,
} from 'lucide-react';

type NavItem = {
  href: string;
  label: string;
  icon?: LucideIcon;
};

type NavGroup = {
  key: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

type NavSection = {
  key: string;
  label: string;
  groups: NavGroup[];
};

const COLLAPSE_KEY = 'clinician.sidebar-collapsed';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function normalizeCollapsed(raw: string | null) {
  if (!raw) return false;
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export default function ClinicianSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(COLLAPSE_KEY);
      setCollapsed(normalizeCollapsed(raw));
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // store as '1' / '0' (ClinicianShell style), but still read legacy 'true'
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {}
  }, [collapsed]);

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const sections: NavSection[] = useMemo(
    () => [
      {
        key: 'workspace',
        label: 'Workspace',
        groups: [
          {
            key: 'workspace-main',
            label: 'Workspace',
            icon: LayoutDashboard,
            items: [
              { href: '/', label: 'Home', icon: LayoutDashboard },
              { href: '/today', label: 'Today', icon: Sun },
              { href: '/appointments', label: 'Appointments', icon: CalendarDays },
              { href: '/calendar', label: 'Calendar', icon: Calendar },
              { href: '/patients', label: 'Patients', icon: Users },

              // ✅ requested additions
              { href: '/practices', label: 'Teams & Practices', icon: Building2 },
              { href: '/workspaces', label: 'Specialist Workspaces', icon: LayoutGrid },
              { href: '/analytics/me', label: 'Analytics', icon: BarChart3 },
            ],
          },
        ],
      },
      {
        key: 'care',
        label: 'Care',
        groups: [
          {
            key: 'televisit',
            label: 'Televisit',
            icon: Video,
            items: [
              { href: '/lobby', label: 'Lobby', icon: Video },
              { href: '/televisit/join', label: 'Join', icon: Video },
            ],
          },
          {
            key: 'encounters',
            label: 'Encounters',
            icon: ClipboardList,
            items: [
              { href: '/encounters', label: 'All', icon: ClipboardList },
              { href: '/encounters/open', label: 'Open' },
              { href: '/encounters/referred', label: 'Referred' },
              { href: '/encounters/closed', label: 'Closed' },
            ],
          },
        ],
      },
      {
        key: 'orders',
        label: 'Orders',
        groups: [
          {
            key: 'orders',
            label: 'Orders & Logistics',
            icon: ShoppingBag,
            items: [
              { href: '/orders', label: 'All Orders', icon: ShoppingBag },
              { href: '/careport', label: 'CarePort' },
              { href: '/medreach', label: 'MedReach' },
            ],
          },
        ],
      },
      {
        key: 'business',
        label: 'Business',
        groups: [
          {
            key: 'business',
            label: 'Business',
            icon: WalletCards,
            items: [
              { href: '/insightcore', label: 'InsightCore', icon: Brain },
              { href: '/claims', label: 'Claims', icon: Receipt },
              { href: '/payout', label: 'Payouts & Plan', icon: WalletCards },
              { href: '/shop', label: 'Shop', icon: Store },
            ],
          },
        ],
      },
      {
        key: 'settings',
        label: 'Settings',
        groups: [
          {
            key: 'settings',
            label: 'Settings',
            icon: Settings,
            items: [
              { href: '/settings/profile', label: 'Profile', icon: Settings },
              { href: '/settings/admin-staff', label: 'Admin Staff' },
              { href: '/settings/consult', label: 'Consult' },
              { href: '/settings/fees', label: 'Fees' },
              { href: '/settings/schedule', label: 'Schedule' },
              { href: '/settings', label: 'All Settings' },
            ],
          },
        ],
      },
    ],
    [],
  );

  function NavLinkRow(props: { item: NavItem; depth?: 0 | 1 }) {
    const { item, depth = 0 } = props;
    const active = isActive(item.href);
    const Icon = item.icon ?? (depth === 1 ? Dot : LayoutDashboard);

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          title={collapsed ? item.label : undefined}
          aria-current={active ? 'page' : undefined}
          className={cx(
            'group flex items-center rounded-lg text-xs transition-colors',
            collapsed ? 'justify-center px-2 py-2' : 'px-2 py-1.5',
            !collapsed && depth === 1 && 'ml-6',
            active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100',
          )}
        >
          <Icon
            className={cx(
              'shrink-0',
              depth === 1 ? 'h-3.5 w-3.5' : 'h-4 w-4',
              active ? 'text-white' : depth === 1 ? 'text-slate-400 group-hover:text-slate-500' : 'text-slate-500',
            )}
          />
          {!collapsed && <span className="ml-2 truncate">{item.label}</span>}
        </Link>
      </li>
    );
  }

  function SectionBlock(section: NavSection) {
    return (
      <div key={section.key} className="space-y-2">
        {!collapsed && (
          <div className="px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {section.label}
          </div>
        )}

        <div className="space-y-2">
          {section.groups.map((g) => (
            <div key={g.key} className="space-y-1">
              {/* group label (only in expanded mode) */}
              {!collapsed && section.groups.length > 1 && (
                <div className="px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-2">
                  <g.icon className="h-3.5 w-3.5 text-slate-400" />
                  <span>{g.label}</span>
                </div>
              )}

              <ul className="space-y-0.5">
                {g.items.map((it) => (
                  <NavLinkRow key={it.href} item={it} depth={it.icon ? 0 : 1} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <aside
      className={cx(
        'shrink-0 border-r border-slate-200 bg-white/90 backdrop-blur-sm',
        'transition-all duration-200 flex flex-col',
        // keeps compatibility with your existing layout header height
        'h-[calc(100vh-56px)]',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Brand + collapse */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200">
        <Link href="/" className="flex items-center gap-2" aria-label="Ambulant+ Clinician Home">
          <div className="h-8 w-8 rounded-xl bg-slate-900 flex items-center justify-center text-xs font-bold text-white">
            A+
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-semibold text-slate-900">Ambulant+</span>
              <span className="text-[10px] text-slate-500">Clinician Console</span>
            </div>
          )}
        </Link>

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3" aria-label="Clinician navigation">
        <div className="flex flex-col gap-4 px-2">
          {sections.map((s) => SectionBlock(s))}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200 p-2 space-y-1">
        <Link
          href="/signout"
          title={collapsed ? 'Sign Out' : undefined}
          className={cx(
            'flex items-center rounded-lg text-xs transition-colors',
            collapsed ? 'justify-center px-2 py-2' : 'px-2 py-2',
            'text-slate-700 hover:bg-slate-100',
          )}
        >
          <LogOut className="h-4 w-4 text-slate-500" />
          {!collapsed && <span className="ml-2">Sign Out</span>}
        </Link>

        {!collapsed && (
          <div className="pt-1 px-2 text-[10px] text-slate-500">
            Powered by <span className="font-semibold">Ambulant+ InsightCore</span>
          </div>
        )}
      </div>
    </aside>
  );
}
