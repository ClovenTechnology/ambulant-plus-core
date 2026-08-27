'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Bike,
  Briefcase,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Cpu,
  FileText,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Pill,
  Settings,
  Shield,
  Sparkles,
  Stethoscope,
  Store,
  Syringe,
  Truck,
  Upload,
  UserRoundCog,
  Users,
  WalletCards,
} from 'lucide-react';

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  requires?: string | string[];
  description?: string;
};

type Group = {
  key: string;
  label: string;
  icon: LucideIcon;
  items: Item[];
  requires?: string | string[];
};

const COLLAPSE_KEY = 'admin.sidebar-collapsed';
const GROUP_KEY = 'admin.sidebar-groups';
const SUPER_SCOPES = ['superadmin', 'admin:all', '*'] as const;

function hasAny(scopes: string[], need?: string | string[]) {
  const set = new Set(scopes);
  if (SUPER_SCOPES.some((scope) => set.has(scope))) return true;
  if (!need) return true;
  const required = Array.isArray(need) ? need : [need];
  return required.some((scope) => set.has(scope));
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const authRoute = Boolean(pathname?.startsWith('/auth'));
  const [collapsed, setCollapsed] = useState(false);
  const [scopes, setScopes] = useState<string[] | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({
    core: true,
    network: true,
    finance: true,
    people: true,
    insight: false,
    platform: false,
  });

  useEffect(() => {
    if (authRoute) return;
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY);
      if (stored != null) setCollapsed(stored === 'true');
      const groupState = localStorage.getItem(GROUP_KEY);
      if (groupState) setOpen((current) => ({ ...current, ...JSON.parse(groupState) }));
    } catch {}
  }, [authRoute]);

  useEffect(() => {
    if (authRoute) return;
    try { localStorage.setItem(COLLAPSE_KEY, String(collapsed)); } catch {}
  }, [collapsed, authRoute]);

  useEffect(() => {
    if (authRoute) return;
    try { localStorage.setItem(GROUP_KEY, JSON.stringify(open)); } catch {}
  }, [open, authRoute]);

  useEffect(() => {
    if (authRoute) { setScopes([]); return; }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
        const payload = await response.json().catch(() => null);
        if (!cancelled) {
          const next = payload?.user?.scopes;
          setScopes(Array.isArray(next) ? next : []);
        }
      } catch {
        if (!cancelled) setScopes([]);
      }
    })();
    return () => { cancelled = true; };
  }, [authRoute]);

  useEffect(() => {
    if (authRoute) return;
    let cancelled = false;
    async function heartbeat(state?: 'AVAILABLE' | 'OFFLINE') {
      if (cancelled) return;
      try {
        await fetch('/api/admin/staff/presence', {
          method: 'POST', credentials: 'include', cache: 'no-store', keepalive: true,
          headers: { 'content-type': 'application/json' }, body: JSON.stringify(state ? { state } : {}),
        });
      } catch {}
    }
    const onVisibility = () => void heartbeat(document.visibilityState === 'hidden' ? 'OFFLINE' : undefined);
    void heartbeat();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void heartbeat();
    }, 60_000);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [authRoute]);

  const groups: Group[] = useMemo(() => [
    {
      key: 'core', label: 'Core operations', icon: Activity,
      requires: ['medical','clinical:read','clinical:write','patients:read','clinicians:read','clinicians:manage'],
      items: [
        { href: '/patients', label: 'Patients', icon: Users, requires: ['medical','clinical:read','clinical:write','patients:read','patients:support','reports:read','hr:read','hr:manage'] },
        { href: '/clinicians', label: 'Clinicians', icon: Stethoscope, requires: ['medical','clinical:read','clinical:write','clinicians:read','clinicians:manage','clinicians:support','hr:read','hr:manage'] },
        { href: '/cases', label: 'Cases', icon: ClipboardList, requires: ['medical','clinical:read','clinical:write'] },
        { href: '/orders', label: 'Orders', icon: Package, requires: ['medical','clinical:read','clinical:write'] },
        { href: '/consult', label: 'Consult', icon: HeartPulse, requires: ['medical','clinical:read','clinical:write'] },
      ],
    },
    {
      key: 'network', label: 'Network & fulfilment', icon: Truck,
      requires: ['medical','careport:read','careport:manage','medreach:read','medreach:manage','clinical:read'],
      items: [
        { href: '/labs', label: 'Labs', icon: FlaskConical, requires: ['medreach:read','medreach:manage','clinical:read','medical'] },
        { href: '/phleb', label: 'Phlebotomists', icon: Syringe, requires: 'medical' },
        { href: '/pharmacies', label: 'Pharmacies', icon: Pill, requires: ['careport:read','careport:manage','clinical:read','medical'] },
        { href: '/rider', label: 'Riders', icon: Bike, requires: 'medical' },
        { href: '/admin/careport', label: 'CarePort admin', icon: Truck, requires: ['careport:read','careport:manage','clinical:read','medical'] },
        { href: '/admin/careport/orders', label: 'Order board', icon: Package, requires: ['careport:read','careport:manage','clinical:read','medical'] },
        { href: '/medreach', label: 'MedReach', icon: Syringe, requires: ['medreach:read','medreach:manage','clinical:read','medical'] },
        { href: '/admin/partner-commercial-tiers', label: 'Partner tiers', icon: Store, requires: 'medical' },
        { href: '/admin/careport/commercial-policy', label: 'CarePort policy', icon: Shield, requires: 'medical' },
        { href: '/admin/careport/catalogue', label: 'Catalogue hub', icon: Store, requires: 'medical' },
        { href: '/admin/careport/kyc', label: 'KYC governance', icon: Shield, requires: 'medical' },
        { href: '/admin/careport/pharmacy-inventory', label: 'Pharmacy inventory', icon: Package, requires: 'medical' },
        { href: '/admin/medreach/commercial-policy', label: 'MedReach policy', icon: Shield, requires: 'medical' },
        { href: '/admin/medreach/onboarding', label: 'MedReach onboarding', icon: ClipboardCheck, requires: 'medical' },
        { href: '/admin/medreach/evidence', label: 'MedReach evidence', icon: FileText, requires: 'medical' },
        { href: '/admin/medreach/reviews', label: 'Review moderation', icon: ClipboardCheck, requires: 'medical' },
      ],
    },
    {
      key: 'finance', label: 'Finance & commerce', icon: WalletCards,
      requires: ['finance','finance:read','finance:manage','finance.manage','manageRoles'],
      items: [
        { href: '/admin/enterprise-finance', label: 'Finance Command Centre', icon: BarChart3, requires: ['finance','finance:read','finance:manage','finance.manage'] },
        { href: '/admin/enterprise-finance/payroll', label: 'Payroll & arrears', icon: WalletCards, requires: ['finance','finance:read','finance:manage','finance.manage'] },
        { href: '/finance/fx', label: 'Forex', icon: ArrowLeftRight, requires: ['finance','finance:read','finance:manage'] },
        { href: '/settings/shop', label: 'Commerce Studio', icon: Store, requires: ['manageRoles'] },
        { href: '/promotions', label: 'Promotions', icon: Sparkles },
        { href: '/settings/insurance', label: 'PI / Malpractice', icon: Shield, requires: ['finance','finance:read','finance:manage'] },
        { href: '/admin/medical-aids', label: 'Medical Aid Schemes', icon: Shield, requires: ['finance','finance:read','finance:manage','partners:read','partners:manage'] },
        { href: '/settings/payouts', label: 'Payout settings', icon: WalletCards, requires: ['finance','finance:read','finance:manage'] },
        { href: '/settings/plans', label: 'Plans', icon: Store, requires: ['manageRoles','finance','finance:read','finance:manage'] },
        { href: '/admin/careport/finance', label: 'CarePort finance', icon: Pill, requires: 'medical' },
        { href: '/admin/medreach/finance', label: 'MedReach finance', icon: Syringe, requires: 'medical' },
      ],
    },
    {
      key: 'people', label: 'People & governance', icon: Users,
      requires: ['hr','hr:read','hr:manage','staff.hr.read','staff.hr.manage','manageRoles','compliance','compliance:read','compliance:manage','communications.use','forms.read','opportunities.read','applications.read'],
      items: [
        { href: '/admin/training', label: 'Training control', icon: CalendarDays, requires: ['medical','hr','manageRoles'] },
        { href: '/admin/calendar', label: 'Training calendar', icon: CalendarDays, requires: ['medical','hr','manageRoles'] },
        { href: '/admin/clinicians/onboarding', label: 'Clinician onboarding', icon: Stethoscope, requires: ['medical','hr','manageRoles','finance'] },
        { href: '/admin/simulation', label: 'Simulation control', icon: ClipboardCheck, requires: ['medical','hr','manageRoles'] },
        { href: '/admin/staff', label: 'Staff directory', icon: Users, requires: ['staff.directory.read','staff.manage','staff.hr.read','staff.hr.manage','hr','hr:read','hr:manage','manageRoles'] },
        { href: '/admin/communications', label: 'Communications', icon: Users, requires: ['communications.use'] },
        { href: '/admin/recruitment', label: 'Recruitment', icon: Briefcase, requires: ['recruitment.templates.read','recruitment.templates.manage','recruitment.settings.manage','applications.onboarding.manage','staff.hr.read','staff.hr.manage','hr','hr:read','hr:manage','manageRoles'] },
        { href: '/admin/meetings', label: 'Meetings', icon: CalendarDays, requires: ['meetings.create','meetings.moderate','meetings.audit.read','applications.interviews.read','applications.interviews.schedule','applications.interviews.manage','applications.interviews.evaluate','applications.onboarding.manage'] },
        { href: '/admin/forms', label: 'Enterprise forms', icon: ClipboardList, requires: ['forms.read','forms.design','forms.publish'] },
        { href: '/admin/opportunities', label: 'Opportunities', icon: Briefcase, requires: ['opportunities.read','opportunities.manage','opportunities.publish'] },
        { href: '/admin/applications', label: 'Applications', icon: ClipboardCheck, requires: ['applications.read','applications.review','applications.assign','applications.decision','applications.documents.read','applications.documents.request','applications.documents.review','applications.interviews.read','applications.interviews.schedule','applications.interviews.manage','applications.interviews.evaluate'] },
        { href: '/admin/legal', label: 'Legal department', icon: Shield, requires: ['manageRoles','compliance','compliance:read','compliance:manage','compliance.read','compliance.manage'] },
        { href: '/admin/clinicians', label: 'Admin clinicians', icon: Stethoscope, requires: ['hr','manageRoles'] },
        { href: '/admin/patients', label: 'Admin patients', icon: Users, requires: ['hr','manageRoles'] },
      ],
    },
    {
      key: 'insight', label: 'Insights & reporting', icon: BarChart3,
      requires: ['reports:read','reports','finance:read','insightcore:read','insightcore:manage','ai:read','ai:governance','research:read','tech'],
      items: [
        { href: '/analytics', label: 'Analytics', icon: BarChart3, requires: ['reports:read','finance:read','finance:manage','insightcore:read','reports','finance'] },
        { href: '/insightcore', label: 'InsightCore', icon: BarChart3, requires: ['insightcore:read','insightcore:manage','ai:read','ai:governance','tech:read','tech:manage','tech'] },
        { href: '/reports', label: 'Reports', icon: FileText, requires: ['reports:read','research:read','reports'] },
      ],
    },
    {
      key: 'platform', label: 'Platform & settings', icon: Settings,
      requires: ['manageRoles','tech','tech:read','tech:manage','devices:read','devices:manage','hr:read','hr:manage','staff.hr.read','staff.hr.manage'],
      items: [
        { href: '/devices', label: 'Devices', icon: Cpu, requires: ['devices:read','devices:manage','tech:read','tech:manage','tech'] },
        { href: '/sdk', label: 'SDK', icon: Cpu, requires: 'tech' },
        { href: '/sdkupload', label: 'SDK upload', icon: Upload, requires: 'tech' },
        { href: '/settings/general', label: 'General settings', icon: Settings, requires: ['manageRoles'] },
        { href: '/settings/roles', label: 'Roles', icon: UserRoundCog, requires: ['manageRoles'] },
        { href: '/settings/consult', label: 'Consult settings', icon: HeartPulse, requires: ['medical','clinical:read','clinical:write','manageRoles'] },
        { href: '/settings/insightcore', label: 'InsightCore settings', icon: BarChart3, requires: ['insightcore:read','insightcore:manage','ai:read','ai:governance','tech:read','tech:manage','tech'] },
        { href: '/settings/people/departments', label: 'Departments', icon: Settings, requires: ['staff.hr.read','staff.hr.manage','hr','hr:read','hr:manage','manageRoles'] },
        { href: '/settings/people/role-requests', label: 'Role requests', icon: UserRoundCog, requires: ['staff.roles.manage','staff.hr.manage','hr','hr:manage','manageRoles'] },
        { href: '/settings/profile', label: 'My profile', icon: UserRoundCog },
      ],
    },
  ], []);

  if (authRoute) return null;

  const active = (href: string) => pathname === href || pathname?.startsWith(href + '/');
  const allowed = (item: Item) => scopes ? hasAny(scopes, item.requires) : !item.requires;

  function itemRow(item: Item) {
    if (!allowed(item)) return null;
    const isActive = active(item.href);
    const Icon = item.icon;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          title={collapsed ? item.label : undefined}
          aria-current={isActive ? 'page' : undefined}
          className={[
            'group flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm transition',
            isActive
              ? 'bg-slate-950 font-bold text-white shadow-sm'
              : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950',
          ].join(' ')}
        >
          <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'}`} />
          {!collapsed ? <span className="truncate">{item.label}</span> : null}
        </Link>
      </li>
    );
  }

  function groupBlock(group: Group) {
    const visibleItems = group.items.filter(allowed);
    const groupAllowed = scopes ? hasAny(scopes, group.requires) : false;
    if (!groupAllowed && visibleItems.length === 0) return null;
    const expanded = Boolean(open[group.key]);
    const containsActive = visibleItems.some((item) => active(item.href));
    const Icon = group.icon;

    if (collapsed) {
      return <li key={group.key} className="space-y-1">{visibleItems.map(itemRow)}</li>;
    }

    return (
      <li key={group.key}>
        <button
          type="button"
          onClick={() => setOpen((current) => ({ ...current, [group.key]: !current[group.key] }))}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.12em] transition ${containsActive ? 'text-slate-950' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`}
          aria-expanded={expanded}
        >
          <Icon className="h-4 w-4" />
          <span className="truncate">{group.label}</span>
          <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] tabular-nums text-slate-500">{visibleItems.length}</span>
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        {expanded ? <ul className="mt-1 space-y-1 border-l border-slate-200 pl-2 ml-5">{visibleItems.map(itemRow)}</ul> : null}
      </li>
    );
  }

  return (
    <aside className={`sticky top-16 flex h-[calc(100vh-64px)] shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 ${collapsed ? 'w-[72px]' : 'w-[286px]'}`}>
      <div className="border-b border-slate-100 p-3">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white"><Activity className="h-5 w-5" /></div>
          {!collapsed ? <div className="min-w-0"><div className="truncate text-sm font-black text-slate-950">Operations Console</div><div className="truncate text-[10px] uppercase tracking-[0.13em] text-slate-400">Ambulant+ Admin</div></div> : null}
          <button type="button" onClick={() => setCollapsed((value) => !value)} className="ml-auto grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-950" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}</button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Admin navigation">
        <ul className="space-y-1">
          {itemRow({ href: '/', label: 'Command Centre', icon: LayoutDashboard })}
          <li className="my-3 border-t border-slate-100" />
          {groups.map(groupBlock)}
        </ul>
      </nav>

      <div className="border-t border-slate-100 p-2">
        {!collapsed ? <div className="mb-2 rounded-xl bg-slate-50 px-3 py-2 text-[10px] leading-4 text-slate-500">Navigation is permission-aware. Hidden modules remain protected at the API boundary.</div> : null}
        <form action="/auth/signout" method="post">
          <button type="submit" title={collapsed ? 'Sign out' : undefined} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-600 transition hover:bg-rose-50 hover:text-rose-700"><LogOut className="h-4 w-4 shrink-0" />{!collapsed ? 'Sign out' : null}</button>
        </form>
      </div>
    </aside>
  );
}
