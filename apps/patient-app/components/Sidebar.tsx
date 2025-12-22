// apps/patient-app/components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Home,
  Users,
  HeartPulse,
  LineChart,
  ClipboardList,
  ShoppingCart,
  Hospital,
  Radio,
  Video,
  Calendar,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  Brain,
  Moon,
  Database,
  Bell,
  Box,
  Heart,
  UserPlus,
  Search,
  Sparkles,
  // icon upgrades
  Stethoscope,
  Building2,
  UserCircle,
  Store,
  Pill,
  FlaskConical,
  ClipboardCheck,
  LogOut,
} from 'lucide-react';

type Item = {
  href: string;
  label: string;
  icon: any;
  badge?: string;
};

const NAV: Item[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/family', label: 'Family & Friends', icon: Users },
  { href: '/clinicians', label: 'Clinicians', icon: Stethoscope },
  { href: '/practices', label: 'Teams, Clinics, Hospitals', icon: Building2 },
  { href: '/vitals', label: 'Vitals', icon: HeartPulse },
  { href: '/charts', label: 'Charts', icon: LineChart },
  { href: '/encounters', label: 'Encounters', icon: ClipboardList },
  { href: '/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/careport', label: 'CarePort', icon: Hospital },
  { href: '/medreach', label: 'MedReach', icon: Radio },
  { href: '/appointments', label: 'Appointments', icon: Calendar },
  { href: '/televisit', label: 'Televisit', icon: Video },
  { href: '/profile', label: 'My Profile', icon: UserCircle },
  { href: '/shop', label: 'Shop', icon: Store },
];

const ANALYTICS: Item[] = [
  { href: '/reports', label: 'Reports', icon: ClipboardList },
  { href: '/wellness', label: 'Wellness', icon: LineChart },
  { href: '/fertility-report', label: 'Fertility Report', icon: HeartPulse },
  { href: '/reports/stress', label: 'Stress Report', icon: Brain },
  { href: '/reports/sleep', label: 'Sleep Report', icon: Moon },
];

const RESOURCES: Item[] = [
  { href: '/medications', label: 'Medications', icon: Pill },
  { href: '/devices', label: 'Devices', icon: Box },
  { href: '/labs', label: 'Labs', icon: FlaskConical },
  { href: '/allergies', label: 'Allergies', icon: Heart },
  // ✅ route fix
  { href: '/reminder', label: 'Reminders', icon: Bell },
  { href: '/tasks', label: 'Tasks', icon: ClipboardCheck },
];

const WOMEN: Item[] = [
  { href: '/lady-center', label: 'Lady Center', icon: UserPlus },
  { href: '/antenatal-center', label: 'Antenatal Center', icon: Heart },
];

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function isMatch(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

function navKey(it: Item) {
  return it.href;
}

function CollapsedHint({ text }: { text: string }) {
  return (
    <div
      className={cx(
        'pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2',
        'hidden group-hover:block',
      )}
    >
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-lg shadow-black/10 whitespace-nowrap">
        {text}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(true);
  const [resourcesOpen, setResourcesOpen] = useState(true);
  const [womenOpen, setWomenOpen] = useState(true);

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

  // Auto-open a group when its child route is active (nice UX)
  useEffect(() => {
    if (!pathname) return;
    if (WOMEN.some((x) => isMatch(pathname, x.href))) setWomenOpen(true);
    if (RESOURCES.some((x) => isMatch(pathname, x.href))) setResourcesOpen(true);
    if (ANALYTICS.some((x) => isMatch(pathname, x.href))) setAnalyticsOpen(true);
  }, [pathname]);

  const allItems = useMemo(() => {
    const extras: Item[] = [
      { href: '/myCare', label: 'myCare', icon: ClipboardList },
      { href: '/self-check', label: 'Self-care', icon: Activity },
    ];
    return [
      ...NAV,
      ...extras,
      ...WOMEN,
      ...RESOURCES,
      ...ANALYTICS,
      { href: '/settings', label: 'Settings', icon: Settings },
      { href: '/app/auth/logout', label: 'Log out', icon: LogOut },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchResults = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const uniq = new Map<string, Item>();
    for (const it of allItems) {
      if (it.label.toLowerCase().includes(s) || it.href.toLowerCase().includes(s)) {
        uniq.set(navKey(it), it);
      }
    }
    return Array.from(uniq.values()).slice(0, 8);
  }, [q, allItems]);

  function NavRow(props: {
    item: Item;
    collapsed: boolean;
    active: boolean;
    indent?: boolean;
    onClick?: () => void;
  }) {
    const { item, collapsed, active, indent } = props;
    const Icon = item.icon;

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={props.onClick}
          aria-current={active ? 'page' : undefined}
          className={cx(
            'group relative flex items-center gap-2 rounded-2xl px-3 py-2 text-sm transition',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25',
            indent ? (collapsed ? 'pl-3' : 'pl-9') : '',
            active
              ? 'bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent text-slate-950'
              : 'text-slate-700 hover:bg-slate-50',
          )}
        >
          {/* Active rail */}
          <span
            className={cx(
              'absolute left-1 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full transition',
              active ? 'bg-emerald-500' : 'bg-transparent',
            )}
          />

          <span
            className={cx(
              'inline-flex h-9 w-9 items-center justify-center rounded-2xl border transition',
              active
                ? 'border-emerald-200 bg-white shadow-sm shadow-black/5'
                : 'border-transparent bg-transparent group-hover:border-slate-200 group-hover:bg-white',
            )}
          >
            <Icon className={cx('h-4 w-4', active ? 'text-emerald-700' : 'text-slate-500')} />
          </span>

          {!collapsed ? (
            <span className={cx('min-w-0 flex-1 truncate', active ? 'font-extrabold' : 'font-semibold')}>
              {item.label}
            </span>
          ) : null}

          {!collapsed && item.badge ? (
            <span className="ml-auto rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-extrabold text-slate-700">
              {item.badge}
            </span>
          ) : null}

          {collapsed ? <CollapsedHint text={item.label} /> : null}
        </Link>
      </li>
    );
  }

  function Group(props: {
    title: string;
    icon: any;
    open: boolean;
    setOpen: (v: boolean) => void;
    items: Item[];
    collapsed: boolean;
  }) {
    const { title, icon: GIcon, open, setOpen, items, collapsed } = props;

    return (
      <li className="mt-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className={cx(
            'group relative w-full flex items-center gap-2 rounded-2xl px-3 py-2 text-sm transition',
            'text-slate-700 hover:bg-slate-50',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25',
          )}
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-transparent group-hover:border-slate-200 group-hover:bg-white transition">
            <GIcon className="h-4 w-4 text-slate-500" />
          </span>

          {!collapsed ? <span className="font-extrabold">{title}</span> : null}

          {!collapsed ? (
            <span className="ml-auto text-xs font-black text-slate-400">{open ? '▾' : '▸'}</span>
          ) : (
            <CollapsedHint text={title} />
          )}
        </button>

        {!collapsed && open ? (
          <ul className="mt-1 space-y-1">
            {items.map((it) => (
              <NavRow
                key={it.href}
                item={it}
                collapsed={collapsed}
                active={isMatch(pathname, it.href)}
                indent
              />
            ))}
          </ul>
        ) : null}

        {collapsed ? (
          <ul className="mt-1 space-y-1">
            {items.map((it) => (
              <NavRow
                key={it.href}
                item={it}
                collapsed={collapsed}
                active={isMatch(pathname, it.href)}
              />
            ))}
          </ul>
        ) : null}
      </li>
    );
  }

  const sidebarW = collapsed ? 'w-[84px]' : 'w-[292px]';

  return (
    <aside
      className={cx(
        'relative h-screen shrink-0 transition-all duration-300 flex flex-col',
        sidebarW,
        'border-r border-slate-200/70 bg-white/70 backdrop-blur-xl',
      )}
    >
      {/* subtle background sheen */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.06] via-transparent to-indigo-500/[0.04]" />
      </div>

      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-slate-200/70">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={cx(
                'h-10 w-10 rounded-2xl border border-slate-200 bg-white',
                'flex items-center justify-center shadow-sm shadow-black/[0.04]',
              )}
            >
              <Sparkles className="h-5 w-5 text-emerald-700" />
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <div className="text-sm font-black text-slate-950 leading-tight truncate">Ambulant+</div>
                <div className="text-[11px] font-semibold text-slate-500 truncate">Patient Console</div>
              </div>
            ) : null}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cx(
              'h-10 w-10 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition',
              'inline-flex items-center justify-center',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25',
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5 text-slate-700" />
            ) : (
              <ChevronLeft className="h-5 w-5 text-slate-700" />
            )}
          </button>
        </div>

        {/* Search */}
        <div className={cx('mt-3', collapsed && 'hidden')}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search… (vitals, meds, reports)"
              className={cx(
                'w-full rounded-2xl border border-slate-200 bg-white px-10 py-2.5 text-sm',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-300',
              )}
            />
          </div>

          {q.trim() ? (
            <div className="mt-2 rounded-2xl border border-slate-200 bg-white overflow-hidden">
              {searchResults.length === 0 ? (
                <div className="p-3 text-sm text-slate-600">No matches.</div>
              ) : (
                <ul className="py-1">
                  {searchResults.map((it) => (
                    <NavRow
                      key={it.href}
                      item={it}
                      collapsed={false}
                      active={isMatch(pathname, it.href)}
                      onClick={() => setQ('')}
                    />
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Main nav */}
      <nav className="px-2 py-3 flex-1 overflow-y-auto" aria-label="Primary">
        <ul className="space-y-1">
          {NAV.map((it) => (
            <NavRow key={it.href} item={it} collapsed={collapsed} active={isMatch(pathname, it.href)} />
          ))}

          {/* explicit single links */}
          <div className={cx('mt-3 mb-2 px-3', collapsed && 'hidden')}>
            <div className="text-[11px] font-black tracking-wide text-slate-400 uppercase">My Care</div>
          </div>

          <NavRow
            item={{ href: '/myCare', label: 'myCare', icon: ClipboardList }}
            collapsed={collapsed}
            active={isMatch(pathname, '/myCare')}
          />
          <NavRow
            item={{ href: '/self-check', label: 'Self-care', icon: Activity }}
            collapsed={collapsed}
            active={isMatch(pathname, '/self-check')}
          />

          {/* groups */}
          <Group
            title="Women's Health"
            icon={UserPlus}
            open={womenOpen}
            setOpen={setWomenOpen}
            items={WOMEN}
            collapsed={collapsed}
          />

          <Group
            title="Resources"
            icon={Box}
            open={resourcesOpen}
            setOpen={setResourcesOpen}
            items={RESOURCES}
            collapsed={collapsed}
          />

          <Group
            title="Analytics"
            icon={LineChart}
            open={analyticsOpen}
            setOpen={setAnalyticsOpen}
            items={ANALYTICS}
            collapsed={collapsed}
          />
        </ul>
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-slate-200/70">
        <ul className="space-y-1">
          <NavRow
            item={{ href: '/settings', label: 'Settings', icon: Settings }}
            collapsed={collapsed}
            active={isMatch(pathname, '/settings')}
          />

          {/* ✅ Log out */}
          <li>
            <Link
              href="/auth/logout"
              className={cx(
                'group relative flex items-center gap-2 rounded-2xl px-3 py-2 text-sm transition',
                'text-slate-700 hover:bg-rose-50 hover:text-rose-900',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/25',
              )}
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-transparent group-hover:border-rose-200 group-hover:bg-white transition">
                <LogOut className="h-4 w-4 text-slate-500 group-hover:text-rose-700" />
              </span>

              {!collapsed ? <span className="font-extrabold">Log out</span> : null}
              {collapsed ? <CollapsedHint text="Log out" /> : null}
            </Link>
          </li>
        </ul>

        {!collapsed ? (
          <div className="mt-2 px-3 pb-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="text-xs font-black text-slate-900">Quick tip</div>
              <div className="mt-1 text-[11px] text-slate-600">
                Use <span className="font-bold">Search</span> to jump to any page fast.
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
