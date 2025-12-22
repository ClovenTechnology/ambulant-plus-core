// apps/clinician-app/app/practice/members/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';

type PracticeRole =
  | 'owner'
  | 'co_owner'
  | 'manager'
  | 'hr'
  | 'accounting'
  | 'clinical_lead'
  | 'clinician'
  | 'nurse'
  | 'admin_medical'
  | 'admin_non_medical';

type MemberDetail = {
  id: string;
  userId?: string | null;
  clinicianId?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: PracticeRole;
  active: boolean;
  departmentNames?: string[];
  joinedAt?: string | null;
  lastSeenAt?: string | null;
  virtualSharePctToPractice?: number | null;
  inPersonSharePctToPractice?: number | null;
  facilityFeeFixedZarPerInPersonVisit?: number | null;
};

function fallbackMember(id: string): MemberDetail {
  return {
    id,
    name: 'Demo Member',
    role: 'clinician',
    active: true,
    email: 'demo.member@example.com',
    phone: '+27 00 000 0000',
    departmentNames: ['General Practice'],
    joinedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    lastSeenAt: new Date().toISOString(),
    virtualSharePctToPractice: 0.20,
    inPersonSharePctToPractice: 0.30,
    facilityFeeFixedZarPerInPersonVisit: 150,
  };
}

function roleLabel(role: PracticeRole): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'co_owner':
      return 'Co-Owner';
    case 'manager':
      return 'General Practice Manager';
    case 'hr':
      return 'HR';
    case 'accounting':
      return 'Accounting';
    case 'clinical_lead':
      return 'Clinical Lead';
    case 'clinician':
      return 'Clinician';
    case 'nurse':
      return 'Nurse';
    case 'admin_medical':
      return 'Admin (Medical)';
    case 'admin_non_medical':
      return 'Admin (Non-medical)';
    default:
      return role;
  }
}

export default function PracticeMemberDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id as string;

  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(
          `${API}/practice/members/${encodeURIComponent(id)}`,
          {
            cache: 'no-store',
            headers: {
              'x-role': 'clinician',
              'x-scope': 'practice',
            },
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const js = (await res.json().catch(() => null)) as MemberDetail | null;
        if (cancelled) return;
        setMember(js ?? fallbackMember(id));
      } catch (e: any) {
        if (cancelled) return;
        console.warn('[practice/members/:id] demo fallback', e?.message);
        setErr('Using demo data; practice member API not wired yet.');
        setMember(fallbackMember(id));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) {
    return <main className="p-4">Invalid member id.</main>;
  }

  if (!member && loading) {
    return <main className="p-4">Loading…</main>;
  }

  if (!member) {
    return <main className="p-4">Member not found.</main>;
  }

  const virtualPct = member.virtualSharePctToPractice ?? 0;
  const inPersonPct = member.inPersonSharePctToPractice ?? 0;
  const facilityFee =
    member.facilityFeeFixedZarPerInPersonVisit ?? 0;

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <button
              type="button"
              onClick={() => router.push('/practice/members')}
              className="rounded border px-2 py-0.5 text-[11px] hover:bg-gray-50"
            >
              ← Back to Members
            </button>
            <span>Member</span>
            <span className="font-mono text-[11px] text-gray-600">
              {member.id}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {member.name}
          </h1>
          <p className="text-sm text-gray-500">
            {roleLabel(member.role)}
            {member.departmentNames?.length
              ? ` · ${member.departmentNames.join(', ')}`
              : null}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-gray-500">
          <span>
            Status:{' '}
            <span
              className={
                member.active ? 'text-emerald-600' : 'text-rose-600'
              }
            >
              {member.active ? 'Active' : 'Inactive'}
            </span>
          </span>
          {err && (
            <span className="max-w-xs text-right text-amber-700">
              {err}
            </span>
          )}
        </div>
      </header>

      {/* Contact + meta */}
      <section className="grid gap-4 md:grid-cols-3 text-xs">
        <div className="rounded-lg border bg-white p-3">
          <h2 className="mb-2 text-xs font-semibold text-slate-800">
            Contact
          </h2>
          <div className="space-y-1 text-gray-700">
            <div>
              <span className="text-gray-500">Email:</span>{' '}
              <span>{member.email || '—'}</span>
            </div>
            <div>
              <span className="text-gray-500">Phone:</span>{' '}
              <span>{member.phone || '—'}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-3">
          <h2 className="mb-2 text-xs font-semibold text-slate-800">
            Practice membership
          </h2>
          <div className="space-y-1 text-gray-700">
            <div>
              <span className="text-gray-500">Joined:</span>{' '}
              <span>
                {member.joinedAt
                  ? new Date(member.joinedAt).toLocaleDateString()
                  : '—'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Last seen:</span>{' '}
              <span>
                {member.lastSeenAt
                  ? new Date(member.lastSeenAt).toLocaleString()
                  : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-3">
          <h2 className="mb-2 text-xs font-semibold text-slate-800">
            Quick navigation
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/today"
              className="rounded border px-2 py-1 text-[11px] hover:bg-gray-50"
            >
              View clinician&apos;s today
            </Link>
            <Link
              href="/payout"
              className="rounded border px-2 py-1 text-[11px] hover:bg-gray-50"
            >
              View clinician payouts
            </Link>
          </div>
        </div>
      </section>

      {/* Revenue split summary */}
      <section className="rounded-lg border bg-white p-4 text-xs">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">
          Revenue split (practice ↔ clinician)
        </h2>
        <p className="mb-2 text-gray-600">
          High-level view of how this member&apos;s consult revenue is shared
          with the practice. Exact figures come from{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px]">
            PracticeClinicianSplit
          </code>{' '}
          in your Prisma schema.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-md border bg-slate-50 px-3 py-2">
            <div className="text-[11px] text-gray-600">
              Virtual visits – practice share
            </div>
            <div className="mt-1 text-lg font-semibold">
              {Math.round(virtualPct * 100)}%
            </div>
            <div className="mt-0.5 text-[11px] text-gray-500">
              Remaining goes to clinician after platform share.
            </div>
          </div>

          <div className="rounded-md border bg-slate-50 px-3 py-2">
            <div className="text-[11px] text-gray-600">
              In-person visits – practice share
            </div>
            <div className="mt-1 text-lg font-semibold">
              {Math.round(inPersonPct * 100)}%
            </div>
            <div className="mt-0.5 text-[11px] text-gray-500">
              Typically higher than virtual visits to cover facility costs.
            </div>
          </div>

          <div className="rounded-md border bg-slate-50 px-3 py-2">
            <div className="text-[11px] text-gray-600">
              Facility fee (per in-person visit)
            </div>
            <div className="mt-1 text-lg font-semibold">
              R {facilityFee.toFixed(0)}
            </div>
            <div className="mt-0.5 text-[11px] text-gray-500">
              Added on top of the percentage split for in-person visits.
            </div>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-gray-500">
          When you wire the backend, this page should call a practice-scoped
          endpoint (e.g.{' '}
          <code className="bg-gray-100 px-1 py-0.5">
            /practice/members/:id
          </code>
          ) that joins{' '}
          <code className="bg-gray-100 px-1 py-0.5">
            PracticeMember
          </code>{' '}
          and{' '}
          <code className="bg-gray-100 px-1 py-0.5">
            PracticeClinicianSplit
          </code>
          .
        </p>
      </section>
    </main>
  );
}
