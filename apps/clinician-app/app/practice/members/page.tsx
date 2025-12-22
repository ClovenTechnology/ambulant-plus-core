// apps/clinician-app/app/practice/members/page.tsx
'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ClinicianShell } from '@/components/ClinicianShell';
import { toast } from '@/components/ToastMount';

type PracticeMemberRole = 'owner' | 'clinician' | 'admin' | 'billing' | 'support';
type PracticeMemberStatus = 'active' | 'invited' | 'pending' | 'disabled';

type PracticeMember = {
  id: string;
  userId?: string | null;
  fullName?: string | null;
  email?: string | null;
  role: PracticeMemberRole;
  status: PracticeMemberStatus;
  speciality?: string | null;
  city?: string | null;
  country?: string | null;
  lastSeenAt?: string | null;
  createdAt?: string | null;
};

type MembersApiResponse = {
  ok?: boolean;
  practice?: { name?: string | null } | null;
  members?: any[];
  items?: any[];
};

type InvitePayload = {
  email: string;
  role: PracticeMemberRole;
  fullName?: string;
};

const PRACTICE_TABS = [
  { href: '/practice', label: 'Overview' },
  { href: '/practice/members', label: 'Members' },
];

const DEMO_MEMBERS: PracticeMember[] = [
  {
    id: 'm-owner',
    userId: 'user-owner',
    fullName: 'Dr Demo Owner',
    email: 'owner@example.com',
    role: 'owner',
    status: 'active',
    speciality: 'Family Medicine',
    city: 'Johannesburg',
    country: 'South Africa',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'm-gp',
    userId: 'user-gp',
    fullName: 'Dr Virtual GP',
    email: 'gp@example.com',
    role: 'clinician',
    status: 'active',
    speciality: 'General Practitioner',
    city: 'Cape Town',
    country: 'South Africa',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'm-admin',
    userId: 'user-admin',
    fullName: 'Reception Admin',
    email: 'admin@example.com',
    role: 'admin',
    status: 'pending',
    city: 'Johannesburg',
    country: 'South Africa',
    createdAt: new Date().toISOString(),
  },
];

function normalizeRole(rawRole: any): PracticeMemberRole {
  const s = String(rawRole ?? '').toLowerCase();
  if (s === 'owner' || s === 'practice_owner') return 'owner';
  if (s === 'admin' || s === 'practice_admin') return 'admin';
  if (s === 'billing' || s === 'billing_admin') return 'billing';
  if (s === 'support' || s === 'support_staff') return 'support';
  return 'clinician';
}

function normalizeStatus(raw: any): PracticeMemberStatus {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'invited') return 'invited';
  if (s === 'pending') return 'pending';
  if (s === 'disabled' || s === 'suspended') return 'disabled';
  return 'active';
}

function normalizeMember(raw: any): PracticeMember {
  return {
    id: String(raw.id ?? raw.memberId ?? raw.userId ?? crypto.randomUUID()),
    userId: raw.userId ?? null,
    fullName:
      raw.fullName ??
      raw.name ??
      raw.displayName ??
      null,
    email: raw.email ?? raw.contactEmail ?? null,
    role: normalizeRole(raw.role ?? raw.membershipRole),
    status: normalizeStatus(raw.status ?? raw.membershipStatus),
    speciality:
      raw.speciality ??
      raw.specialty ??
      raw.discipline ??
      null,
    city:
      raw.city ??
      raw.practiceCity ??
      raw.location?.city ??
      null,
    country:
      raw.country ??
      raw.practiceCountry ??
      raw.location?.country ??
      'South Africa',
    lastSeenAt:
      raw.lastSeenAt ??
      raw.last_active_at ??
      null,
    createdAt:
      raw.createdAt ??
      raw.created_at ??
      raw.joinedAt ??
      null,
  };
}

function roleLabel(role: PracticeMemberRole): string {
  switch (role) {
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
      return role;
  }
}

function statusBadgeClass(status: PracticeMemberStatus): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'pending':
    case 'invited':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'disabled':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

export default function PracticeMembersPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [practiceName, setPracticeName] = useState<string>('Your practice');
  const [members, setMembers] = useState<PracticeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(false);

  const [roleFilter, setRoleFilter] = useState<'all' | PracticeMemberRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | PracticeMemberStatus>('all');
  const [q, setQ] = useState('');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteForm, setInviteForm] = useState<InvitePayload>({
    email: '',
    role: 'clinician',
    fullName: '',
  });

  const [roleUpdating, setRoleUpdating] = useState<Record<string, boolean>>({});
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});

  // Load members
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setUsingDemo(false);
        setErr(null);

        // Expected: clinician-app API route → gateway
        // GET /api/practice/members → { ok, practice, members: [...] }
        const res = await fetch('/api/practice/members', {
          cache: 'no-store',
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const js: MembersApiResponse = await res
          .json()
          .catch(() => ({} as any));

        const rawMembers: any[] =
          (Array.isArray(js.members) ? js.members : null) ??
          (Array.isArray(js.items) ? js.items : null) ??
          [];

        const mapped = rawMembers.map(normalizeMember);

        if (cancelled) return;

        setMembers(mapped);

        const pName =
          js.practice?.name ??
          js.practice?.practiceName ??
          null;

        if (pName) {
          setPracticeName(pName);
        }
      } catch (e: any) {
        console.warn(
          '[practice/members] API failed, using demo set',
          e,
        );
        if (cancelled) return;
        setMembers(DEMO_MEMBERS);
        setUsingDemo(true);
        setErr(
          e?.message ||
            'Unable to load practice members; showing demo data.',
        );
        toast(
          'Showing demo members (wire /api/practice/members to your gateway for real data).',
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

  const filtered = useMemo(() => {
    let list = members;

    if (roleFilter !== 'all') {
      list = list.filter((m) => m.role === roleFilter);
    }
    if (statusFilter !== 'all') {
      list = list.filter((m) => m.status === statusFilter);
    }

    const s = q.trim().toLowerCase();
    if (!s) return list;

    return list.filter((m) => {
      return (
        (m.fullName ?? '').toLowerCase().includes(s) ||
        (m.email ?? '').toLowerCase().includes(s) ||
        (m.city ?? '').toLowerCase().includes(s) ||
        (m.speciality ?? '').toLowerCase().includes(s)
      );
    });
  }, [members, roleFilter, statusFilter, q]);

  const counts = useMemo(() => {
    let owners = 0;
    let clinicians = 0;
    let admins = 0;
    let billing = 0;
    let support = 0;
    let pending = 0;

    for (const m of members) {
      if (m.role === 'owner') owners++;
      else if (m.role === 'clinician') clinicians++;
      else if (m.role === 'admin') admins++;
      else if (m.role === 'billing') billing++;
      else if (m.role === 'support') support++;

      if (m.status === 'pending' || m.status === 'invited') {
        pending++;
      }
    }

    return {
      total: members.length,
      owners,
      clinicians,
      admins,
      billing,
      support,
      pending,
    };
  }, [members]);

  const handleInviteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email.trim()) {
      toast('Please enter an email address.', 'error');
      return;
    }
    setInviteBusy(true);
    try {
      const res = await fetch('/api/practice/members', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const js = await res.json().catch(() => null);
      const createdRaw =
        js?.member ??
        js?.data ??
        js ??
        null;

      let created: PracticeMember | null = null;
      if (createdRaw) {
        created = normalizeMember(createdRaw);
      } else {
        created = {
          id: crypto.randomUUID(),
          fullName: inviteForm.fullName || null,
          email: inviteForm.email,
          role: inviteForm.role,
          status: 'invited',
          city: null,
          country: 'South Africa',
        };
      }

      setMembers((prev) => [created!, ...prev]);
      toast('Invite sent.', 'success');
      setInviteForm({
        email: '',
        role: 'clinician',
        fullName: '',
      });
      setInviteOpen(false);
    } catch (err: any) {
      console.error('[practice/members] invite failed', err);
      toast(
        err?.message ||
          'Failed to send invite. Check /api/practice/members (POST).',
        'error',
      );
    } finally {
      setInviteBusy(false);
    }
  };

  const updateMemberRole = async (
    memberId: string,
    nextRole: PracticeMemberRole,
  ) => {
    setRoleUpdating((prev) => ({ ...prev, [memberId]: true }));
    try {
      const res = await fetch('/api/practice/members', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          memberId,
          role: nextRole,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const js = await res.json().catch(() => null);
      const updatedRaw =
        js?.member ??
        js?.data ??
        null;

      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId
            ? {
                ...m,
                role: updatedRaw
                  ? normalizeMember(updatedRaw).role
                  : nextRole,
              }
            : m,
        ),
      );
    } catch (err: any) {
      console.error('[practice/members] role update failed', err);
      toast(
        err?.message ||
          'Failed to update role. Ensure PATCH /api/practice/members is implemented.',
        'error',
      );
    } finally {
      setRoleUpdating((prev) => ({
        ...prev,
        [memberId]: false,
      }));
    }
  };

  const updateMemberStatus = async (
    memberId: string,
    nextStatus: PracticeMemberStatus,
  ) => {
    setStatusUpdating((prev) => ({
      ...prev,
      [memberId]: true,
    }));
    try {
      const res = await fetch('/api/practice/members', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          memberId,
          status: nextStatus,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const js = await res.json().catch(() => null);
      const updatedRaw =
        js?.member ??
        js?.data ??
        null;

      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId
            ? {
                ...m,
                status: updatedRaw
                  ? normalizeMember(updatedRaw).status
                  : nextStatus,
              }
            : m,
        ),
      );
    } catch (err: any) {
      console.error(
        '[practice/members] status update failed',
        err,
      );
      toast(
        err?.message ||
          'Failed to update member status. Check PATCH /api/practice/members.',
        'error',
      );
    } finally {
      setStatusUpdating((prev) => ({
        ...prev,
        [memberId]: false,
      }));
    }
  };

  return (
    <ClinicianShell>
      <main className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Local practice tabs (Overview / Members) */}
        <nav className="border-b border-gray-200 mb-1 flex flex-wrap gap-2">
          {PRACTICE_TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <button
                key={tab.href}
                type="button"
                onClick={() => router.push(tab.href)}
                className={
                  'px-3 py-2 text-xs font-medium border-b-2 -mb-px transition ' +
                  (active
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-black hover:border-gray-300')
                }
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Header */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Practice Members
            </h1>
            <p className="mt-1 text-xs text-gray-600 max-w-xl">
              Manage everyone linked to{' '}
              <span className="font-medium">
                {practiceName}
              </span>
              : owners, clinicians, reception/admin staff,
              billing and support roles. Invites are sent via
              email from here and routed through your API gateway.
            </p>

            {usingDemo && (
              <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800 max-w-xl">
                Demo mode – real API not connected. Implement{' '}
                <code className="font-mono">
                  GET/POST/PATCH /api/practice/members
                </code>{' '}
                to fully enable this page.
              </div>
            )}
            {err && !usingDemo && (
              <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800 max-w-xl">
                {err}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="rounded-full bg-black text-white px-4 py-1.5 text-xs hover:bg-gray-900"
            >
              + Invite member
            </button>
            <div className="text-[11px] text-gray-500 text-right">
              Total members:{' '}
              <span className="font-semibold">
                {counts.total}
              </span>{' '}
              · Pending invites:{' '}
              <span className="font-semibold">
                {counts.pending}
              </span>
            </div>
          </div>
        </header>

        {/* Filters + summary */}
        <section className="rounded border bg-white p-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="font-semibold text-gray-800">
                Filters:
              </span>
              <select
                value={roleFilter}
                onChange={(e) =>
                  setRoleFilter(
                    e.target.value as typeof roleFilter,
                  )
                }
                className="rounded border px-2 py-1 text-[11px]"
              >
                <option value="all">All roles</option>
                <option value="owner">Owners</option>
                <option value="clinician">Clinicians</option>
                <option value="admin">Admin</option>
                <option value="billing">Billing</option>
                <option value="support">Support</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as typeof statusFilter,
                  )
                }
                className="rounded border px-2 py-1 text-[11px]"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="invited">Invited</option>
                <option value="disabled">Disabled</option>
              </select>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, email, city, speciality"
                className="rounded border px-2 py-1 text-[11px] min-w-[200px]"
              />
            </div>

            <div className="text-[11px] text-gray-500">
              Showing{' '}
              <span className="font-semibold">
                {filtered.length}
              </span>{' '}
              of{' '}
              <span className="font-semibold">
                {members.length}
              </span>{' '}
              member{members.length === 1 ? '' : 's'}
            </div>
          </div>

          {/* Counts strip */}
          <div className="grid gap-2 md:grid-cols-5">
            <div className="rounded border bg-gray-50 px-3 py-2">
              <div className="text-[11px] text-gray-500">
                Total
              </div>
              <div className="text-lg font-semibold">
                {counts.total}
              </div>
            </div>
            <div className="rounded border bg-white px-3 py-2">
              <div className="text-[11px] text-gray-500">
                Owners
              </div>
              <div className="text-lg font-semibold">
                {counts.owners}
              </div>
            </div>
            <div className="rounded border bg-white px-3 py-2">
              <div className="text-[11px] text-gray-500">
                Clinicians
              </div>
              <div className="text-lg font-semibold">
                {counts.clinicians}
              </div>
            </div>
            <div className="rounded border bg-white px-3 py-2">
              <div className="text-[11px] text-gray-500">
                Admin / Billing
              </div>
              <div className="text-lg font-semibold">
                {counts.admins + counts.billing}
              </div>
            </div>
            <div className="rounded border bg-white px-3 py-2">
              <div className="text-[11px] text-gray-500">
                Pending invites
              </div>
              <div className="text-lg font-semibold">
                {counts.pending}
              </div>
            </div>
          </div>
        </section>

        {/* Members list */}
        <section className="grid gap-3 md:grid-cols-2">
          {filtered.map((m) => {
            const statusClass = statusBadgeClass(m.status);
            const roleIsOwner = m.role === 'owner';
            const roleIsClinician = m.role === 'clinician';

            const lastSeenStr = m.lastSeenAt
              ? new Date(
                  m.lastSeenAt,
                ).toLocaleString()
              : 'Unknown';
            const createdStr = m.createdAt
              ? new Date(
                  m.createdAt,
                ).toLocaleDateString()
              : null;

            return (
              <article
                key={m.id}
                className="rounded border bg-white p-3 text-xs shadow-sm flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="font-medium text-gray-900">
                      {m.fullName ??
                        m.email ??
                        m.id}
                    </div>
                    {m.email && (
                      <div className="text-[11px] text-gray-500">
                        {m.email}
                      </div>
                    )}
                    <div className="text-[11px] text-gray-500">
                      {m.speciality && (
                        <>
                          {m.speciality}
                          {' · '}
                        </>
                      )}
                      {[m.city, m.country]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                    {createdStr && (
                      <div className="text-[11px] text-gray-400">
                        Joined {createdStr}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ' +
                        statusClass
                      }
                    >
                      {m.status === 'invited'
                        ? 'Invited'
                        : m.status === 'pending'
                        ? 'Pending'
                        : m.status === 'disabled'
                        ? 'Disabled'
                        : 'Active'}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-800">
                      {roleLabel(m.role)}
                    </span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                  <div className="flex flex-wrap gap-2 items-center">
                    {/* Role selector (owner | clinician | admin | billing | support) */}
                    <label className="inline-flex items-center gap-1 text-[11px] text-gray-600">
                      <span>Role:</span>
                      <select
                        disabled={
                          !!roleUpdating[m.id] ||
                          roleIsOwner
                        }
                        value={m.role}
                        onChange={(e) =>
                          updateMemberRole(
                            m.id,
                            e.target
                              .value as PracticeMemberRole,
                          )
                        }
                        className="rounded border px-2 py-0.5 text-[11px]"
                      >
                        <option value="owner">
                          Owner
                        </option>
                        <option value="clinician">
                          Clinician
                        </option>
                        <option value="admin">
                          Admin
                        </option>
                        <option value="billing">
                          Billing
                        </option>
                        <option value="support">
                          Support
                        </option>
                      </select>
                    </label>

                    {/* Status selector */}
                    <label className="inline-flex items-center gap-1 text-[11px] text-gray-600">
                      <span>Status:</span>
                      <select
                        disabled={
                          !!statusUpdating[m.id]
                        }
                        value={m.status}
                        onChange={(e) =>
                          updateMemberStatus(
                            m.id,
                            e.target
                              .value as PracticeMemberStatus,
                          )
                        }
                        className="rounded border px-2 py-0.5 text-[11px]"
                      >
                        <option value="active">
                          Active
                        </option>
                        <option value="pending">
                          Pending
                        </option>
                        <option value="invited">
                          Invited
                        </option>
                        <option value="disabled">
                          Disabled
                        </option>
                      </select>
                    </label>
                  </div>

                  <div className="flex flex-col items-end gap-0.5 text-[10px] text-gray-500">
                    <span>
                      Last seen:{' '}
                      <span className="font-mono">
                        {lastSeenStr}
                      </span>
                    </span>
                    {roleIsClinician && (
                      <Link
                        href="/settings/profile"
                        className="underline"
                      >
                        Open clinician profile
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {!loading && filtered.length === 0 && (
            <div className="col-span-full rounded border bg-white p-4 text-sm text-gray-500">
              No members match this filter yet.
            </div>
          )}
        </section>

        {loading && (
          <div className="text-xs text-gray-500">
            Loading members…
          </div>
        )}

        {/* Invite modal */}
        {inviteOpen && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-4 relative text-xs">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-900 text-sm"
              >
                ✕
              </button>
              <h2 className="text-sm font-semibold text-gray-900 mb-1">
                Invite practice member
              </h2>
              <p className="text-[11px] text-gray-500 mb-3">
                Sends an email via your API gateway for the
                invitee to create or link an account. The invite
                should include their role and your practice ID.
              </p>

              <form
                onSubmit={handleInviteSubmit}
                className="space-y-3"
              >
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-gray-700">
                    Email address
                  </span>
                  <input
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={(e) =>
                      setInviteForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    className="rounded border px-2 py-1 text-xs"
                    placeholder="person@example.com"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-gray-700">
                    Full name (optional)
                  </span>
                  <input
                    type="text"
                    value={inviteForm.fullName}
                    onChange={(e) =>
                      setInviteForm((prev) => ({
                        ...prev,
                        fullName: e.target.value,
                      }))
                    }
                    className="rounded border px-2 py-1 text-xs"
                    placeholder="Used for email greeting"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-gray-700">
                    Role
                  </span>
                  <select
                    value={inviteForm.role}
                    onChange={(e) =>
                      setInviteForm((prev) => ({
                        ...prev,
                        role: e.target
                          .value as PracticeMemberRole,
                      }))
                    }
                    className="rounded border px-2 py-1 text-xs"
                  >
                    <option value="clinician">
                      Clinician
                    </option>
                    <option value="admin">Admin</option>
                    <option value="billing">Billing</option>
                    <option value="support">Support</option>
                    <option value="owner">
                      Owner (use sparingly)
                    </option>
                  </select>
                </label>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setInviteOpen(false)}
                    className="px-3 py-1.5 rounded border bg-white text-[11px] hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviteBusy}
                    className="px-3 py-1.5 rounded bg-black text-white text-[11px] disabled:opacity-60"
                  >
                    {inviteBusy ? 'Sending…' : 'Send invite'}
                  </button>
                </div>
              </form>

              <div className="mt-3 text-[10px] text-gray-500 border-t pt-2">
                The clinician-app route{' '}
                <code className="font-mono">
                  POST /api/practice/members
                </code>{' '}
                should forward to your API gateway, create an
                invite record and send the email via your
                preferred provider.
              </div>
            </div>
          </div>
        )}
      </main>
    </ClinicianShell>
  );
}
