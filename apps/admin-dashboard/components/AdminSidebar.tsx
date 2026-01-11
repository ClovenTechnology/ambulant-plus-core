// apps/admin-dashboard/components/AdminSidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  Shield,
  Sparkles,
  FlaskConical,
  Pill,
  Bike,
  Syringe,
  Cpu,
  Upload,
  Package,
  Truck,
  HeartPulse,
  BarChart3,
  FileText,
  ClipboardList,
  Settings,
  Store,
  ChevronLeft,
  ChevronRight,
  LogOut,
  UserRoundCog,
  ArrowLeftRight,
} from 'lucide-react';

type Item = { href: string; label: string; icon: LucideIcon; requires?: string | string[] };
type Group = {
  key: string;
  label: string;
  icon: LucideIcon;
  items: Item[];
  defaultOpen?: boolean;
  requires?: string | string[];
};

const COLLAPSE_KEY = 'admin.sidebar-collapsed';

// TEMP: show everything in the sidebar regardless of scopes.
// Flip this to false once your Gateway returns superadmin scopes reliably.
const FORCE_SHOW_ALL = true;

// Scopes that should unlock EVERYTHING in the UI (you still must enforce on the API too)
const SUPER_SCOPES = ['superadmin', 'admin:all', '*'] as const;

// ---- tiny scope helper (client) ----
function hasAny(scopes: string[], need?: string | string[]) {
  const set = new Set(scopes);

  // Super-admin override
  for (const s of SUPER_SCOPES) {
    if (set.has(s)) return true;
  }

  if (!need) return true; // public
  const req = Array.isArray(need) ? need : [need];
  return req.some((r) => set.has(r));
}

export default function AdminSidebar() {
  const pathname = usePathname();

  // ✅ Hide sidebar on auth routes without changing app/layout.tsx
  if (pathname?.startsWith('/auth')) return null;

  const [collapsed, setCollapsed] = useState(false);
  const [scopes, setScopes] = useState<string[] | null>(null); // null=loading, []=no scopes

  // groups open/close state
  const [open, setOpen] = useState<Record<string, boolean>>({
    ops: true,
    logistics: true,
    devices: true,
    settings: true,
    admin: true,
  });

  // Load persisted collapsed state
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY);
      if (stored != null) setCollapsed(stored === 'true');
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, String(collapsed));
    } catch {}
  }, [collapsed]);

  // Fetch session scopes from Gateway (kept, even if we force-show UI for now)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // The cookie (adm.profile) is read on the Gateway; include credentials so cookies flow.
        const base = process.env.NEXT_PUBLIC_APIGW_BASE || 'http://localhost:3010';
        const r = await fetch(`${base}/api/auth/me`, { credentials: 'include', cache: 'no-store' });
        const j = await r.json().catch(() => null);
        if (!cancelled) {
          const s: string[] = j?.user?.scopes ?? [];
          setScopes(Array.isArray(s) ? s : []);
        }
      } catch {
        if (!cancelled) setScopes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  // Top level shortcuts
  const TOP: Item[] = useMemo(
    () => [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/patients', label: 'Patients', icon: Users, requires: ['medical', 'reports', 'hr'] },
      { href: '/clinicians', label: 'Clinicians', icon: Stethoscope, requires: ['medical', 'hr'] },
      { href: '/cases', label: 'Cases', icon: ClipboardList, requires: 'medical' },
      { href: '/orders', label: 'Orders', icon: Package, requires: 'medical' },
    ],
    []
  );

  // Singles
  const SINGLE: Item[] = useMemo(
    () => [
      { href: '/analytics', label: 'Analytics', icon: BarChart3, requires: ['reports', 'finance'] },
      { href: '/reports', label: 'Reports', icon: FileText, requires: 'reports' },
      { href: '/insurance', label: 'Insurance', icon: Shield, requires: 'finance' },

      // ✅ NEW: Forex (FX)
      { href: '/finance/fx', label: 'Forex', icon: ArrowLeftRight, requires: 'finance' },

      { href: '/promotions', label: 'Promotions', icon: Sparkles /* public within admin */ },
      { href: '/consult', label: 'Consult', icon: HeartPulse, requires: 'medical' },
    ],
    []
  );

  // Grouped sections (scope-aware)
  const GROUPS: Group[] = useMemo(
    () => [
      {
        key: 'ops',
        label: 'Care Ops',
        icon: ClipboardList,
        defaultOpen: true,
        requires: 'medical',
        items: [
          { href: '/labs', label: 'Labs', icon: FlaskConical, requires: 'medical' },
          { href: '/pharmacies', label: 'Pharmacies', icon: Pill, requires: 'medical' },
          { href: '/careport', label: 'CarePort', icon: Truck, requires: 'medical' },
          { href: '/medreach', label: 'MedReach', icon: Syringe, requires: 'medical' },
        ],
      },
      {
        key: 'logistics',
        label: 'Field Teams',
        icon: Bike,
        defaultOpen: true,
        requires: 'medical',
        items: [
          { href: '/rider', label: 'Riders', icon: Bike, requires: 'medical' },
          { href: '/phleb', label: 'Phlebs', icon: Syringe, requires: 'medical' },
        ],
      },
      {
        key: 'devices',
        label: 'Devices & SDK',
        icon: Cpu,
        defaultOpen: true,
        requires: 'tech',
        items: [
          { href: '/devices', label: 'Devices', icon: Cpu, requires: 'tech' },
          { href: '/sdk', label: 'SDK', icon: Cpu, requires: 'tech' },
          { href: '/sdkupload', label: 'SDK Upload', icon: Upload, requires: 'tech' },
        ],
      },
      {
        key: 'admin',
        label: 'Admin',
        icon: Store,
        defaultOpen: true,
        requires: ['hr', 'manageRoles'],
        items: [
          { href: '/admin/clinicians', label: 'Admin Clinicians', icon: Stethoscope, requires: ['hr', 'manageRoles'] },
          { href: '/admin/patients', label: 'Admin Patients', icon: Users, requires: ['hr', 'manageRoles'] },
          { href: '/admin/shop', label: 'Admin Shop', icon: Store, requires: ['manageRoles'] },
        ],
      },
      {
        key: 'settings',
        label: 'Settings',
        icon: Settings,
        defaultOpen: true,
        requires: ['manageRoles', 'finance', 'tech', 'medical'],
        items: [
          { href: '/settings/general', label: 'General', icon: Settings, requires: ['manageRoles'] },
          { href: '/settings/roles', label: 'Roles', icon: UserRoundCog, requires: ['manageRoles'] },
          { href: '/settings/plans', label: 'Plans', icon: Settings, requires: ['manageRoles', 'finance'] },
          { href: '/settings/consult', label: 'Consult', icon: HeartPulse, requires: ['medical', 'manageRoles'] },
          { href: '/settings/insurance', label: 'Insurance', icon: Shield, requires: ['finance'] },
          { href: '/settings/payouts', label: 'Payouts', icon: Package, requires: ['finance'] },
          { href: '/settings/insightcore', label: 'InsightCore', icon: BarChart3, requires: ['tech'] },
          { href: '/settings/shop', label: 'Shop', icon: Store, requires: ['manageRoles'] },
          // People (Departments / Role Requests)
          { href: '/settings/people/departments', label: 'Departments', icon: Settings, requires: ['hr', 'manageRoles'] },
          { href: '/settings/people/role-requests', label: 'Role Requests', icon: UserRoundCog, requires: ['hr', 'manageRoles'] },
          { href: '/settings/profile', label: 'My Profile', icon: UserRoundCog }, // always visible to the user
        ],
      },
    ],
    []
  );

  function ItemRow(it: Item) {
    const gated = !!it.requires;

    // ✅ Force-show mode: render everything
    const allowed = FORCE_SHOW_ALL ? true : scopes ? hasAny(scopes, it.requires) : !gated;
    if (!allowed) return null;

    const active = isActive(it.href);
    const Icon = it.icon;

    return (
      <li key={it.href}>
        <Link
          href={it.href}
          title={collapsed ? it.label : undefined}
          aria-current={active ? 'page' : undefined}
          className={[
            'flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors',
            active ? 'bg-black/5 font-medium text-black' : 'text-black/70 hover:bg-black/5 hover:text-black',
          ].join(' ')}
        >
          <Icon className="h-4 w-4 text-black/50" />
          {!collapsed && <span className="truncate">{it.label}</span>}
        </Link>
      </li>
    );
  }

  function GroupBlock(g: Group) {
    if (!FORCE_SHOW_ALL) {
      // Hide whole group if user lacks access to the group and all its items
      const groupAllowed = scopes ? hasAny(scopes, g.requires) : false;
      const anyItemAllowed = scopes ? g.items.some((it) => hasAny(scopes!, it.requires)) : false;
      if (!groupAllowed && !anyItemAllowed) return null;
    }

    const expanded = !!open[g.key];

    return (
      <li key={g.key}>
        <button
          type="button"
          onClick={() => setOpen((s) => ({ ...s, [g.key]: !s[g.key] }))}
          className="w-full flex items-center justify-between rounded px-3 py-2 text-sm text-black/70 hover:bg-black/5 hover:text-black"
          aria-expanded={expanded}
          title={collapsed ? g.label : undefined}
        >
          <span className="flex items-center gap-2">
            <g.icon className="h-4 w-4 text-black/50" />
            {!collapsed && <span className="font-medium">{g.label}</span>}
          </span>
          {!collapsed && <span className="text-xs text-black/40">{expanded ? '▾' : '▸'}</span>}
        </button>

        {!collapsed && expanded && (
          <ul className="ml-6 mt-1 space-y-1">
            {g.items.map((it) => ItemRow(it))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <aside
      className={[
        'h-[calc(100vh-56px)] shrink-0 border-r bg-white/80 backdrop-blur',
        'transition-all duration-300 flex flex-col',
        collapsed ? 'w-16' : 'w-64',
      ].join(' ')}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b">
        {!collapsed && <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Admin</span>}

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="p-1 rounded hover:bg-black/5"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5 text-black/65" />
          ) : (
            <ChevronLeft className="h-5 w-5 text-black/65" />
          )}
        </button>
      </div>

      <nav className="px-2 py-3 flex-1 overflow-y-auto" aria-label="Admin navigation">
        <ul className="space-y-1">
          {TOP.map((it) => ItemRow(it))}
          <div className="my-2 border-t" />
          {SINGLE.map((it) => ItemRow(it))}
          <div className="my-2 border-t" />
          {GROUPS.map((g) => GroupBlock(g))}
        </ul>
      </nav>

      <div className="p-2 border-t">
        <Link
          href="/signout"
          title={collapsed ? 'Sign Out' : undefined}
          className="flex items-center gap-2 rounded px-3 py-2 text-sm text-black/70 hover:bg-black/5 hover:text-black"
        >
          <LogOut className="h-4 w-4 text-black/50" />
          {!collapsed && 'Sign Out'}
        </Link>
      </div>
    </aside>
  );
}
