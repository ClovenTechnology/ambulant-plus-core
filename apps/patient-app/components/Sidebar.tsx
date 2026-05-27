// apps/patient-app/components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Baby,
  Bell,
  Box,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Dumbbell,
  FileText,
  Heart,
  HeartPulse,
  Home,
  LineChart,
  LogOut,
  Pill,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Stethoscope,
  Store,
  UserCircle,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

type Group = {
  key: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: Item[];
};

const CORE: Item[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/profile', label: 'Profile', icon: UserCircle },
  { href: '/appointments', label: 'Appointments', icon: Calendar },
  { href: '/clinicians', label: 'Clinicians', icon: Stethoscope },
  { href: '/practices', label: 'Clinics & hospitals', icon: Building2 },
  { href: '/televisit', label: 'Televisit', icon: Video },
];

const GROUPS: Group[] = [
  {
    key: 'care',
    title: 'Care workspace',
    icon: ShieldCheck,
    items: [
      { href: '/myCare', label: 'myCare', icon: ClipboardList },
      { href: '/self-check', label: 'Self-check', icon: Activity },
      { href: '/medical-records', label: 'Health records', icon: FileText },
      { href: '/encounters', label: 'Encounters', icon: ClipboardCheck },
      { href: '/allergies', label: 'Allergies', icon: Heart },
    ],
  },
  {
    key: 'vitals',
    title: 'Vitals & reports',
    icon: HeartPulse,
    items: [
      { href: '/iomt', label: 'IoMT console', icon: HeartPulse },
      { href: '/vitals', label: 'Vitals', icon: HeartPulse },
      { href: '/charts', label: 'Charts', icon: LineChart },
      { href: '/reports', label: 'Reports', icon: FileText },
      { href: '/reports/sleep', label: 'Sleep report', icon: LineChart },
      { href: '/reports/stress', label: 'Stress report', icon: LineChart },
    ],
  },
  {
    key: 'meds',
    title: 'Medicines & delivery',
    icon: Pill,
    items: [
      { href: '/medications', label: 'Medications', icon: Pill },
      { href: '/reminder', label: 'Reminders', icon: Bell },
      { href: '/careport', label: 'CarePort', icon: ShoppingCart },
      { href: '/orders', label: 'Orders', icon: Box },
      { href: '/medreach', label: 'MedReach', icon: Radio },
      { href: '/medreach/timeline', label: 'MedReach timeline', icon: Radio },
    ],
  },
  {
    key: 'health-programmes',
    title: 'Health programmes',
    icon: Sparkles,
    items: [
      { href: '/lady-center', label: 'Lady Center', icon: UserPlus },
      { href: '/gentlemens-health', label: "Men's Health", icon: Dumbbell },
      { href: '/antenatal-center', label: 'Antenatal Center', icon: Heart },
      { href: '/paediatric-center', label: 'Paediatrics', icon: Baby },
      { href: '/wellness', label: 'Wellness', icon: LineChart },
      { href: '/family', label: 'Family access', icon: Users },
    ],
  },
  {
    key: 'services',
    title: 'Services',
    icon: Store,
    items: [
      { href: '/devices', label: 'Devices', icon: Box },
      { href: '/labs', label: 'Labs', icon: FileText },
      { href: '/shop', label: 'Shop', icon: Store },
      { href: '/tasks', label: 'Tasks', icon: ClipboardCheck },
      { href: '/medical-aids', label: 'Medical aid', icon: ShieldCheck },
    ],
  },
];

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function isMatch(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

function CollapsedHint({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 hidden -translate-y-1/2 group-hover:block">
      <div className="whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-lg shadow-black/10">
        {text}
      </div>
    </div>
  );
}

function BrandMark({ collapsed }: { collapsed: boolean }) {
  return (
    <span
      className={cx(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-100/90 bg-white shadow-[0_10px_28px_rgba(8,145,178,0.12)] ring-1 ring-white/80',
        collapsed ? 'h-11 w-11' : 'h-12 w-12',
      )}
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.18),transparent_45%),linear-gradient(135deg,rgba(255,255,255,0.95),rgba(240,253,250,0.72))]" />
      <img
        src="/brand/ambulant-mark@2x.png"
        alt=""
        aria-hidden="true"
        className={cx(
          'relative z-10 select-none object-contain opacity-100 brightness-110 contrast-125 saturate-150',
          collapsed ? 'h-8 w-8' : 'h-9 w-9',
        )}
        draggable={false}
      />
    </span>
  );
}

function NavRow({
  item,
  active,
  collapsed,
  onClick,
  indent = false,
}: {
  item: Item;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
  indent?: boolean;
}) {
  const Icon = item.icon;

  return (
    <li>
      <Link
        href={item.href}
        onClick={onClick}
        className={cx(
          'group relative flex items-center gap-2 rounded-2xl px-3 py-2 text-sm transition',
          active
            ? 'bg-slate-950 text-white shadow-sm shadow-slate-900/10'
            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950',
          indent && !collapsed && 'pl-5',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25',
        )}
      >
        <span
          className={cx(
            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border transition',
            active
              ? 'border-white/10 bg-white/10'
              : 'border-transparent group-hover:border-slate-200 group-hover:bg-white',
          )}
        >
          <Icon
            className={cx(
              'h-4 w-4',
              active ? 'text-white' : 'text-slate-500 group-hover:text-slate-800',
            )}
          />
        </span>

        {!collapsed ? (
          <>
            <span className="truncate font-extrabold">{item.label}</span>
            {item.badge ? (
              <span className="ml-auto rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                {item.badge}
              </span>
            ) : null}
          </>
        ) : (
          <CollapsedHint text={item.label} />
        )}
      </Link>
    </li>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    care: true,
    vitals: true,
    meds: true,
    'health-programmes': true,
    services: false,
  });
  const [q, setQ] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('sidebar-collapsed');
      if (stored != null) setCollapsed(stored === 'true');
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('sidebar-collapsed', String(collapsed));
    } catch {}
  }, [collapsed]);

  useEffect(() => {
    if (!pathname) return;

    for (const group of GROUPS) {
      if (group.items.some((item) => isMatch(pathname, item.href))) {
        setOpenGroups((prev) => ({ ...prev, [group.key]: true }));
      }
    }
  }, [pathname]);

  const allItems = useMemo(
    () => [
      ...CORE,
      ...GROUPS.flatMap((group) => group.items),
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
    [],
  );

  const searchResults = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];

    return allItems
      .filter(
        (item) =>
          item.label.toLowerCase().includes(needle) ||
          item.href.toLowerCase().includes(needle),
      )
      .slice(0, 9);
  }, [allItems, q]);

  const sidebarW = collapsed ? 'w-[84px]' : 'w-[292px]';

  return (
    <aside
      className={cx(
        'relative flex h-screen shrink-0 flex-col transition-all duration-300',
        sidebarW,
        'border-r border-slate-200/70 bg-white/80 backdrop-blur-xl',
      )}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-emerald-500/[0.05] via-transparent to-cyan-500/[0.04]" />

      <div className="border-b border-slate-200/70 px-3 pb-2 pt-3">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/"
            className={cx(
              'group flex min-w-0 items-center rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25',
              collapsed ? 'justify-center' : 'gap-3',
            )}
            aria-label="Ambulant+ home"
          >
            <BrandMark collapsed={collapsed} />

            {!collapsed ? (
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-black tracking-tight text-slate-950">
                  Ambulant<span className="text-cyan-600">+</span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-semibold leading-none text-slate-500">
                  Patient workspace
                </span>
              </span>
            ) : (
              <CollapsedHint text="Ambulant+ home" />
            )}
          </Link>

          {!collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-5 w-5 text-slate-700" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="absolute right-[-14px] top-4 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4 text-slate-700" />
            </button>
          )}
        </div>

        {!collapsed ? (
          <div className="mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search care modules…"
                className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-2.5 text-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
              />
            </div>

            {q.trim() ? (
              <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {searchResults.length === 0 ? (
                  <div className="p-3 text-sm text-slate-600">No matches.</div>
                ) : (
                  <ul className="py-1">
                    {searchResults.map((item) => (
                      <NavRow
                        key={item.href}
                        item={item}
                        collapsed={false}
                        active={isMatch(pathname, item.href)}
                        onClick={() => setQ('')}
                      />
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Patient navigation">
        <ul className="space-y-1">
          {CORE.map((item) => (
            <NavRow
              key={item.href}
              item={item}
              collapsed={collapsed}
              active={isMatch(pathname, item.href)}
            />
          ))}

          {GROUPS.map((group) => {
            const Icon = group.icon;
            const open = !!openGroups[group.key];

            return (
              <li key={group.key} className="pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((prev) => ({ ...prev, [group.key]: !open }))
                  }
                  className="group relative flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-transparent transition group-hover:border-slate-200 group-hover:bg-white">
                    <Icon className="h-4 w-4 text-slate-500 group-hover:text-slate-800" />
                  </span>

                  {!collapsed ? (
                    <>
                      <span className="truncate font-black uppercase tracking-[0.08em] text-slate-500">
                        {group.title}
                      </span>
                      <span className="ml-auto text-xs font-black text-slate-400">
                        {open ? '▾' : '▸'}
                      </span>
                    </>
                  ) : (
                    <CollapsedHint text={group.title} />
                  )}
                </button>

                {open || collapsed ? (
                  <ul className="mt-1 space-y-1">
                    {group.items.map((item) => (
                      <NavRow
                        key={item.href}
                        item={item}
                        collapsed={collapsed}
                        active={isMatch(pathname, item.href)}
                        indent
                      />
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-slate-200/70 p-2">
        <ul className="space-y-1">
          <NavRow
            item={{ href: '/settings', label: 'Settings', icon: Settings }}
            collapsed={collapsed}
            active={isMatch(pathname, '/settings')}
          />

          <li>
            <Link
              href="/auth/logout"
              className="group relative flex items-center gap-2 rounded-2xl px-3 py-2 text-sm text-slate-700 transition hover:bg-rose-50 hover:text-rose-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/25"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-transparent transition group-hover:border-rose-200 group-hover:bg-white">
                <LogOut className="h-4 w-4 text-slate-500 group-hover:text-rose-700" />
              </span>
              {!collapsed ? (
                <span className="font-extrabold">Log out</span>
              ) : (
                <CollapsedHint text="Log out" />
              )}
            </Link>
          </li>
        </ul>

        {!collapsed ? (
          <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-black text-slate-900">Navigation</div>
            <div className="mt-1 text-[11px] leading-5 text-slate-600">
              Modules are grouped by clinical task: care, vitals, medicines, programmes, and services.
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}