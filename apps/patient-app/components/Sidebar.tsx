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
  ChevronDown,
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
  X,
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

type SidebarProps = {
  variant?: 'desktop' | 'mobile';
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

const CORE: Item[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/profile', label: 'Profile', icon: UserCircle },
  { href: '/appointments', label: 'Appointments', icon: Calendar },
  { href: '/clinicians', label: 'Clinicians', icon: Stethoscope },
  { href: '/practices', label: 'Clinics & hospitals', icon: Building2 },
  { href: '/televisit', label: 'Televisit', icon: Video },
  { href: '/training', label: 'Training invitations', icon: Video },
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

const DEFAULT_OPEN_GROUPS: Record<string, boolean> = {
  care: false,
  vitals: false,
  meds: false,
  'health-programmes': false,
  services: false,
};

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
          'group relative flex min-h-[44px] items-center gap-2 rounded-2xl px-3 py-2 text-sm transition',
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

export default function Sidebar({
  variant = 'desktop',
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const isMobile = variant === 'mobile';
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(DEFAULT_OPEN_GROUPS);
  const [q, setQ] = useState('');

  const visualCollapsed = isMobile ? false : collapsed;

  useEffect(() => {
    if (isMobile) return;

    try {
      const stored = localStorage.getItem('sidebar-collapsed');
      if (stored != null) setCollapsed(stored === 'true');
    } catch {}
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) return;

    try {
      localStorage.setItem('sidebar-collapsed', String(collapsed));
    } catch {}
  }, [collapsed, isMobile]);

  useEffect(() => {
    if (!isMobile || !mobileOpen) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onMobileClose?.();
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile, mobileOpen, onMobileClose]);

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

  const closeAfterNav = isMobile ? onMobileClose : undefined;
  const sidebarW = visualCollapsed ? 'w-[84px]' : 'w-[292px]';

  const aside = (
    <aside
      data-p-ui={isMobile ? 'patient-mobile-sidebar-drawer' : 'patient-desktop-sidebar'}
      aria-label="Patient navigation"
      aria-hidden={isMobile ? !mobileOpen : undefined}
      className={cx(
        'flex shrink-0 flex-col border-r border-slate-200/70 bg-white/90 backdrop-blur-xl transition-all duration-300',
        isMobile
          ? cx(
              'fixed left-0 top-0 z-50 h-dvh w-[min(92vw,340px)] shadow-2xl shadow-slate-950/20',
              mobileOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none',
            )
          : cx('sticky top-[72px] hidden h-[calc(100vh-88px)] lg:flex', sidebarW),
      )}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-emerald-500/[0.05] via-transparent to-cyan-500/[0.04]" />

      <div className="border-b border-slate-200/70 px-3 pb-2 pt-3">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/"
            onClick={closeAfterNav}
            className={cx(
              'group flex min-w-0 items-center rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25',
              visualCollapsed ? 'justify-center' : 'gap-3',
            )}
            aria-label="Ambulant+ home"
          >
            <BrandMark collapsed={visualCollapsed} />

            {!visualCollapsed ? (
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

          {isMobile ? (
            <button
              type="button"
              onClick={onMobileClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25"
              aria-label="Close patient menu"
            >
              <X className="h-5 w-5 text-slate-700" />
            </button>
          ) : !visualCollapsed ? (
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

        {!visualCollapsed ? (
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
                        onClick={() => {
                          setQ('');
                          closeAfterNav?.();
                        }}
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
              collapsed={visualCollapsed}
              active={isMatch(pathname, item.href)}
              onClick={closeAfterNav}
            />
          ))}

          {GROUPS.map((group) => {
            const Icon = group.icon;
            const open = !!openGroups[group.key];
            const groupActive = group.items.some((item) => isMatch(pathname, item.href));

            return (
              <li key={group.key} className="pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((prev) => ({ ...prev, [group.key]: !open }))
                  }
                  aria-expanded={open}
                  className={cx(
                    'group relative flex min-h-[44px] w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25',
                    groupActive ? 'text-slate-950' : 'text-slate-700',
                  )}
                >
                  <span
                    className={cx(
                      'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border transition group-hover:border-slate-200 group-hover:bg-white',
                      groupActive ? 'border-emerald-200 bg-emerald-50' : 'border-transparent',
                    )}
                  >
                    <Icon
                      className={cx(
                        'h-4 w-4',
                        groupActive ? 'text-emerald-700' : 'text-slate-500 group-hover:text-slate-800',
                      )}
                    />
                  </span>

                  {!visualCollapsed ? (
                    <>
                      <span className="truncate font-black uppercase tracking-[0.08em] text-slate-500">
                        {group.title}
                      </span>
                      <span className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
                        {open ? (
                          <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        )}
                      </span>
                    </>
                  ) : (
                    <CollapsedHint text={group.title} />
                  )}
                </button>

                {open && !visualCollapsed ? (
                  <ul className="mt-1 space-y-1">
                    {group.items.map((item) => (
                      <NavRow
                        key={item.href}
                        item={item}
                        collapsed={false}
                        active={isMatch(pathname, item.href)}
                        indent
                        onClick={closeAfterNav}
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
            collapsed={visualCollapsed}
            active={isMatch(pathname, '/settings')}
            onClick={closeAfterNav}
          />
          <NavRow
            item={{ href: '/auth/logout', label: 'Sign out', icon: LogOut }}
            collapsed={visualCollapsed}
            active={false}
            onClick={closeAfterNav}
          />
        </ul>
      </div>
    </aside>
  );

  if (!isMobile) return aside;

  return (
    <>
      <div
        data-p-ui="patient-mobile-sidebar-backdrop"
        aria-hidden="true"
        onClick={onMobileClose}
        className={cx(
          'fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm transition-opacity lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      {aside}
    </>
  );
}
