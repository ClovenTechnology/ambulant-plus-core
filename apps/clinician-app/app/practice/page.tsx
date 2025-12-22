// apps/clinician-app/app/practice/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

  // Funding & insurance
  acceptsMedicalAid?: boolean;
  acceptedSchemes?: string[];

  // Smart ID dispatch mode (read-only summary, editable under /payout)
  smartIdDispatch?: 'collect' | 'courier';

  // Locations
  locations: PracticeLocation[];

  // Snapshot of members
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
  // Some backends may flatten
  data?: any;
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
    total: 4,
    owners: 1,
    clinicians: 2,
    admins: 1,
    billing: 0,
    support: 0,
    pendingInvites: 1,
  },
  sampleMembers: [
    {
      id: 'm-owner',
      fullName: 'Dr Demo Owner',
      email: 'owner@example.com',
      role: 'owner',
      status: 'active',
    },
    {
      id: 'm-clin-1',
      fullName: 'Dr Virtual GP',
      email: 'gp@example.com',
      role: 'clinician',
      status: 'active',
    },
    {
      id: 'm-admin-1',
      fullName: 'Reception / Admin',
      email: 'admin@example.com',
      role: 'admin',
      status: 'pending',
    },
  ],
};

function normalizePractice(raw: any): PracticeOverview {
  if (!raw) return DEMO_PRACTICE;

  const root = raw.practice ?? raw.data ?? raw;

  const id = String(root.id ?? root.practiceId ?? 'practice-unknown');
  const name =
    root.name ??
    root.practiceName ??
    root.displayName ??
    'Unnamed practice';

  const practiceNumber =
    root.practiceNumber ??
    root.practiceNo ??
    root.bhfNumber ??
    root.practiceCode ??
    null;

  const status: PracticeStatus =
    (root.status as PracticeStatus) ??
    (root.approvalStatus as PracticeStatus) ??
    'pending';

  const ownerName =
    root.ownerName ??
    root.owner?.fullName ??
    root.owner?.name ??
    null;

  const acceptsMedicalAid =
    typeof root.acceptsMedicalAid === 'boolean'
      ? root.acceptsMedicalAid
      : !!root.medicalAidEnabled ||
        !!root.insuranceEnabled ||
        !!root.meta?.acceptsMedicalAid;

  const acceptedSchemes: string[] = Array.isArray(root.acceptedSchemes)
    ? root.acceptedSchemes
    : Array.isArray(root.meta?.acceptedSchemes)
    ? root.meta.acceptedSchemes
    : [];

  const smartIdDispatch: 'collect' | 'courier' | undefined =
    root.smartIdDispatch ??
    root.meta?.smartIdDispatch ??
    undefined;

  const locSrc =
    root.locations ??
    root.practiceLocations ??
    root.addresses ??
    (root.primaryLocation ? [root.primaryLocation] : []);

  const locations: PracticeLocation[] = Array.isArray(locSrc)
    ? locSrc.map((l: any, idx: number): PracticeLocation => ({
        id:
          String(l.id ?? l.locationId ?? `loc-${idx + 1}`) ||
          `loc-${idx + 1}`,
        label:
          l.label ??
          l.name ??
          (idx === 0 ? 'Primary location' : 'Location'),
        addressLine1:
          l.addressLine1 ??
          l.line1 ??
          l.street ??
          l.address ??
          null,
        addressLine2:
          l.addressLine2 ??
          l.line2 ??
          l.suburb ??
          null,
        city: l.city ?? null,
        province:
          l.province ?? l.state ?? l.region ?? null,
        country:
          l.country ??
          l.countryCode ??
          'South Africa',
        isPrimary:
          !!l.isPrimary ||
          idx === 0 ||
          root.primaryLocationId === l.id,
      }))
    : DEMO_PRACTICE.locations;

  const membersSrc: any[] = Array.isArray(raw.members)
    ? raw.members
    : Array.isArray(root.members)
    ? root.members
    : [];

  const sampleMembers: PracticeMemberSnapshot[] = membersSrc
    .slice(0, 5)
    .map((m: any): PracticeMemberSnapshot => {
      const roleStr = String(
        m.role ??
          m.membershipRole ??
          m.type ??
          'clinician',
      ).toLowerCase();

      const role: PracticeMemberRole =
        roleStr === 'owner'
          ? 'owner'
          : roleStr === 'admin' ||
            roleStr === 'practice_admin'
          ? 'admin'
          : roleStr === 'billing'
          ? 'billing'
          : roleStr === 'support'
          ? 'support'
          : 'clinician';

      const statusStr = String(
        m.status ?? m.membershipStatus ?? 'active',
      ).toLowerCase();

      const status: 'active' | 'invited' | 'pending' | 'disabled' =
        statusStr === 'invited'
          ? 'invited'
          : statusStr === 'pending'
          ? 'pending'
          : statusStr === 'disabled'
          ? 'disabled'
          : 'active';

      return {
        id: String(m.id ?? m.memberId ?? m.userId ?? crypto.randomUUID()),
        fullName:
          m.fullName ??
          m.name ??
          m.displayName ??
          null,
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

  for (const m of sampleMembers) {
    if (m.role === 'owner') owners++;
    else if (m.role === 'clinician') clinicians++;
    else if (m.role === 'admin') admins++;
    else if (m.role === 'billing') billing++;
    else if (m.role === 'support') support++;

    if (m.status === 'invited' || m.status === 'pending') {
      pendingInvites++;
    }
  }

  const memberCounts = {
    total: sampleMembers.length,
    owners,
    clinicians,
    admins,
    billing,
    support,
    pendingInvites,
  };

  return {
    id,
    name,
    practiceNumber,
    status,
    createdAt:
      root.createdAt ??
      root.created_at ??
      root.createdDate ??
      null,
    ownerName,
    acceptsMedicalAid,
    acceptedSchemes,
    smartIdDispatch,
    locations,
    memberCounts,
    sampleMembers,
  };
}

function statusBadgeClasses(status: PracticeStatus): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'pending':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'suspended':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'draft':
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

export default function PracticeOverviewPage() {
  const router = useRouter();
  const [practice, setPractice] = useState<PracticeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setUsingDemo(false);
        setErr(null);

        // Clinician-app API route expected to proxy → gateway
        // GET /api/practice/me should return { ok, practice, members? }
        const res = await fetch('/api/practice/me', {
          cache: 'no-store',
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const js: PracticeApiResponse = await res
          .json()
          .catch(() => ({} as any));

        const raw =
          js.practice ??
          js.data ??
          (js.ok ? js : null);

        if (!raw) {
          throw new Error(
            'API did not return a practice object',
          );
        }

        if (cancelled) return;
        const mapped = normalizePractice({
          practice: raw,
          members: js.members,
        });
        setPractice(mapped);
      } catch (e: any) {
        console.warn(
          '[practice] /api/practice/me failed, using demo',
          e,
        );
        if (cancelled) return;
        setPractice(DEMO_PRACTICE);
        setUsingDemo(true);
        setErr(
          e?.message ||
            'Practice endpoint not available; showing demo overview.',
        );
        toast(
          'Showing a demo practice overview (wire /api/practice/me to your gateway to load real data).',
          'info',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const primaryLocation = useMemo(
    () => practice?.locations.find((l) => l.isPrimary) ?? practice?.locations[0],
    [practice],
  );

  if (!practice) {
    return (
      <main className="p-6">
        <div className="text-sm text-gray-600">
          Loading practice…
        </div>
      </main>
    );
  }

  const {
    name,
    practiceNumber,
    status,
    createdAt,
    ownerName,
    memberCounts,
    acceptsMedicalAid,
    acceptedSchemes,
    smartIdDispatch,
    locations,
    sampleMembers,
  } = practice;

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Practice Overview
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            High-level view of your practice identity, locations,
            medical-aid participation and team. Detailed member
            management lives under{' '}
            <button
              type="button"
              onClick={() => router.push('/practice/members')}
              className="underline"
            >
              Practice → Members
            </button>
            .
          </p>

          {usingDemo && (
            <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800 max-w-xl">
              Demo mode – not connected to the API gateway. Implement{' '}
              <code className="font-mono">
                GET /api/practice/me
              </code>{' '}
              in the clinician-app to load real practice data.
            </div>
          )}

          {err && !usingDemo && (
            <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800 max-w-xl">
              {err}
            </div>
          )}
        </div>

        {/* Status / meta */}
        <div className="flex flex-col items-end gap-1 text-xs text-gray-600">
          <span className="font-mono text-[11px]">
            ID: {practice.id}
          </span>
          <div className="inline-flex items-center gap-2">
            <span
              className={
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ' +
                statusBadgeClasses(status)
              }
            >
              {status}
            </span>
            {createdAt && (
              <span className="text-[11px] text-gray-500">
                Since{' '}
                {new Date(
                  createdAt,
                ).toLocaleDateString()}
              </span>
            )}
          </div>
          {ownerName && (
            <span className="text-[11px] text-gray-500">
              Owner: {ownerName}
            </span>
          )}
        </div>
      </header>

      {/* Top summary grid */}
      <section className="grid gap-4 md:grid-cols-3">
        {/* Identity card */}
        <div className="rounded-lg border bg-white p-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Identity
          </h3>
          <div className="text-sm font-medium text-gray-800">
            {name}
          </div>
          <div className="text-xs text-gray-600 space-y-0.5">
            {practiceNumber && (
              <div>
                Practice / BHF number:{' '}
                <span className="font-mono">
                  {practiceNumber}
                </span>
              </div>
            )}
            {primaryLocation && (
              <div>
                Primary location:{' '}
                <span>
                  {primaryLocation.city ??
                    primaryLocation.label}
                  {primaryLocation.province
                    ? `, ${primaryLocation.province}`
                    : ''}
                </span>
              </div>
            )}
          </div>
          <div className="pt-2 text-xs text-gray-500">
            Edit your practice name, number and address under{' '}
            <Link
              href="/settings/profile"
              className="underline"
            >
              Settings → Profile
            </Link>{' '}
            (Practice &amp; insurance section).
          </div>
        </div>

        {/* Members snapshot */}
        <div className="rounded-lg border bg-white p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Team snapshot
            </h3>
            <Link
              href="/practice/members"
              className="text-[11px] underline text-indigo-700"
            >
              Manage members
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border bg-gray-50 px-2 py-1.5">
              <div className="text-[11px] text-gray-500">
                Total members
              </div>
              <div className="text-lg font-semibold">
                {memberCounts.total}
              </div>
            </div>
            <div className="rounded border bg-white px-2 py-1.5">
              <div className="text-[11px] text-gray-500">
                Clinicians
              </div>
              <div className="text-lg font-semibold">
                {memberCounts.clinicians}
              </div>
            </div>
            <div className="rounded border bg-white px-2 py-1.5">
              <div className="text-[11px] text-gray-500">
                Admin staff
              </div>
              <div className="text-lg font-semibold">
                {memberCounts.admins +
                  memberCounts.billing +
                  memberCounts.support}
              </div>
            </div>
            <div className="rounded border bg-white px-2 py-1.5">
              <div className="text-[11px] text-gray-500">
                Pending invites
              </div>
              <div className="text-lg font-semibold">
                {memberCounts.pendingInvites}
              </div>
            </div>
          </div>

          {sampleMembers.length > 0 && (
            <div className="pt-2 border-t mt-2">
              <div className="text-[11px] text-gray-500 mb-1">
                A few of your members:
              </div>
              <ul className="space-y-0.5 text-[11px] text-gray-700">
                {sampleMembers.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate">
                      {m.fullName ?? m.email ?? m.id}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="capitalize text-gray-500">
                        {m.role}
                      </span>
                      {m.status &&
                        m.status !== 'active' && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700 border border-amber-200">
                            {m.status}
                          </span>
                        )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Funding & Smart ID */}
        <div className="rounded-lg border bg-white p-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Funding &amp; Smart ID
          </h3>

          <div className="space-y-1 text-xs text-gray-700">
            <div>
              Medical-aid participation:{' '}
              <span className="font-medium">
                {acceptsMedicalAid
                  ? 'Enabled'
                  : 'Not enabled yet'}
              </span>
            </div>
            {acceptsMedicalAid && acceptedSchemes?.length > 0 && (
              <div className="text-[11px] text-gray-600">
                Schemes routed:{' '}
                {acceptedSchemes.join(', ')}
              </div>
            )}
            <div className="mt-2">
              Smart ID dispatch mode:{' '}
              <span className="font-medium">
                {smartIdDispatch === 'courier'
                  ? 'Courier to practice address'
                  : smartIdDispatch === 'collect'
                  ? 'Physical collection at reception'
                  : 'Not configured (defaults to collection)'}
              </span>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-gray-500">
            To adjust payout share, admin slots or Smart ID
            dispatch, go to{' '}
            <Link
              href="/payout"
              className="underline"
            >
              Payout &amp; Plan
            </Link>
            .
          </div>
        </div>
      </section>

      {/* Locations & routing */}
      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">
              Practice locations
            </h3>
            <span className="text-[11px] text-gray-500">
              {locations.length} location
              {locations.length === 1 ? '' : 's'}
            </span>
          </div>

          {locations.length === 0 ? (
            <div className="text-xs text-gray-500">
              No locations captured yet. Use your profile /
              practice settings to add at least one practice
              address.
            </div>
          ) : (
            <ul className="space-y-2 text-xs">
              {locations.map((loc) => (
                <li
                  key={loc.id}
                  className="rounded border bg-gray-50 px-3 py-2 flex flex-col gap-0.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-800">
                      {loc.label}
                    </span>
                    {loc.isPrimary && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700 border border-emerald-200">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="text-gray-700">
                    {loc.addressLine1}
                    {loc.addressLine2
                      ? `, ${loc.addressLine2}`
                      : ''}
                  </div>
                  <div className="text-gray-600">
                    {[loc.city, loc.province, loc.country]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Cross-links / quick actions */}
        <div className="space-y-3">
          <div className="rounded-lg border bg-white p-4 text-xs space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">
              Quick navigation
            </h3>
            <ul className="space-y-1">
              <li>
                <Link
                  href="/practice/members"
                  className="underline text-indigo-700"
                >
                  Manage practice members
                </Link>
                <span className="text-gray-500">
                  {' '}
                  – invite clinicians &amp; admin staff.
                </span>
              </li>
              <li>
                <Link
                  href="/today"
                  className="underline text-indigo-700"
                >
                  Today&apos;s agenda
                </Link>
                <span className="text-gray-500">
                  {' '}
                  – live InsightCore alerts &amp; sessions.
                </span>
              </li>
              <li>
                <Link
                  href="/claims"
                  className="underline text-indigo-700"
                >
                  Claims &amp; funding
                </Link>
                <span className="text-gray-500">
                  {' '}
                  – see funding mix &amp; vouchers.
                </span>
              </li>
              <li>
                <Link
                  href="/payout"
                  className="underline text-indigo-700"
                >
                  Payouts &amp; plan
                </Link>
                <span className="text-gray-500">
                  {' '}
                  – plan tier, admin slots &amp; payout share.
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border bg-slate-50 p-4 text-[11px] text-slate-700 space-y-1">
            <div className="font-semibold text-[12px] text-slate-900">
              How this page is wired
            </div>
            <p>
              This overview reads from{' '}
              <code className="font-mono">
                GET /api/practice/me
              </code>{' '}
              (proxied via clinician-app). That endpoint
              should fetch the current clinician&apos;s
              practice, locations and a small member
              snapshot from the API gateway.
            </p>
            <p>
              Member management, role changes and invites are
              handled under{' '}
              <code className="font-mono">
                /practice/members
              </code>
              .
            </p>
          </div>
        </div>
      </section>

      {loading && (
        <div className="text-xs text-gray-500">
          Refreshing practice data…
        </div>
      )}
    </main>
  );
}
