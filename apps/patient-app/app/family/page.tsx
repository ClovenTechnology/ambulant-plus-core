// apps/patient-app/app/family/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Users,
  Plus,
  Shield,
  Calendar,
  ClipboardList,
  Bell,
  HeartPulse,
  Activity,
} from 'lucide-react';
import { usePlan } from '@/components/context/PlanContext';
import { toast } from '@/components/ToastMount';

type RelationshipCategory = 'Partner' | 'Child' | 'Parent' | 'Other';

type RelationshipStatus = 'active' | 'pending-invite' | 'pending-accept' | 'revoked';

type AccessProfile = {
  canBook: boolean;
  canViewHealth: boolean;
  canJoinTelevisit: boolean;
};

type FamilyMember = {
  id: string; // UI id (patientId for active, synthetic for pending invites)
  relationshipId?: string;
  patientId?: string; // real PatientProfile.id for active relationships
  name: string;
  category: RelationshipCategory;
  relationLabel: string;
  status: RelationshipStatus;
  access: AccessProfile;
  // teaser metrics – later can be backed by real data
  upcomingAppointments?: number;
  openEncounters?: number;
  unreadReminders?: number;
};

type TabId =
  | 'overview'
  | 'encounters'
  | 'appointments'
  | 'reminders'
  | 'meds'
  | 'labs'
  | 'reports'
  | 'care';

// --- API types (mirror /api/family/relationships response) ---

type ApiFamilySubject = {
  patientId: string;
  userId?: string | null;
  name?: string | null;
  dob?: string | null;
  gender?: string | null;
  city?: string | null;
};

type ApiFamilyRelationship = {
  id: string;
  relationType:
    | 'SELF'
    | 'SPOUSE'
    | 'PARTNER'
    | 'PARENT'
    | 'CHILD'
    | 'GUARDIAN'
    | 'DEPENDANT'
    | 'FRIEND'
    | 'CARE_ALLY'
    | 'OTHER';
  direction: 'HOST_TO_SUBJECT' | 'MUTUAL';
  subject: ApiFamilySubject;
};

type ApiRelationshipsResponse = {
  ok: boolean;
  asHost: ApiFamilyRelationship[];
  asSubject: ApiFamilyRelationship[];
};

// --- Local helpers ---

const CATEGORY_LABELS: Record<RelationshipCategory, string> = {
  Partner: 'Partners',
  Child: 'Children & Dependants',
  Parent: 'Parents & Elders',
  Other: 'Care circle & friends',
};

function statusLabel(status: RelationshipStatus) {
  switch (status) {
    case 'active':
      return 'Active';
    case 'pending-invite':
      return 'Invite sent';
    case 'pending-accept':
      return 'Awaiting approval';
    case 'revoked':
      return 'Access revoked';
    default:
      return status;
  }
}

function statusTone(status: RelationshipStatus) {
  switch (status) {
    case 'active':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'pending-invite':
    case 'pending-accept':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'revoked':
      return 'bg-rose-50 text-rose-800 border-rose-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

// Map server FamilyRelationType → UI grouping + label
function mapRelationTypeToUi(
  relationType: ApiFamilyRelationship['relationType'],
): { category: RelationshipCategory; relationLabel: string } {
  switch (relationType) {
    case 'SPOUSE':
    case 'PARTNER':
      return { category: 'Partner', relationLabel: 'Spouse / Partner' };
    case 'PARENT':
    case 'GUARDIAN':
      return { category: 'Parent', relationLabel: 'Parent / Guardian' };
    case 'CHILD':
    case 'DEPENDANT':
      return { category: 'Child', relationLabel: 'Child / Dependant' };
    case 'FRIEND':
    case 'CARE_ALLY':
    case 'OTHER':
      return { category: 'Other', relationLabel: 'Friend / Care circle' };
    case 'SELF':
    default:
      return { category: 'Other', relationLabel: 'Self' };
  }
}

// Map UI category → server relationType + semantic category string
function mapCategoryToRelationType(cat: RelationshipCategory) {
  switch (cat) {
    case 'Partner':
      return { relationType: 'SPOUSE' as const, subjectCategory: 'partner' };
    case 'Child':
      return { relationType: 'CHILD' as const, subjectCategory: 'child' };
    case 'Parent':
      return { relationType: 'PARENT' as const, subjectCategory: 'elder' };
    case 'Other':
    default:
      return { relationType: 'FRIEND' as const, subjectCategory: 'other' };
  }
}

// Derive coarse access profile from relation type
function deriveAccessFromRelationType(
  relationType: ApiFamilyRelationship['relationType'] | string,
): AccessProfile {
  const rt = relationType.toUpperCase();
  if (rt === 'SELF') {
    return { canBook: true, canViewHealth: true, canJoinTelevisit: true };
  }
  if (rt === 'SPOUSE' || rt === 'PARTNER') {
    return { canBook: true, canViewHealth: true, canJoinTelevisit: true };
  }
  if (rt === 'PARENT' || rt === 'GUARDIAN' || rt === 'CHILD' || rt === 'DEPENDANT') {
    return { canBook: true, canViewHealth: true, canJoinTelevisit: true };
  }
  // Friends / care allies: supportive, not full control
  return { canBook: false, canViewHealth: false, canJoinTelevisit: true };
}

// Label for the pill next to the name (based on UI category)
function labelForCategory(cat: RelationshipCategory): string {
  switch (cat) {
    case 'Partner':
      return 'Spouse / Partner';
    case 'Child':
      return 'Child / Dependant';
    case 'Parent':
      return 'Parent / Elder';
    case 'Other':
    default:
      return 'Friend / Care circle';
  }
}

// Simple uid helper – mirrors patient calendar implementation
function getUid() {
  if (typeof window === 'undefined') return 'server-user';
  const key = 'ambulant_uid';
  let v = window.localStorage.getItem(key);
  if (!v) {
    // eslint-disable-next-line no-restricted-globals
    const rnd = (crypto as any)?.randomUUID?.() || Math.random().toString(36).slice(2);
    v = `${rnd}-u`;
    window.localStorage.setItem(key, v);
  }
  return v;
}

/**
 * Demo fallback members:
 * - Used automatically when live API fails (graceful fallback).
 * - Optionally, append ?demo=1 to /family to show demo data when API returns an empty list.
 */
function buildMockFamilyMembers(): FamilyMember[] {
  return [
    {
      id: 'demo-pat-amina',
      relationshipId: 'demo-rel-amina',
      patientId: 'demo-pat-amina',
      name: 'Amina S.',
      category: 'Partner',
      relationLabel: 'Spouse / Partner',
      status: 'active',
      access: deriveAccessFromRelationType('SPOUSE'),
      upcomingAppointments: 2,
      openEncounters: 1,
      unreadReminders: 3,
    },
    {
      id: 'demo-pat-khai',
      relationshipId: 'demo-rel-khai',
      patientId: 'demo-pat-khai',
      name: 'Khai S. (Child)',
      category: 'Child',
      relationLabel: 'Child / Dependant',
      status: 'active',
      access: deriveAccessFromRelationType('CHILD'),
      upcomingAppointments: 1,
      openEncounters: 0,
      unreadReminders: 1,
    },
    {
      id: 'demo-pat-mama',
      relationshipId: 'demo-rel-mama',
      patientId: 'demo-pat-mama',
      name: 'Mama T.',
      category: 'Parent',
      relationLabel: 'Parent / Elder',
      status: 'active',
      access: deriveAccessFromRelationType('PARENT'),
      upcomingAppointments: 0,
      openEncounters: 2,
      unreadReminders: 0,
    },
    {
      id: 'inv-demo-sam',
      relationshipId: 'demo-inv-sam',
      patientId: undefined,
      name: 'Sam D.',
      category: 'Other',
      relationLabel: labelForCategory('Other'),
      status: 'pending-accept',
      access: deriveAccessFromRelationType('CARE_ALLY'),
      upcomingAppointments: 0,
      openEncounters: 0,
      unreadReminders: 0,
    },
  ];
}

function chooseDefaultSelected(prev: string | null, list: FamilyMember[]): string | null {
  if (prev && list.some((m) => m.id === prev)) return prev;
  const spouse = list.find((m) => m.category === 'Partner');
  return spouse?.id ?? list[0]?.id ?? null;
}

export default function FamilyPage() {
  const { isPremium } = usePlan();
  const router = useRouter();
  const searchParams = useSearchParams();
  const acceptToken = searchParams.get('token');
  const demoMode = searchParams.get('demo') === '1';

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('overview');

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Demo fallback state (non-blocking)
  const [usingMock, setUsingMock] = useState(false);
  const [mockNote, setMockNote] = useState<string | null>(null);

  // Invite form
  const [inviteName, setInviteName] = useState('');
  const [inviteRelation, setInviteRelation] = useState<RelationshipCategory>('Other');
  const [inviteContact, setInviteContact] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Accept flow
  const [acceptState, setAcceptState] = useState<'idle' | 'submitting' | 'done' | 'error'>(
    'idle',
  );
  const [acceptError, setAcceptError] = useState<string | null>(null);

  function applyMembers(next: FamilyMember[]) {
    setMembers(next);
    setSelectedId((prev) => chooseDefaultSelected(prev, next));
  }

  // --- Load relationships from backend ---

  async function loadRelationships() {
    try {
      setLoading(true);
      setLoadError(null);

      setUsingMock(false);
      setMockNote(null);

      const res = await fetch('/api/family/relationships', {
        method: 'GET',
        headers: {
          'x-role': 'patient',
          'x-uid': getUid(),
        },
      });
      const json: ApiRelationshipsResponse | any = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || 'Failed to load family relationships');
      }

      const asHost: ApiFamilyRelationship[] = json.asHost ?? [];

      const mapped: FamilyMember[] = asHost.map((rel) => {
        const { category, relationLabel } = mapRelationTypeToUi(rel.relationType);
        const access = deriveAccessFromRelationType(rel.relationType);
        const patientId = rel.subject.patientId;

        return {
          id: patientId, // use patientId as the "person" id for context switching
          relationshipId: rel.id,
          patientId,
          name: rel.subject.name || 'Family member',
          category,
          relationLabel,
          status: 'active',
          access,
          upcomingAppointments: 0,
          openEncounters: 0,
          unreadReminders: 0,
        };
      });

      // Optional demo override: if API is live but returns empty, allow demo data via ?demo=1
      if (mapped.length === 0 && demoMode) {
        const mock = buildMockFamilyMembers();
        setUsingMock(true);
        setMockNote('Demo mode is enabled (no live relationships found).');
        applyMembers(mock);
        return;
      }

      applyMembers(mapped);
    } catch (e: any) {
      // Graceful fallback: keep wiring intact, but show demo data when live API is unavailable.
      const message = e?.message || 'Failed to load family relationships';
      console.warn('[family] falling back to demo data:', message);

      const mock = buildMockFamilyMembers();
      setUsingMock(true);
      setMockNote(message);
      setLoadError(null); // keep UI clean; we show the note in a softer banner
      applyMembers(mock);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRelationships();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(
    () => members.find((m) => m.id === selectedId) ?? members[0] ?? null,
    [members, selectedId],
  );

  const isActiveMember = !!selected && selected.status === 'active' && !!selected.patientId;

  // --- Invite creation ---

  async function handleCreateInvite() {
    const name = inviteName.trim();
    const contact = inviteContact.trim();

    if (!name || !contact) {
      setInviteError('Please enter a name and an email or mobile number.');
      return;
    }

    const { relationType, subjectCategory } = mapCategoryToRelationType(inviteRelation);
    const direction =
      relationType === 'SPOUSE' || relationType === 'PARTNER'
        ? 'MUTUAL'
        : 'HOST_TO_SUBJECT';

    const isEmail = contact.includes('@');
    const payload: any = {
      relationType,
      direction,
      subjectName: name,
      subjectCategory,
    };
    if (isEmail) payload.invitedEmail = contact;
    else payload.invitedPhone = contact;

    try {
      setInviting(true);
      setInviteError(null);

      const res = await fetch('/api/family/invitations', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-role': 'patient',
          'x-uid': getUid(),
        },
        body: JSON.stringify(payload),
      });

      const json: any = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || 'Failed to send invitation');
      }

      toast('Invitation sent. We’ll ask them to accept and choose what to share.', 'success');

      // Add a local "pending invite" row so the console feels responsive.
      const pending: FamilyMember = {
        id: `inv-${Date.now()}`,
        relationshipId: json.invitation?.id ?? undefined,
        patientId: undefined,
        name,
        category: inviteRelation,
        relationLabel: labelForCategory(inviteRelation),
        status: 'pending-invite',
        access: deriveAccessFromRelationType(relationType),
        upcomingAppointments: 0,
        openEncounters: 0,
        unreadReminders: 0,
      };
      setMembers((prev) => [...prev, pending]);
      setSelectedId(pending.id);

      setInviteName('');
      setInviteContact('');
      setInviteRelation('Other');
    } catch (e: any) {
      const message = e?.message || 'Failed to send invitation';
      setInviteError(message);
      toast(message, 'error');
    } finally {
      setInviting(false);
    }
  }

  // --- Accept invitation (from /family?token=...) ---

  async function handleAcceptInvitation() {
    if (!acceptToken) return;

    try {
      setAcceptState('submitting');
      setAcceptError(null);

      const res = await fetch('/api/family/invitations/accept', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-role': 'patient',
          'x-uid': getUid(),
        },
        body: JSON.stringify({ token: acceptToken }),
      });
      const json: any = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || 'Failed to accept invitation');
      }

      toast('Invitation accepted. Your care link has been created securely.', 'success');
      setAcceptState('done');

      // Refresh relationships to show new entries
      await loadRelationships();

      // Clean up the URL so the banner disappears
      router.replace('/family');
    } catch (e: any) {
      const message = e?.message || 'Failed to accept invitation';
      setAcceptError(message);
      setAcceptState('error');
      toast(message, 'error');
    }
  }

  const tabs: { id: TabId; label: string; description: string }[] = [
    {
      id: 'overview',
      label: 'Overview',
      description: 'Snapshot across care, appointments and reminders.',
    },
    {
      id: 'encounters',
      label: 'Cases & Encounters',
      description: 'Visits, notes and active cases.',
    },
    {
      id: 'appointments',
      label: 'Appointments',
      description: 'Upcoming and past bookings you manage for them.',
    },
    {
      id: 'reminders',
      label: 'Reminders',
      description: 'Medication, follow-up and self-care reminders.',
    },
    {
      id: 'meds',
      label: 'Medications',
      description: 'Current meds, adherence and pharmacy orders.',
    },
    {
      id: 'labs',
      label: 'Labs & Results',
      description: 'Test results and trends over time.',
    },
    {
      id: 'reports',
      label: 'Reports & Insights',
      description: 'Fertility, stress, sleep and wellbeing reports.',
    },
    {
      id: 'care',
      label: 'CarePort & MedReach',
      description: 'Care teams, deliveries and virtual care sessions.',
    },
  ];

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Family &amp; Friends</h1>
            <p className="text-xs text-gray-600 max-w-xl">
              Coordinate care for your spouse, children, parents and trusted friends. Book
              on their behalf, join virtual sessions together and keep everyone&apos;s
              health organised in one place.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">
            Premium feature
          </span>
          {!isPremium && (
            <span className="text-[11px] text-gray-500">
              Unlock full Family &amp; Friends access from your{' '}
              <Link href="/profile" className="underline">
                profile &amp; plan
              </Link>
              .
            </span>
          )}
        </div>
      </header>

      {/* Accept invitation banner (if /family?token=...) */}
      {acceptToken && acceptState !== 'done' && (
        <section className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium text-emerald-900 text-sm">
              You&apos;ve been invited to connect your care.
            </div>
            <p className="text-[11px] text-emerald-800 max-w-xl">
              Accept this invitation to let a trusted family member or friend support your
              care on Ambulant+. You can revoke access at any time.
            </p>
            {acceptError && <p className="mt-1 text-[11px] text-rose-700">{acceptError}</p>}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={handleAcceptInvitation}
              disabled={acceptState === 'submitting'}
              className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {acceptState === 'submitting' ? 'Accepting…' : 'Accept invite'}
            </button>
            <button
              type="button"
              onClick={() => router.replace('/family')}
              className="px-3 py-1.5 rounded border border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-50"
            >
              Not now
            </button>
          </div>
        </section>
      )}

      {/* Layout: left column = people, right = console */}
      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] gap-4 items-start">
        {/* Left: care circle list + invite */}
        <aside className="bg-white border rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-gray-800">Your care circle</div>
              <div className="text-[11px] text-gray-500">
                Add the people whose health you help manage.
              </div>
            </div>
          </div>

          {loading && <div className="mt-2 text-xs text-gray-500">Loading your care circle…</div>}

          {loadError && (
            <div className="mt-2 text-xs text-rose-700 border border-rose-200 bg-rose-50 rounded px-2 py-1">
              {loadError}
            </div>
          )}

          {usingMock && (
            <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-2 py-2">
              <div className="text-[11px] font-medium text-sky-900">
                Showing demo data (graceful fallback)
              </div>
              <div className="text-[10px] text-sky-800 mt-0.5">
                Live relationships are unavailable right now.
                {mockNote ? ` (${mockNote})` : ''}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                <button
                  type="button"
                  onClick={loadRelationships}
                  className="px-2 py-1 rounded border border-sky-200 bg-white hover:bg-sky-50 text-sky-900"
                >
                  Retry live data
                </button>
                <span className="text-sky-800">
                  Tip: add <span className="font-mono">?demo=1</span> to force demo data when
                  your API returns an empty list.
                </span>
              </div>
            </div>
          )}

          {!loading && !loadError && members.length === 0 && (
            <div className="mt-2 text-xs text-gray-600">
              You haven&apos;t added any family members or friends yet. Use the form below to
              send an invitation.
            </div>
          )}

          {/* Grouped by category */}
          <div className="space-y-3 text-sm">
            {(['Partner', 'Child', 'Parent', 'Other'] as RelationshipCategory[]).map((cat) => {
              const items = members.filter((m) => m.category === cat);
              if (!items.length) return null;
              return (
                <div key={cat}>
                  <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
                    {CATEGORY_LABELS[cat]}
                  </div>
                  <ul className="space-y-1.5">
                    {items.map((m) => {
                      const isSelected = selected?.id === m.id;
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(m.id)}
                            className={[
                              'w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition',
                              isSelected
                                ? 'border-indigo-500 bg-indigo-50/60'
                                : 'border-gray-200 bg-white hover:bg-gray-50',
                            ].join(' ')}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">{m.name}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-gray-600">
                                  {m.relationLabel}
                                </span>
                              </div>
                              <div className="text-[11px] text-gray-500 mt-0.5">
                                {m.access.canBook && 'Book · '}
                                {m.access.canViewHealth && 'View health • '}
                                {m.access.canJoinTelevisit && 'Join Televisit'}
                              </div>
                            </div>
                            <span
                              className={
                                'text-[10px] px-2 py-0.5 rounded-full border ' + statusTone(m.status)
                              }
                            >
                              {statusLabel(m.status)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Invite form */}
          <div className="pt-3 mt-2 border-t">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-xs font-medium text-gray-700">Add family / friend</div>
              <Shield className="h-3.5 w-3.5 text-gray-400" />
            </div>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                className="border rounded px-2 py-1.5 text-xs"
                placeholder="Full name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
              <input
                type="text"
                className="border rounded px-2 py-1.5 text-xs"
                placeholder="Email or mobile number"
                value={inviteContact}
                onChange={(e) => setInviteContact(e.target.value)}
              />
              <select
                className="border rounded px-2 py-1.5 text-xs"
                value={inviteRelation}
                onChange={(e) => setInviteRelation(e.target.value as RelationshipCategory)}
              >
                <option value="Partner">Spouse / Partner</option>
                <option value="Child">Child / Dependant</option>
                <option value="Parent">Parent / Elder</option>
                <option value="Other">Friend / Care circle</option>
              </select>
              <button
                type="button"
                onClick={handleCreateInvite}
                className="inline-flex items-center justify-center gap-1.5 rounded bg-indigo-600 text-white text-xs px-2.5 py-1.5 hover:bg-indigo-700 disabled:opacity-60"
                disabled={!inviteName.trim() || !inviteContact.trim() || inviting || !isPremium}
              >
                <Plus className="h-3 w-3" />
                <span>
                  {inviting ? 'Sending…' : 'Send invitation'}
                  {!isPremium && ' (Premium)'}
                </span>
              </button>
              {inviteError && <p className="text-[10px] text-rose-600">{inviteError}</p>}
              <p className="text-[10px] text-gray-500">
                We&apos;ll ask them to accept and choose what to share. You can revoke access at any
                time from here.
              </p>
            </div>
          </div>
        </aside>

        {/* Right: console for selected person */}
        <section className="bg-white border rounded-2xl p-4 lg:p-5 space-y-4 min-h-[420px]">
          {!selected ? (
            <div className="text-sm text-gray-600">
              Add a family member or friend on the left to start coordinating their care.
            </div>
          ) : (
            <>
              {/* Context header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">
                    You&apos;re currently managing care for
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="text-lg font-semibold text-gray-900">{selected.name}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-gray-700">
                      {selected.relationLabel}
                    </span>
                    <span
                      className={
                        'text-[11px] px-2 py-0.5 rounded-full border ' + statusTone(selected.status)
                      }
                    >
                      {statusLabel(selected.status)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 text-[11px] text-gray-600">
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {selected.access.canBook && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800">
                        <Calendar className="h-3 w-3" />
                        Book appointments
                      </span>
                    )}
                    {selected.access.canViewHealth && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800">
                        <ClipboardList className="h-3 w-3" />
                        View health record
                      </span>
                    )}
                    {selected.access.canJoinTelevisit && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-800">
                        <Activity className="h-3 w-3" />
                        Join Televisit
                      </span>
                    )}
                  </div>
                  <div>
                    When we wire shared Televisit sessions, both of you will be able to join from your
                    own devices.
                  </div>
                </div>
              </div>

              {/* Pending invite / not yet active */}
              {!isActiveMember && <PendingMemberPanel member={selected} />}

              {/* Active member console */}
              {isActiveMember && selected.patientId && (
                <>
                  {/* Tabs */}
                  <div className="flex flex-wrap gap-2 border-b pb-1 text-xs mt-1">
                    {tabs.map((t) => {
                      const active = t.id === tab;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTab(t.id)}
                          className={[
                            'px-3 py-1.5 rounded-t-md border-b-2',
                            active
                              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/60'
                              : 'border-transparent text-gray-600 hover:bg-gray-50',
                          ].join(' ')}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Tab content */}
                  <div className="mt-3 space-y-4 text-sm">
                    {tab === 'overview' && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="rounded-lg border bg-gray-50 px-3 py-2">
                            <div className="text-xs text-gray-500">Upcoming appointments</div>
                            <div className="mt-1 text-xl font-semibold text-gray-900">
                              {selected.upcomingAppointments ?? 0}
                            </div>
                            <div className="mt-1 text-[11px] text-gray-600">
                              Manage bookings for {selected.name} from{' '}
                              <Link
                                href={`/appointments?personId=${encodeURIComponent(selected.patientId)}`}
                                className="underline"
                              >
                                Appointments
                              </Link>
                              .
                            </div>
                          </div>

                          <div className="rounded-lg border bg-gray-50 px-3 py-2">
                            <div className="text-xs text-gray-500">Active cases / encounters</div>
                            <div className="mt-1 text-xl font-semibold text-gray-900">
                              {selected.openEncounters ?? 0}
                            </div>
                            <div className="mt-1 text-[11px] text-gray-600">
                              View case notes from{' '}
                              <Link
                                href={`/encounters?personId=${encodeURIComponent(selected.patientId)}`}
                                className="underline"
                              >
                                Encounters
                              </Link>
                              .
                            </div>
                          </div>

                          <div className="rounded-lg border bg-gray-50 px-3 py-2">
                            <div className="text-xs text-gray-500">Open reminders</div>
                            <div className="mt-1 text-xl font-semibold text-gray-900">
                              {selected.unreadReminders ?? 0}
                            </div>
                            <div className="mt-1 text-[11px] text-gray-600">
                              Medication and follow-up nudges from{' '}
                              <Link
                                href={`/reminders?personId=${encodeURIComponent(selected.patientId)}`}
                                className="underline"
                              >
                                Reminders
                              </Link>
                              .
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                          <div className="rounded-lg border px-3 py-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Calendar className="h-4 w-4 text-indigo-500" />
                              <div className="font-medium text-gray-800 text-sm">
                                Book for {selected.name}
                              </div>
                            </div>
                            <p className="text-xs text-gray-600 mb-2">
                              Start a new consultation and choose the best clinician or practice for them.
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <Link
                                href={`/auto-triage?personId=${encodeURIComponent(selected.patientId)}`}
                                className="px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                              >
                                Start triage for {selected.name}
                              </Link>
                              <Link
                                href={`/appointments?personId=${encodeURIComponent(selected.patientId)}`}
                                className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                              >
                                Manage appointments
                              </Link>
                            </div>
                          </div>

                          <div className="rounded-lg border px-3 py-3">
                            <div className="flex items-center gap-2 mb-1">
                              <HeartPulse className="h-4 w-4 text-emerald-500" />
                              <div className="font-medium text-gray-800 text-sm">Join Televisit &amp; support</div>
                            </div>
                            <p className="text-xs text-gray-600 mb-2">
                              When a virtual visit starts, you&apos;ll receive a secure link so you can join
                              alongside {selected.name}, even from another location.
                            </p>
                            <p className="text-[11px] text-gray-500">
                              We&apos;ll finalise joint session rules and streaming soon. For now, you can still join
                              from the <Link href="/televisit" className="underline">Televisit</Link> section.
                            </p>
                          </div>
                        </div>
                      </>
                    )}

                    {tab === 'encounters' && (
                      <TabTeaser
                        title="Cases & Encounters"
                        description={`View ${selected.name}'s open and past cases, notes and discharge summaries.`}
                        primaryHref={`/encounters?personId=${encodeURIComponent(selected.patientId)}`}
                        primaryLabel="Go to Encounters"
                        secondaryHref="/encounters"
                        secondaryLabel="View my own cases"
                      />
                    )}

                    {tab === 'appointments' && (
                      <TabTeaser
                        title="Appointments"
                        description={`Book and manage appointments for ${selected.name}, including Televisit and in-person visits.`}
                        primaryHref={`/appointments?personId=${encodeURIComponent(selected.patientId)}`}
                        primaryLabel="Manage their appointments"
                        secondaryHref="/appointments"
                        secondaryLabel="View my appointments"
                      />
                    )}

                    {tab === 'reminders' && (
                      <TabTeaser
                        title="Reminders"
                        description={`Set up reminders for medications, follow-ups and self-care tasks for ${selected.name}.`}
                        primaryHref={`/reminders?personId=${encodeURIComponent(selected.patientId)}`}
                        primaryLabel="Manage their reminders"
                        secondaryHref="/reminders"
                        secondaryLabel="My reminders"
                        icon={<Bell className="h-4 w-4 text-amber-500" />}
                      />
                    )}

                    {tab === 'meds' && (
                      <TabTeaser
                        title="Medications & Orders"
                        description={`Track prescriptions, orders and adherence for ${selected.name}.`}
                        primaryHref={`/medications?personId=${encodeURIComponent(selected.patientId)}`}
                        primaryLabel="Manage their medications"
                        secondaryHref="/medications"
                        secondaryLabel="My medications"
                      />
                    )}

                    {tab === 'labs' && (
                      <TabTeaser
                        title="Labs & Results"
                        description={`See lab results and trends for ${selected.name}.`}
                        primaryHref={`/labs?personId=${encodeURIComponent(selected.patientId)}`}
                        primaryLabel="View their labs"
                        secondaryHref="/labs"
                        secondaryLabel="My labs"
                      />
                    )}

                    {tab === 'reports' && (
                      <TabTeaser
                        title="Reports & Insights"
                        description={`View fertility, stress, sleep and wellness insights for ${selected.name}.`}
                        primaryHref={`/reports?personId=${encodeURIComponent(selected.patientId)}`}
                        primaryLabel="View their reports"
                        secondaryHref="/reports"
                        secondaryLabel="My reports"
                      />
                    )}

                    {tab === 'care' && (
                      <TabTeaser
                        title="CarePort, MedReach & care teams"
                        description={`Coordinate deliveries, care teams and outreach for ${selected.name}.`}
                        primaryHref={`/careport?personId=${encodeURIComponent(selected.patientId)}`}
                        primaryLabel="Open their CarePort"
                        secondaryHref="/medreach"
                        secondaryLabel="MedReach & outreach"
                      />
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </section>
    </main>
  );
}

type TabTeaserProps = {
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  icon?: React.ReactNode;
};

function TabTeaser({
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  icon,
}: TabTeaserProps) {
  return (
    <div className="rounded-lg border bg-gray-50 px-3 py-3 sm:px-4 sm:py-4">
      <div className="flex items-center gap-2 mb-1.5">
        {icon ?? <ClipboardList className="h-4 w-4 text-gray-500" />}
        <div className="font-medium text-gray-800 text-sm">{title}</div>
      </div>
      <p className="text-xs text-gray-600 mb-3">{description}</p>
      <div className="flex flex-wrap gap-2 text-xs">
        <Link
          href={primaryHref}
          className="px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700"
        >
          {primaryLabel}
        </Link>
        <Link href={secondaryHref} className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50">
          {secondaryLabel}
        </Link>
      </div>
      <p className="mt-2 text-[11px] text-gray-500">
        Over time, these links will switch context fully so actions clearly belong to this person, while
        keeping audit trails and consent transparent.
      </p>
    </div>
  );
}

function PendingMemberPanel({ member }: { member: FamilyMember }) {
  return (
    <div className="mt-3 rounded-lg border bg-amber-50 px-3 py-3 text-sm text-amber-900">
      <div className="font-medium text-[13px] mb-1">Waiting for them to accept</div>
      <p className="text-[11px] text-amber-900">
        You&apos;ve shared an invitation with {member.name}. Once they accept, you&apos;ll be able to book
        appointments, join Televisit sessions and manage reminders on their behalf from this console.
      </p>
      <p className="mt-2 text-[11px] text-amber-800">
        If this was sent in error, you can revoke or update their access from the Family &amp; Friends settings
        once we hook in full controls.
      </p>
    </div>
  );
}
