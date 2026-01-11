// apps/clinician-app/app/practice/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  MapPin,
  ShieldCheck,
  BadgeCheck,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Copy,
  ChevronRight,
  Truck,
  Package,
  CreditCard,
  Receipt,
  Search,
  Info,
} from 'lucide-react';

import { toast } from '@/components/ToastMount';

type PracticeStatus = 'draft' | 'pending' | 'active' | 'suspended';

type PracticeLocation = {
  id: string;
  label: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  isPrimary?: boolean;
};

type PracticeMemberRole = 'owner' | 'clinician' | 'admin' | 'billing' | 'support';

type PracticeMemberSnapshot = {
  id: string;
  fullName?: string | null;
  email?: string | null;
  role: PracticeMemberRole;
  status?: 'active' | 'invited' | 'pending' | 'disabled';
};

type PracticeOverview = {
  id: string;
  name: string;
  practiceNumber?: string | null;
  status: PracticeStatus;
  createdAt?: string | null;
  ownerName?: string | null;

  acceptsMedicalAid?: boolean;
  acceptedSchemes?: string[];

  smartIdDispatch?: 'collect' | 'courier';

  locations: PracticeLocation[];

  memberCounts: {
    total: number;
    owners: number;
    clinicians: number;
    admins: number;
    billing: number;
    support: number;
    pendingInvites: number;
  };

  sampleMembers: PracticeMemberSnapshot[];
};

type PracticeApiResponse = {
  ok?: boolean;
  practice?: any;
  members?: any[];
  data?: any;
  practiceMembers?: any[];
};

const DEMO_PRACTICE: PracticeOverview = {
  id: 'practice-demo-001',
  name: 'Ambulant+ Virtual Care Demo Practice',
  practiceNumber: '1234567-001',
  status: 'active',
  createdAt: new Date().toISOString(),
  ownerName: 'Dr Demo Owner',
  acceptsMedicalAid: true,
  acceptedSchemes: ['Discovery', 'Bonitas', 'Momentum'],
  smartIdDispatch: 'collect',
  locations: [
    {
      id: 'loc-1',
      label: 'Primary virtual location',
      addressLine1: '123 Demo Street',
      addressLine2: 'Sandton',
      city: 'Johannesburg',
      province: 'Gauteng',
      country: 'South Africa',
      isPrimary: true,
    },
  ],
  memberCounts: {
    total: 9,
    owners: 1,
    clinicians: 6,
    admins: 1,
    billing: 0,
    support: 0,
    pendingInvites: 1,
  },
  sampleMembers: [
    { id: 'm-owner', fullName: 'Dr Demo Owner', email: 'owner@example.com', role: 'owner', status: 'active' },
    { id: 'm-clin-1', fullName: 'Dr Virtual GP', email: 'gp@example.com', role: 'clinician', status: 'active' },
    { id: 'm-admin-1', fullName: 'Reception / Admin', email: 'admin@example.com', role: 'admin', status: 'pending' },
    { id: 'm-clin-2', fullName: 'Dr Specialist', email: 'specialist@example.com', role: 'clinician', status: 'invited' },
    { id: 'm-support-1', fullName: 'Support', email: 'support@example.com', role: 'support', status: 'active' },
  ],
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function safeId(prefix = 'id') {
  try {
    // eslint-disable-next-line no-undef
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`;
  }
}

function formatDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

function statusPill(status: PracticeStatus) {
  switch (status) {
    case 'active':
      return { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'pending':
      return { label: 'Pending verification', cls: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'suspended':
      return { label: 'Suspended', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
    case 'draft':
    default:
      return { label: 'Draft', cls: 'bg-slate-50 text-slate-700 border-slate-200' };
  }
}

function roleLabel(r: PracticeMemberRole) {
  switch (r) {
    case 'owner':
      return 'Owner';
    case 'clinician':
      return 'Clinician';
    case 'admin':
      return 'Admin';
    case 'billing':
      return 'Billing';
    case 'support':
      return 'Support';
    default:
      return 'Member';
  }
}

function memberStatusPill(s?: PracticeMemberSnapshot['status']) {
  const base = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold';
  if (!s || s === 'active') return { text: 'Active', cls: `${base} bg-emerald-50 text-emerald-700 border-emerald-200` };
  if (s === 'invited') return { text: 'Invited', cls: `${base} bg-indigo-50 text-indigo-700 border-indigo-200` };
  if (s === 'pending') return { text: 'Pending', cls: `${base} bg-amber-50 text-amber-800 border-amber-200` };
  return { text: 'Disabled', cls: `${base} bg-slate-50 text-slate-700 border-slate-200` };
}

function normalizePractice(raw: any): PracticeOverview {
  if (!raw) return DEMO_PRACTICE;

  const root = raw.practice ?? raw.data ?? raw;

  const id = String(root.id ?? root.practiceId ?? 'practice-unknown');
  const name = root.name ?? root.practiceName ?? root.displayName ?? 'Unnamed practice';

  const practiceNumber =
    root.practiceNumber ?? root.practiceNo ?? root.bhfNumber ?? root.practiceCode ?? root.practiceIdNumber ?? null;

  const status: PracticeStatus = (root.status as PracticeStatus) ?? (root.approvalStatus as PracticeStatus) ?? 'pending';

  const ownerName = root.ownerName ?? root.owner?.fullName ?? root.owner?.name ?? null;

  const acceptsMedicalAid =
    typeof root.acceptsMedicalAid === 'boolean'
      ? root.acceptsMedicalAid
      : !!root.medicalAidEnabled || !!root.insuranceEnabled || !!root.meta?.acceptsMedicalAid;

  const acceptedSchemes: string[] = Array.isArray(root.acceptedSchemes)
    ? root.acceptedSchemes
    : Array.isArray(root.meta?.acceptedSchemes)
      ? root.meta.acceptedSchemes
      : [];

  const smartIdDispatch: 'collect' | 'courier' | undefined =
    root.smartIdDispatch ?? root.meta?.smartIdDispatch ?? undefined;

  const locSrc =
    root.locations ?? root.practiceLocations ?? root.addresses ?? (root.primaryLocation ? [root.primaryLocation] : []);

  const locations: PracticeLocation[] = Array.isArray(locSrc)
    ? locSrc.map((l: any, idx: number): PracticeLocation => ({
        id: String(l.id ?? l.locationId ?? `loc-${idx + 1}`) || `loc-${idx + 1}`,
        label: l.label ?? l.name ?? (idx === 0 ? 'Primary location' : 'Location'),
        addressLine1: l.addressLine1 ?? l.line1 ?? l.street ?? l.address ?? null,
        addressLine2: l.addressLine2 ?? l.line2 ?? l.suburb ?? null,
        city: l.city ?? null,
        province: l.province ?? l.state ?? l.region ?? null,
        country: l.country ?? l.countryCode ?? 'South Africa',
        isPrimary: !!l.isPrimary || idx === 0 || root.primaryLocationId === l.id,
      }))
    : DEMO_PRACTICE.locations;

  const membersSrc: any[] = Array.isArray(raw.members)
    ? raw.members
    : Array.isArray(raw.practiceMembers)
      ? raw.practiceMembers
      : Array.isArray(root.members)
        ? root.members
        : [];

  const allMembers: PracticeMemberSnapshot[] = membersSrc.map((m: any, idx: number): PracticeMemberSnapshot => {
    const roleStr = String(m.role ?? m.membershipRole ?? m.type ?? 'clinician').toLowerCase();
    const role: PracticeMemberRole =
      roleStr === 'owner'
        ? 'owner'
        : roleStr === 'admin' || roleStr === 'practice_admin'
          ? 'admin'
          : roleStr === 'billing'
            ? 'billing'
            : roleStr === 'support'
              ? 'support'
              : 'clinician';

    const statusStr = String(m.status ?? m.membershipStatus ?? 'active').toLowerCase();
    const status: 'active' | 'invited' | 'pending' | 'disabled' =
      statusStr === 'invited'
        ? 'invited'
        : statusStr === 'pending'
          ? 'pending'
          : statusStr === 'disabled'
            ? 'disabled'
            : 'active';

    return {
      id: String(m.id ?? m.memberId ?? m.userId ?? `m-${idx}` ?? safeId('m')),
      fullName: m.fullName ?? m.name ?? m.displayName ?? null,
      email: m.email ?? m.contactEmail ?? null,
      role,
      status,
    };
  });

  let owners = 0;
  let clinicians = 0;
  let admins = 0;
  let billing = 0;
  let support = 0;
  let pendingInvites = 0;

  for (const m of allMembers) {
    if (m.role === 'owner') owners++;
    else if (m.role === 'clinician') clinicians++;
    else if (m.role === 'admin') admins++;
    else if (m.role === 'billing') billing++;
    else if (m.role === 'support') support++;

    if (m.status === 'invited' || m.status === 'pending') pendingInvites++;
  }

  const sampleMembers = (allMembers.length ? allMembers : DEMO_PRACTICE.sampleMembers).slice(0, 8);

  return {
    id,
    name,
    practiceNumber,
    status,
    createdAt: root.createdAt ?? root.created_at ?? root.createdDate ?? null,
    ownerName,
    acceptsMedicalAid,
    acceptedSchemes,
    smartIdDispatch,
    locations,
    memberCounts: {
      total: allMembers.length || sampleMembers.length,
      owners,
      clinicians,
      admins,
      billing,
      support,
      pendingInvites,
    },
    sampleMembers,
  };
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-slate-200/70', className)} />;
}

function StatCard({
  icon: Icon,
  title,
  value,
  sub,
  tone = 'default',
  right,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'default' | 'good' | 'warn' | 'danger';
  right?: React.ReactNode;
}) {
  const toneCls =
    tone === 'good'
      ? 'bg-emerald-50 border-emerald-200'
      : tone === 'warn'
        ? 'bg-amber-50 border-amber-200'
        : tone === 'danger'
          ? 'bg-rose-50 border-rose-200'
          : 'bg-white border-slate-200';

  return (
    <div className={cx('rounded-2xl border p-4 shadow-sm shadow-black/[0.04]', toneCls)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/70">
            <Icon className="h-5 w-5 text-slate-700" />
          </div>
          <div>
            <div className="text-xs font-black text-slate-500">{title}</div>
            <div className="mt-1 text-xl font-black tracking-tight text-slate-950">{value}</div>
            {sub ? <div className="mt-1 text-xs text-slate-600">{sub}</div> : null}
          </div>
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </div>
  );
}

type TabKey = 'overview' | 'locations' | 'team' | 'funding';

function Tabs({ value, onChange }: { value: TabKey; onChange: (v: TabKey) => void }) {
  const items: Array<{ k: TabKey; label: string; icon: any }> = [
    { k: 'overview', label: 'Overview', icon: Building2 },
    { k: 'locations', label: 'Locations', icon: MapPin },
    { k: 'team', label: 'Team', icon: Users },
    { k: 'funding', label: 'Funding & Smart ID', icon: CreditCard },
  ];

  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 p-2 backdrop-blur">
      {items.map((it) => {
        const active = it.k === value;
        const Icon = it.icon;
        return (
          <button
            key={it.k}
            type="button"
            onClick={() => onChange(it.k)}
            className={cx(
              'inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-extrabold transition',
              active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100',
            )}
          >
            <Icon className="h-4 w-4" />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

export default function PracticeOverviewPage() {
  const [practice, setPractice] = useState<PracticeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [usingDemo, setUsingDemo] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>('overview');

  const [memberQuery, setMemberQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    const setBusy = mode === 'refresh' ? setRefreshing : setLoading;

    try {
      setBusy(true);
      if (mode === 'initial') {
        setUsingDemo(false);
        setErr(null);
      }

      const res = await fetch('/api/practice/me', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const js: PracticeApiResponse = await res.json().catch(() => ({} as any));
      const raw = js.practice ?? js.data ?? (js.ok ? js : null);
      if (!raw) throw new Error('API did not return a practice object');

      const mapped = normalizePractice({
        practice: raw,
        members: js.members,
        practiceMembers: js.practiceMembers,
      });

      setPractice(mapped);

      if (mode === 'refresh') toast('Practice refreshed.', 'success');
    } catch (e: any) {
      console.warn('[practice] /api/practice/me failed', e);

      if (mode === 'initial') {
        setPractice(DEMO_PRACTICE);
        setUsingDemo(true);
        setErr(e?.message || 'Practice endpoint not available; showing demo overview.');
        toast('Showing demo practice (wire /api/practice/me to load real data).', 'info');
      } else {
        toast(e?.message || 'Could not refresh practice right now.', 'error');
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await load('initial');
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const primaryLocation = useMemo(() => {
    return practice?.locations.find((l) => l.isPrimary) ?? practice?.locations[0] ?? null;
  }, [practice]);

  const pill = useMemo(() => statusPill(practice?.status ?? 'pending'), [practice?.status]);

  const practiceSince = useMemo(() => formatDate(practice?.createdAt), [practice?.createdAt]);

  const completeness = useMemo(() => {
    if (!practice) return { pct: 0, note: 'Loading…' };

    let score = 0;
    const max = 6;

    if (practice.name) score++;
    if (practice.practiceNumber) score++;
    if (primaryLocation?.addressLine1 && primaryLocation?.city) score++;
    if (practice.ownerName) score++;
    if (typeof practice.acceptsMedicalAid === 'boolean') score++;
    if (practice.smartIdDispatch) score++;

    const pct = Math.round((score / max) * 100);
    const note =
      pct >= 90
        ? 'Excellent — ready for scale.'
        : pct >= 70
          ? 'Good — a few details to complete.'
          : pct >= 40
            ? 'Needs attention — fill in key practice details.'
            : 'Incomplete — add identity + location + funding details.';

    return { pct, note };
  }, [practice, primaryLocation]);

  const filteredLocations = useMemo(() => {
    const q = locationQuery.trim().toLowerCase();
    const locs = practice?.locations ?? [];
    if (!q) return locs;
    return locs.filter((l) => {
      const s = [l.label, l.addressLine1, l.addressLine2, l.city, l.province, l.country]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return s.includes(q);
    });
  }, [practice?.locations, locationQuery]);

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    const ms = practice?.sampleMembers ?? [];
    if (!q) return ms;
    return ms.filter((m) => {
      const s = [m.fullName, m.email, m.role, m.status].filter(Boolean).join(' ').toLowerCase();
      return s.includes(q);
    });
  }, [practice?.sampleMembers, memberQuery]);

  const copyText = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} copied.`, 'success');
    } catch {
      toast(`Could not copy ${label}.`, 'error');
    }
  }, []);

  if (loading && !practice) {
    return (
      <div className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Skeleton className="h-6 w-56" />
            <Skeleton className="mt-2 h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-72" />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Skeleton className="h-[360px]" />
          <Skeleton className="h-[360px]" />
        </div>
      </div>
    );
  }

  if (!practice) {
    return (
      <div className="w-full">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-lg font-black text-slate-950">Practice unavailable</div>
          <div className="mt-1 text-sm text-slate-600">We couldn’t load your practice data right now.</div>
          <button
            type="button"
            onClick={() => load('refresh')}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  const dispatchLabel =
    practice.smartIdDispatch === 'courier' ? 'Courier' : practice.smartIdDispatch === 'collect' ? 'Collection' : 'Not configured';

  return (
    <div className="w-full">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(900px_circle_at_12%_-20%,rgba(99,102,241,0.18),transparent_55%),radial-gradient(850px_circle_at_100%_0%,rgba(16,185,129,0.14),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.86),rgba(248,250,252,1))] p-5 shadow-sm shadow-black/[0.05]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[260px]">
            <div className="flex items-center gap-2 text-xs font-black text-slate-500">
              <span>Workspace</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-slate-700">Practice</span>
              {usingDemo ? (
                <span className="ml-2 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                  Demo mode
                </span>
              ) : null}
            </div>

            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{practice.name}</h1>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className={cx('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-extrabold', pill.cls)}>
                {pill.label}
              </span>

              {practice.practiceNumber ? (
                <button
                  type="button"
                  onClick={() => copyText(String(practice.practiceNumber), 'Practice number')}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-white"
                  title="Copy practice number"
                >
                  <span className="font-mono">{practice.practiceNumber}</span>
                  <Copy className="h-3 w-3" />
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/60 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  <Info className="h-3 w-3" />
                  Add practice number in Practice profile
                </span>
              )}

              {practiceSince ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/60 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  Since {practiceSince}
                </span>
              ) : null}

              {primaryLocation?.city ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/60 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  <MapPin className="h-3 w-3" />
                  {primaryLocation.city}
                  {primaryLocation.province ? `, ${primaryLocation.province}` : ''}
                </span>
              ) : null}
            </div>

            {err ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                {err}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col items-end gap-2">
            <Tabs value={tab} onChange={setTab} />

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => load('refresh')}
                className={cx(
                  'inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-white',
                  refreshing && 'pointer-events-none opacity-70',
                )}
              >
                <RefreshCw className={cx('h-4 w-4', refreshing && 'animate-spin')} />
                Refresh
              </button>

              <Link
                href="/practice/members"
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-extrabold text-white hover:bg-slate-800"
              >
                <Users className="h-4 w-4" />
                Manage team
              </Link>

              <Link
                href="/practice/profile"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-white"
              >
                <ExternalLink className="h-4 w-4" />
                Edit practice
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* KPI row */}
      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard
          icon={ShieldCheck}
          title="Profile readiness"
          value={`${completeness.pct}%`}
          sub={completeness.note}
          tone={completeness.pct >= 80 ? 'good' : completeness.pct >= 55 ? 'warn' : 'danger'}
          right={
            <div className="rounded-2xl border border-slate-200 bg-white/70 px-2 py-1 text-[10px] font-extrabold text-slate-700">
              ID: <span className="font-mono">{practice.id}</span>
            </div>
          }
        />

        <StatCard
          icon={Users}
          title="Team"
          value={practice.memberCounts.total}
          sub={
            <span>
              {practice.memberCounts.clinicians} clinicians • {practice.memberCounts.pendingInvites} pending
            </span>
          }
        />

        <StatCard
          icon={Receipt}
          title="Medical aid"
          value={practice.acceptsMedicalAid ? 'Enabled' : 'Not enabled'}
          sub={
            practice.acceptsMedicalAid && (practice.acceptedSchemes?.length ?? 0) > 0 ? (
              <span className="line-clamp-1">{practice.acceptedSchemes!.join(', ')}</span>
            ) : (
              <span className="text-slate-600">Configure schemes in Practice settings</span>
            )
          }
          tone={practice.acceptsMedicalAid ? 'good' : 'default'}
        />

        <StatCard
          icon={practice.smartIdDispatch === 'courier' ? Truck : Package}
          title="Smart ID dispatch"
          value={dispatchLabel}
          sub={
            practice.smartIdDispatch === 'courier'
              ? 'Delivered to practice address'
              : practice.smartIdDispatch === 'collect'
                ? 'Collected at reception'
                : 'Defaults to collection'
          }
        />
      </section>

      {/* Content */}
      <section className="mt-6">
        {tab === 'overview' ? (
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            {/* Overview left */}
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-black/[0.04]">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-black text-slate-900">Practice overview</div>
                <div className="text-[11px] text-slate-500">
                  Primary location:{' '}
                  <span className="font-semibold text-slate-700">{primaryLocation?.label ?? '—'}</span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <InfoRow
                  icon={Building2}
                  label="Owner"
                  value={practice.ownerName ?? 'Not set'}
                  hint="Owner name is used for practice verification and audit."
                />
                <InfoRow
                  icon={MapPin}
                  label="Primary address"
                  value={
                    primaryLocation
                      ? [
                          primaryLocation.addressLine1,
                          primaryLocation.addressLine2,
                          [primaryLocation.city, primaryLocation.province].filter(Boolean).join(', '),
                          primaryLocation.country,
                        ]
                          .filter(Boolean)
                          .join(' • ')
                      : 'No address captured'
                  }
                  hint="Maintain addresses in Practice profile."
                />
                <InfoRow
                  icon={BadgeCheck}
                  label="Status"
                  value={pill.label}
                  hint={
                    practice.status === 'pending'
                      ? 'Pending practices may have limited funding/payout features until verified.'
                      : 'Status reflects verification and compliance state.'
                  }
                />
                <InfoRow
                  icon={CreditCard}
                  label="Funding mode"
                  value={practice.acceptsMedicalAid ? 'Medical aid + cash' : 'Cash / private'}
                  hint="Funding affects claims routing and patient payment options."
                />
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <div className="text-xs font-black text-slate-800">Recommended next actions</div>
                  <div className="mt-1 text-xs text-slate-600">
                    Keep your practice profile complete — it improves patient trust, claim routing, and payout accuracy.
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <ActionLink href="/practice/profile" title="Complete practice profile" desc="Practice number, addresses, owner identity." />
                  <ActionLink href="/practice/members" title="Invite team members" desc="Admins, clinicians, billing and support." />
                  <ActionLink href="/practice/payout" title="Configure payouts & dispatch" desc="Smart ID routing, splits, plan." />
                  <ActionLink href="/practice/claims" title="Review funding & claims" desc="Understand reimbursement and routing." />
                </div>
              </div>
            </div>

            {/* Overview right */}
            <div className="space-y-4">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-black/[0.04]">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-black text-slate-900">Team snapshot</div>
                  <Link href="/practice/members" className="text-[11px] font-extrabold text-indigo-700 hover:underline">
                    Manage
                  </Link>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <MiniStat label="Owners" value={practice.memberCounts.owners} />
                  <MiniStat label="Clinicians" value={practice.memberCounts.clinicians} />
                  <MiniStat label="Admins" value={practice.memberCounts.admins} />
                  <MiniStat label="Pending" value={practice.memberCounts.pendingInvites} tone="warn" />
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-[11px] font-extrabold text-slate-800">
                    <Search className="h-3.5 w-3.5" />
                    Quick filter
                  </div>
                  <input
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                    placeholder="Search name, email, role…"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-slate-400"
                  />
                </div>

                <ul className="mt-4 space-y-2">
                  {filteredMembers.length === 0 ? (
                    <li className="text-xs text-slate-500">No matching members in the preview.</li>
                  ) : (
                    filteredMembers.map((m) => {
                      const st = memberStatusPill(m.status);
                      return (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-xs font-extrabold text-slate-900">{m.fullName ?? m.email ?? m.id}</div>
                            <div className="mt-0.5 truncate text-[11px] text-slate-600">
                              {m.email ?? '—'} • {roleLabel(m.role)}
                            </div>
                          </div>
                          <span className={st.cls}>{st.text}</span>
                        </li>
                      );
                    })
                  )}
                </ul>

                <div className="mt-4 text-[11px] text-slate-500">
                  Preview only. Full roster & invites live under <span className="font-semibold text-slate-700">Practice → Team</span>.
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-2 text-xs font-black text-slate-900">
                  <Info className="h-4 w-4 text-slate-600" />
                  Wiring note
                </div>
                <div className="mt-2 text-[11px] text-slate-700">
                  This page loads from <code className="font-mono">GET /api/practice/me</code>.
                  Members are shown as a preview; full management is on <code className="font-mono">/practice/members</code>.
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'locations' ? (
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-black/[0.04]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-900">Practice locations</div>
                <div className="mt-1 text-xs text-slate-600">
                  Locations are used for Smart ID dispatch, compliance audit, and patient-facing address display.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                    placeholder="Search locations…"
                    className="w-64 max-w-[70vw] rounded-2xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-slate-400"
                  />
                </div>
                <Link
                  href="/practice/profile"
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-extrabold text-white hover:bg-slate-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  Edit in profile
                </Link>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {filteredLocations.length === 0 ? (
                <div className="text-xs text-slate-500">No matching locations found.</div>
              ) : (
                filteredLocations.map((loc) => (
                  <div key={loc.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-xs font-extrabold text-slate-900">{loc.label}</div>
                          {loc.isPrimary ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                              Primary
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-700">
                          {[loc.addressLine1, loc.addressLine2].filter(Boolean).join(', ') || '—'}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-600">
                          {[loc.city, loc.province, loc.country].filter(Boolean).join(', ') || '—'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const txt = [loc.label, loc.addressLine1, loc.addressLine2, [loc.city, loc.province].filter(Boolean).join(', '), loc.country]
                            .filter(Boolean)
                            .join('\n');
                          copyText(txt, 'Address');
                        }}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-extrabold text-slate-700 hover:bg-slate-100"
                        title="Copy address"
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {tab === 'team' ? (
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-black/[0.04]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-900">Team & roles</div>
                <div className="mt-1 text-xs text-slate-600">
                  Owners control practice identity. Admins support operations. Clinicians provide care. Use Team to invite, disable, or change roles.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/practice/members"
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-extrabold text-white hover:bg-slate-800"
                >
                  <Users className="h-4 w-4" />
                  Open Team
                </Link>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-black text-slate-800">Role counts</div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <MiniStat label="Owners" value={practice.memberCounts.owners} />
                  <MiniStat label="Clinicians" value={practice.memberCounts.clinicians} />
                  <MiniStat label="Admins" value={practice.memberCounts.admins} />
                  <MiniStat label="Billing" value={practice.memberCounts.billing} />
                  <MiniStat label="Support" value={practice.memberCounts.support} />
                  <MiniStat label="Pending" value={practice.memberCounts.pendingInvites} tone="warn" />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-black text-slate-800">Quick filter</div>
                <div className="mt-2 text-[11px] text-slate-600">
                  This tab shows a preview list (up to 8). Team page shows the full roster.
                </div>
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                    placeholder="Search preview…"
                    className="w-full rounded-2xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-slate-400"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="text-xs font-black text-slate-900">Preview members</div>
              <ul className="mt-3 grid gap-2 md:grid-cols-2">
                {filteredMembers.map((m) => {
                  const st = memberStatusPill(m.status);
                  return (
                    <li key={m.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-extrabold text-slate-900">{m.fullName ?? m.email ?? m.id}</div>
                          <div className="mt-1 truncate text-[11px] text-slate-600">{m.email ?? '—'}</div>
                          <div className="mt-2 inline-flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-extrabold text-slate-700">
                              {roleLabel(m.role)}
                            </span>
                            <span className={st.cls}>{st.text}</span>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 flex justify-end">
                <Link
                  href="/practice/members"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
                >
                  Manage full team
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'funding' ? (
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-black/[0.04]">
              <div className="text-sm font-black text-slate-900">Funding & Smart ID</div>
              <div className="mt-1 text-xs text-slate-600">
                Funding configuration impacts claims, patient checkout, and payout accuracy. Smart ID dispatch controls how kits are routed.
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <InfoRow
                  icon={Receipt}
                  label="Medical aid participation"
                  value={practice.acceptsMedicalAid ? 'Enabled' : 'Not enabled'}
                  hint="Enable to route claims and show medical-aid options in patient checkout."
                />
                <InfoRow
                  icon={CreditCard}
                  label="Accepted schemes"
                  value={practice.acceptsMedicalAid ? (practice.acceptedSchemes?.length ? practice.acceptedSchemes.join(', ') : 'None listed yet') : '—'}
                  hint="Keep this updated so claim routing remains accurate."
                />
                <InfoRow
                  icon={practice.smartIdDispatch === 'courier' ? Truck : Package}
                  label="Smart ID dispatch mode"
                  value={dispatchLabel}
                  hint="Collection = patient picks up at reception. Courier = delivered to practice address."
                />
                <InfoRow
                  icon={BadgeCheck}
                  label="Recommended"
                  value={practice.smartIdDispatch ? 'Configured' : 'Set your dispatch mode'}
                  hint="Configure in Practice payouts to avoid fulfillment delays."
                />
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-black text-slate-900">Where to configure</div>
                <div className="mt-1 text-xs text-slate-700">
                  Dispatch, plan tier, and payout settings live in <span className="font-semibold">Practice payouts</span>.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/practice/payout"
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white hover:bg-slate-800"
                  >
                    <CreditCard className="h-4 w-4" />
                    Open Practice payouts
                  </Link>
                  <Link
                    href="/practice/claims"
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
                  >
                    <Receipt className="h-4 w-4" />
                    View Claims
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-2 text-xs font-black text-slate-900">
                <AlertTriangle className="h-4 w-4 text-slate-600" />
                Operational notes
              </div>

              <ul className="mt-3 space-y-2 text-[11px] text-slate-700">
                <li className="rounded-2xl border border-slate-200 bg-white p-3">
                  If your practice is <span className="font-semibold">Pending</span>, some funding/payout flows may be limited until verification is complete.
                </li>
                <li className="rounded-2xl border border-slate-200 bg-white p-3">
                  Keep your <span className="font-semibold">primary address</span> accurate when using courier dispatch to avoid failed deliveries.
                </li>
                <li className="rounded-2xl border border-slate-200 bg-white p-3">
                  For medical-aid routing, ensure accepted schemes are consistent with your billing setup and codes.
                </li>
              </ul>
            </div>
          </div>
        ) : null}
      </section>

      <div className="mt-6 text-center text-[11px] text-slate-500">
        {refreshing ? 'Refreshing practice…' : 'Tip: refresh after updating profile, settings, or team to see the latest snapshot here.'}
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
          <Icon className="h-4 w-4 text-slate-700" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-black text-slate-500">{label}</div>
          <div className="mt-1 break-words text-xs font-extrabold text-slate-900">{value}</div>
          {hint ? <div className="mt-1 text-[11px] text-slate-600">{hint}</div> : null}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone = 'default' }: { label: string; value: React.ReactNode; tone?: 'default' | 'warn' }) {
  return (
    <div className={cx('rounded-2xl border px-3 py-2', tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white')}>
      <div className="text-[10px] font-black text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-black text-slate-900">{value}</div>
    </div>
  );
}

function ActionLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="group rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:bg-slate-50">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold text-slate-900">{title}</div>
          <div className="mt-1 text-[11px] text-slate-600">{desc}</div>
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 text-slate-400 transition group-hover:text-slate-700" />
      </div>
    </Link>
  );
}
