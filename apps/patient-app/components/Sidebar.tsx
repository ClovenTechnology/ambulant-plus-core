// apps/patient-app/components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Baby,
  Bell,
  Box,
  Brain,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Dumbbell,
  FileText,
  FlaskConical,
  Heart,
  HeartPulse,
  Home,
  Hospital,
  LineChart,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pill,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Stethoscope,
  Store,
  UserCircle,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';

type SidebarMode = 'desktop' | 'mobile';

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  keywords?: string[];
};

const BRAND_FULL_WEBP = '/brand/ambulant-logo-full.webp';
const BRAND_FULL_PNG = '/brand/ambulant-logo-full.png';
const BRAND_MARK_WEBP = '/brand/ambulant-mark.webp';
const BRAND_MARK_PNG = '/brand/ambulant-mark.png';

const PRIMARY_NAV: Item[] = [
  { href: '/', label: 'Home', icon: Home, keywords: ['dashboard', 'overview'] },
  { href: '/appointments', label: 'Appointments', icon: Calendar, keywords: ['booking', 'consultation'] },
  { href: '/clinicians', label: 'Clinicians', icon: Stethoscope, keywords: ['doctor', 'provider'] },
  { href: '/family', label: 'Family & Friends', icon: Users, keywords: ['proxy', 'dependants'] },
  { href: '/profile', label: 'My Profile', icon: UserCircle, keywords: ['account', 'identity'] },
];

const CARE_NAV: Item[] = [
  { href: '/myCare', label: 'myCare', icon: ClipboardList, keywords: ['care plan'] },
  { href: '/medical-records', label: 'Health Records', icon: FileText, keywords: ['records', 'history'] },
  { href: '/vitals', label: 'Vitals', icon: HeartPulse, keywords: ['telemetry', 'health monitor'] },
  { href: '/charts', label: 'Charts', icon: LineChart, keywords: ['trends', 'graphs'] },
  { href: '/encounters', label: 'Encounters', icon: ClipboardCheck, keywords: ['consults', 'visits'] },
  { href: '/self-check', label: 'Self-check', icon: Activity, keywords: ['triage', 'symptoms'] },
];

const SERVICES_NAV: Item[] = [
  { href: '/practices', label: 'Teams, Clinics, Hospitals', icon: Building2, keywords: ['practices', 'facilities'] },
  { href: '/careport', label: 'CarePort', icon: Hospital, keywords: ['pharmacy', 'delivery', 'prescription'] },
  { href: '/medreach', label: 'MedReach', icon: Radio, keywords: ['outreach', 'mobile'] },
  { href: '/orders', label: 'Orders', icon: ShoppingCart, keywords: ['requests', 'careport'] },
  { href: '/shop', label: 'Shop', icon: Store, keywords: ['store', 'devices'] },
  { href: '/televisit', label: 'Televisit', icon: Video, keywords: ['video', 'room'] },
];

const HEALTH_PROGRAMS: Item[] = [
  { href: '/lady-center', label: 'Lady Center', icon: UserPlus, keywords: ['women', 'cycle', 'fertility'] },
  { href: '/antenatal-center', label: 'Antenatal Center', icon: Heart, keywords: ['pregnancy', 'maternity'] },
  { href: '/gentlemens-health', label: "Men's Health", icon: Dumbbell, keywords: ['male health'] },
  { href: '/paediatric-center', label: 'Paediatrics', icon: Baby, keywords: ['children', 'child health'] },
  { href: '/wellness', label: 'Wellness', icon: ShieldCheck, keywords: ['lifestyle'] },
];

const RESOURCES_NAV: Item[] = [
  { href: '/medications', label: 'Medications', icon: Pill, keywords: ['pills', 'adherence'] },
  { href: '/myCare/devices', label: 'Devices', icon: Box, keywords: ['health monitor', 'stethoscope', 'otoscope', 'nexring'] },
  { href: '/labs', label: 'Labs', icon: FlaskConical, keywords: ['blood tests', 'results'] },
  { href: '/allergies', label: 'Allergies', icon: Heart, keywords: ['reactions', 'risks'] },
  { href: '/reminder', label: 'Reminders', icon: Bell, keywords: ['notifications'] },
  { href: '/tasks', label: 'Tasks', icon: ClipboardCheck, keywords: ['to do', 'actions'] },
];

const INTELLIGENCE_NAV: Item[] = [
  { href: '/reports', label: 'Reports', icon: ClipboardList, keywords: ['documents', 'summaries'] },
  { href: '/fertility-report', label: 'Fertility Report', icon: HeartPulse, keywords: ['cycle report'] },
  { href: '/reports/stress', label: 'Stress Report', icon: Brain, keywords: ['stress'] },
  { href: '/reports/sleep', label: 'Sleep Report', icon: Moon, keywords: ['sleep'] },
];

const SECTIONS: Array<{
  key: string;
  title: string;
  icon: LucideIcon;
  items: Item[];
  defaultOpen?: boolean;
}> = [
  { key: 'care', title: 'Care workspace', icon: HeartPulse, items: CARE_NAV, defaultOpen: true },
  { key: 'services', title: 'Services', icon: Hospital, items: SERVICES_NAV, defaultOpen: true },
  { key: 'programs', title: 'Health programs', icon: ShieldCheck, items: HEALTH_PROGRAMS, defaultOpen: true },
  { key: 'resources', title: 'Resources', icon: Box, items: RESOURCES_NAV, defaultOpen: true },
  { key: 'intelligence', title: 'Reports & intelligence', icon: LineChart, items: INTELLIGENCE_NAV, defaultOpen: true },
];

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function isMatch(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navKey(item: Item) {
  return item.href;
}

function CollapsedHint({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 hidden -translate-y-1/2 group-hover:block">
      <div className="whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-xl shadow-slate-900/10">
        {text}
      </div>
    </div>
  );
}

function BrandLockup({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/"
      className={cx(
        'group flex min-w-0 items-center rounded-[22px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40',
        collapsed ? 'justify-center' : 'gap-3',
      )}
      aria-label="Go to Ambulant+ home"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[20px] border border-cyan-100 bg-white shadow-sm shadow-cyan-950/5">
        <picture>
          <source srcSet={BRAND_MARK_WEBP} type="image/webp" />
          <img src={BRAND_MARK_PNG} alt="" className="h-9 w-9 object-contain" draggable={false} />
        </picture>
      </span>

      {!collapsed ? (
        <span className="min-w-0">
          <picture>
            <source srcSet={BRAND_FULL_WEBP} type="image/webp" />
            <img
              src={BRAND_FULL_PNG}
              alt="Ambulant+ Contactless Medicine"
              className="h-10 w-auto max-w-[178px] object-contain"
              draggable={false}
            />
          </picture>
          <span className="sr-only">Ambulant+ Contactless Medicine</span>
        </span>
      ) : (
        <CollapsedHint text="Ambulant+ home" />
      )}
    </Link>
  );
}

export default function Sidebar({
  mode = 'desktop',
  onNavigate,
}: {
  mode?: SidebarMode;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isMobile = mode === 'mobile';

  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SECTIONS.map((section) => [section.key, Boolean(section.defaultOpen)])),
  );
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isMobile) return;

    try {
      const stored = localStorage.getItem('sidebar-collapsed');
      if (stored != null) setCollapsed(stored === 'true');
    } catch {
      // Storage can be unavailable in restricted browsers.
    }
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) return;

    try {
      localStorage.setItem('sidebar-collapsed', String(collapsed));
    } catch {
      // Storage can be unavailable in restricted browsers.
    }
  }, [collapsed, isMobile]);

  useEffect(() => {
    if (!pathname) return;

    setOpenSections((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const section of SECTIONS) {
        if (section.items.some((item) => isMatch(pathname, item.href)) && !next[section.key]) {
          next[section.key] = true;
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [pathname]);

  const effectiveCollapsed = isMobile ? false : collapsed;

  const allItems = useMemo(() => {
    const map = new Map<string, Item>();

    for (const item of [
      ...PRIMARY_NAV,
      ...SECTIONS.flatMap((section) => section.items),
      { href: '/settings', label: 'Settings', icon: Settings },
      { href: '/auth/logout', label: 'Log out', icon: LogOut },
    ]) {
      map.set(navKey(item), item);
    }

    return Array.from(map.values());
  }, []);

  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];

    return allItems
      .filter((item) => {
        const haystack = [item.label, item.href, ...(item.keywords || [])]
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      })
      .slice(0, 8);
  }, [allItems, query]);

  function handleNavigate() {
    setQuery('');
    onNavigate?.();
  }

  function NavRow({
    item,
    active,
    indent = false,
  }: {
    item: Item;
    active: boolean;
    indent?: boolean;
  }) {
    const Icon = item.icon;

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={handleNavigate}
          aria-current={active ? 'page' : undefined}
          title={effectiveCollapsed ? item.label : undefined}
          className={cx(
            'group relative flex items-center gap-2 rounded-[18px] px-2.5 py-2 text-sm transition',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/35',
            indent && !effectiveCollapsed ? 'pl-8' : '',
            active
              ? 'bg-gradient-to-r from-cyan-500/12 via-emerald-500/8 to-transparent text-slate-950 shadow-sm shadow-cyan-950/[0.03]'
              : 'text-slate-650 hover:bg-white/86 hover:text-slate-950',
          )}
        >
          <span
            className={cx(
              'absolute left-1 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full transition',
              active ? 'bg-gradient-to-b from-cyan-400 to-emerald-500' : 'bg-transparent',
            )}
          />

          <span
            className={cx(
              'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border transition',
              active
                ? 'border-cyan-200 bg-white text-cyan-700 shadow-sm shadow-cyan-950/5'
                : 'border-transparent bg-transparent text-slate-500 group-hover:border-slate-200 group-hover:bg-white group-hover:text-cyan-700',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>

          {!effectiveCollapsed ? (
            <span className={cx('min-w-0 flex-1 truncate', active ? 'font-extrabold' : 'font-semibold')}>
              {item.label}
            </span>
          ) : null}

          {!effectiveCollapsed && item.badge ? (
            <span className="ml-auto rounded-full border border-cyan-100 bg-cyan-50 px-2 py-0.5 text-[10px] font-extrabold text-cyan-700">
              {item.badge}
            </span>
          ) : null}

          {effectiveCollapsed ? <CollapsedHint text={item.label} /> : null}
        </Link>
      </li>
    );
  }

  function Section({
    section,
  }: {
    section: (typeof SECTIONS)[number];
  }) {
    const Icon = section.icon;
    const open = Boolean(openSections[section.key]);
    const hasActiveChild = section.items.some((item) => isMatch(pathname, item.href));

    if (effectiveCollapsed) {
      return (
        <li className="mt-2">
          <ul className="space-y-1">
            {section.items.map((item) => (
              <NavRow key={item.href} item={item} active={isMatch(pathname, item.href)} />
            ))}
          </ul>
        </li>
      );
    }

    return (
      <li className="mt-2">
        <button
          type="button"
          onClick={() =>
            setOpenSections((prev) => ({
              ...prev,
              [section.key]: !open,
            }))
          }
          aria-expanded={open}
          className={cx(
            'group flex w-full items-center gap-2 rounded-[18px] px-2.5 py-2 text-sm transition',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/35',
            hasActiveChild
              ? 'bg-white/80 text-slate-950'
              : 'text-slate-650 hover:bg-white/80 hover:text-slate-950',
          )}
        >
          <span
            className={cx(
              'inline-flex h-9 w-9 items-center justify-center rounded-2xl border transition',
              hasActiveChild
                ? 'border-cyan-100 bg-cyan-50 text-cyan-700'
                : 'border-transparent text-slate-500 group-hover:border-slate-200 group-hover:bg-white group-hover:text-cyan-700',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>

          <span className="min-w-0 flex-1 truncate text-left font-extrabold">{section.title}</span>

          <ChevronDown
            className={cx(
              'h-4 w-4 shrink-0 text-slate-400 transition-transform',
              open ? 'rotate-0' : '-rotate-90',
            )}
            aria-hidden="true"
          />
        </button>

        {open ? (
          <ul className="mt-1 space-y-1">
            {section.items.map((item) => (
              <NavRow
                key={item.href}
                item={item}
                active={isMatch(pathname, item.href)}
                indent
              />
            ))}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <aside
      className={cx(
        'relative shrink-0 overflow-hidden rounded-[30px] border border-white/70 bg-white/78 text-slate-800 shadow-[0_20px_70px_rgba(15,23,42,0.07)] backdrop-blur-2xl transition-all duration-300',
        isMobile
          ? 'h-full w-full'
          : effectiveCollapsed
            ? 'sticky top-[4.5rem] h-[calc(100vh-5.5rem)] w-[88px]'
            : 'sticky top-[4.5rem] h-[calc(100vh-5.5rem)] w-[292px]',
      )}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_0%_0%,rgba(34,211,238,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(240,249,255,0.68))]" />

      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-slate-200/70 px-3 pb-3 pt-3">
          <div className={cx('flex items-center gap-2', effectiveCollapsed ? 'justify-center' : 'justify-between')}>
            <BrandLockup collapsed={effectiveCollapsed} />

            {!isMobile ? (
              <button
                type="button"
                onClick={() => setCollapsed((value) => !value)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-cyan-200 hover:text-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/35"
                aria-label={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {effectiveCollapsed ? (
                  <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            ) : null}
          </div>

          {!effectiveCollapsed ? (
            <>
              <div className="mt-3 rounded-[22px] border border-cyan-100 bg-cyan-50/58 px-3 py-2.5">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700">
                  Patient command centre
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-600">
                  Navigation for consultations, telemetry, records, medication, and care support.
                </div>
              </div>

              <div className="mt-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Clear navigation search"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search vitals, meds, reports…"
                    className="w-full rounded-[18px] border border-slate-200 bg-white px-10 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/18"
                  />
                </div>

                {query.trim() ? (
                  <div className="mt-2 overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-xl shadow-slate-900/8">
                    {searchResults.length === 0 ? (
                      <div className="p-3 text-sm text-slate-600">
                        No matching pages found.
                      </div>
                    ) : (
                      <ul className="space-y-1 p-1.5">
                        {searchResults.map((item) => (
                          <NavRow
                            key={item.href}
                            item={item}
                            active={isMatch(pathname, item.href)}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3" aria-label="Primary navigation">
          <ul className="space-y-1">
            {!effectiveCollapsed ? (
              <li className="px-3 pb-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                Core
              </li>
            ) : null}

            {PRIMARY_NAV.map((item) => (
              <NavRow key={item.href} item={item} active={isMatch(pathname, item.href)} />
            ))}

            {SECTIONS.map((section) => (
              <Section key={section.key} section={section} />
            ))}
          </ul>
        </nav>

        <div className="border-t border-slate-200/70 p-2">
          <ul className="space-y-1">
            <NavRow
              item={{ href: '/settings', label: 'Settings', icon: Settings }}
              active={isMatch(pathname, '/settings')}
            />

            <li>
              <Link
                href="/auth/logout"
                onClick={handleNavigate}
                title={effectiveCollapsed ? 'Log out' : undefined}
                className="group relative flex items-center gap-2 rounded-[18px] px-2.5 py-2 text-sm text-slate-700 transition hover:bg-rose-50 hover:text-rose-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/25"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-transparent text-slate-500 transition group-hover:border-rose-200 group-hover:bg-white group-hover:text-rose-700">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </span>

                {!effectiveCollapsed ? <span className="font-extrabold">Log out</span> : null}
                {effectiveCollapsed ? <CollapsedHint text="Log out" /> : null}
              </Link>
            </li>
          </ul>

          {!effectiveCollapsed ? (
            <div className="mt-2 rounded-[22px] border border-slate-200 bg-white/88 p-3 shadow-sm">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                  <Menu className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div>
                  <div className="text-xs font-black text-slate-900">Navigation tip</div>
                  <div className="mt-1 text-[11px] leading-4 text-slate-600">
                    Use search to jump quickly to any clinical workspace.
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
