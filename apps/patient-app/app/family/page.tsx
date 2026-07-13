// apps/patient-app/app/family/page.tsx
'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { Bell } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePlan } from '@/components/context/PlanContext';
import { toast } from '@/components/ToastMount';

import FamilyHero from '@/components/family/FamilyHero';
import FamilyInviteBanner from '@/components/family/FamilyInviteBanner';
import FamilySidebar from '@/components/family/FamilySideBar';
import FamilyMemberHeader from '@/components/family/FamilyMemberHeader';
import FamilyTabs from '@/components/family/FamilyTabs';
import FamilyOverviewTab from '@/components/family/FamilyOverviewTab';
import FamilyTabTeaser from '@/components/family/FamilyTabTeaser';
import FamilyPendingPanel from '@/components/family/FamilyPendingPanel';
import FamilyPermissionsModal from '@/components/family/FamilyPermissionsModal';
import FamilyConfirmDialog from '@/components/family/FamilyConfirmDialog';
import FamilyAuditPanel from '@/components/family/FamilyAuditPanel';

import type {
  ApiFamilyRelationship,
  ApiPendingInvite,
  ApiRelationshipsResponse,
  AuthMe,
  FamilyAuditItem,
  FamilyMember,
  PermissionsDraft,
  RelationshipCategory,
  TabId,
} from '@/components/family/types';

import {
  buildMockFamilyMembers,
  buildScopedHref,
  chooseDefaultSelected,
  deriveAccessFromPermissions,
  deriveAccessFromRelationType,
  emptyPermissionsDraft,
  fetchAuthMe,
  getIdentityHeaders,
  mapCategoryToRelationType,
  mapInviteCategory,
  mapRelationTypeToUi,
  normalizeRelationshipStatus,
  permissionsToDraft,
} from '@/components/family/utils';

type ConfirmState =
  | { kind: 'revoke'; relationshipId: string; label: string }
  | { kind: 'cancel_invite'; invitationId: string; label: string }
  | null;

function FamilyPageContent() {
  const { isPremium } = usePlan();
  const router = useRouter();
  const searchParams = useSearchParams();

  const qs = useMemo(
    () => new URLSearchParams(searchParams?.toString() ?? ''),
    [searchParams],
  );

  const acceptToken = qs.get('token');
  const demoMode = qs.get('demo') === '1';

  const [me, setMe] = useState<AuthMe | null>(null);

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('overview');

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [usingMock, setUsingMock] = useState(false);
  const [mockNote, setMockNote] = useState<string | null>(null);

  const [inviteName, setInviteName] = useState('');
  const [inviteRelation, setInviteRelation] = useState<RelationshipCategory>('Other');
  const [inviteContact, setInviteContact] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [acceptState, setAcceptState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const [declineState, setDeclineState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [declineError, setDeclineError] = useState<string | null>(null);

  const [linkingMedicalAid, setLinkingMedicalAid] = useState(false);
  const [medicalAidRelationshipId, setMedicalAidRelationshipId] = useState('');
  const [medicalAidPolicyId, setMedicalAidPolicyId] = useState('');
  const [medicalAidDependentCode, setMedicalAidDependentCode] = useState('');

  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const [permissionEditorOpen, setPermissionEditorOpen] = useState(false);
  const [permissionTarget, setPermissionTarget] = useState<FamilyMember | null>(null);
  const [permissionsDraft, setPermissionsDraft] = useState<PermissionsDraft>(emptyPermissionsDraft());
  const [savingPermissions, setSavingPermissions] = useState(false);

  const [auditItems, setAuditItems] = useState<FamilyAuditItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  function applyMembers(next: FamilyMember[]) {
    setMembers(next);
    setSelectedId((prev) => chooseDefaultSelected(prev, next));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const auth = await fetchAuthMe();
      if (!cancelled) setMe(auth);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadAudit(currentMe?: AuthMe | null) {
    const auth = currentMe ?? me;
    if (!auth?.user?.id) return;

    try {
      setAuditLoading(true);
      setAuditError(null);

      const res = await fetch('/api/family/audit?limit=20', {
        method: 'GET',
        headers: getIdentityHeaders(auth),
        cache: 'no-store',
      });

      const json: any = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || 'Failed to load family audit history');
      }

      setAuditItems(Array.isArray(json?.items) ? json.items : []);
    } catch (e: any) {
      setAuditError(e?.message || 'Failed to load family audit history');
      setAuditItems([]);
    } finally {
      setAuditLoading(false);
    }
  }

  async function loadRelationships(currentMe?: AuthMe | null) {
    const auth = currentMe ?? me;

    if (!auth?.user?.id) {
      setLoadError('You need to be signed in to manage Family & Friends.');
      setMembers([]);
      setSelectedId(null);
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);
      setUsingMock(false);
      setMockNote(null);

      const res = await fetch('/api/family/relationships', {
        method: 'GET',
        headers: getIdentityHeaders(auth),
        cache: 'no-store',
      });

      const json: ApiRelationshipsResponse | any = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || 'Failed to load family relationships');
      }

      const summaryBySubject = json?.summaryBySubject ?? {};

      const activeMembers: FamilyMember[] = (json.asHost ?? []).map((rel: ApiFamilyRelationship) => {
        const { category, relationLabel } = mapRelationTypeToUi(rel.relationType);
        const pid = rel.subject.patientId;
        const summary = summaryBySubject?.[pid] ?? {};

        return {
          id: `rel-${rel.id}`,
          relationshipId: rel.id,
          patientId: pid,
          name: rel.subject.name || 'Family member',
          category,
          relationLabel,
          status: normalizeRelationshipStatus(rel.status),
          permissions: rel.permissions ?? null,
          access: deriveAccessFromPermissions(rel.permissions, rel.relationType),
          upcomingAppointments: Number(summary?.upcomingAppointments ?? 0),
          openEncounters: Number(summary?.openEncounters ?? 0),
          unreadReminders: Number(summary?.unreadReminders ?? 0),
        };
      });

      const pendingInviteMembers: FamilyMember[] = (json.pendingInvites ?? []).map((inv: ApiPendingInvite) => {
        const { relationLabel } = mapRelationTypeToUi(inv.relationType);
        const category = mapInviteCategory(inv);
        return {
          id: `inv-${inv.id}`,
          invitationId: inv.id,
          patientId: inv.subjectPatientId ?? undefined,
          name: inv.subjectName || inv.invitedEmail || inv.invitedPhone || 'Pending invite',
          category,
          relationLabel,
          status: 'pending-invite',
          access: deriveAccessFromRelationType(inv.relationType),
          invitedEmail: inv.invitedEmail ?? null,
          invitedPhone: inv.invitedPhone ?? null,
          expiresAt: inv.expiresAt ?? null,
        };
      });

      const combined = [...activeMembers, ...pendingInviteMembers];

      if (combined.length === 0 && demoMode && process.env.NODE_ENV !== 'production') {
        setUsingMock(true);
        setMockNote('Development fallback is enabled because no live family links were found.');
        applyMembers(buildMockFamilyMembers());
        return;
      }

      applyMembers(combined);
    } catch (e: any) {
      const message = e?.message || 'Failed to load family relationships';

      if (demoMode) {
        setUsingMock(true);
        setMockNote(message);
        setLoadError(null);
        applyMembers(buildMockFamilyMembers());
      } else {
        setUsingMock(false);
        setMockNote(null);
        setLoadError(message);
        setMembers([]);
        setSelectedId(null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!me) return;
    loadRelationships(me);
    loadAudit(me);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  const selected = useMemo(
    () => members.find((m) => m.id === selectedId) ?? members[0] ?? null,
    [members, selectedId],
  );

  const isActiveMember = !!selected && selected.status === 'active' && !!selected.patientId;

  const stats = useMemo(() => {
    const active = members.filter((m) => m.status === 'active').length;
    const pending = members.filter((m) => m.status !== 'active').length;
    return { total: members.length, active, pending };
  }, [members]);

  async function handleCreateInvite() {
    if (!me?.user?.id) {
      setInviteError('You need to be signed in.');
      return;
    }

    const name = inviteName.trim();
    const contact = inviteContact.trim();

    if (!name || !contact) {
      setInviteError('Please enter a name and an email or mobile number.');
      return;
    }

    const { relationType, subjectCategory } = mapCategoryToRelationType(inviteRelation);
    const direction =
  relationType === 'SPOUSE'
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
          ...getIdentityHeaders(me),
        },
        body: JSON.stringify(payload),
      });

      const json: any = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || 'Failed to send invitation');
      }

      toast('Invitation sent. We’ll ask them to accept and choose what to share.', 'success');
      setInviteName('');
      setInviteContact('');
      setInviteRelation('Other');
      await loadRelationships(me);
      await loadAudit(me);
    } catch (e: any) {
      const message = e?.message || 'Failed to send invitation';
      setInviteError(message);
      toast(message, 'error');
    } finally {
      setInviting(false);
    }
  }

  async function handleAcceptInvitation() {
    if (!acceptToken || !me?.user?.id) return;

    try {
      setAcceptState('submitting');
      setAcceptError(null);

      const res = await fetch('/api/family/invitations/accept', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...getIdentityHeaders(me),
        },
        body: JSON.stringify({ token: acceptToken }),
      });

      const json: any = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || 'Failed to accept invitation');
      }

      toast('Invitation accepted. Your care link has been created securely.', 'success');
      setAcceptState('done');
      await loadRelationships(me);
      await loadAudit(me);
      router.replace('/family');
    } catch (e: any) {
      const message = e?.message || 'Failed to accept invitation';
      setAcceptError(message);
      setAcceptState('error');
      toast(message, 'error');
    }
  }

  async function handleDeclineInvitation() {
    if (!acceptToken) return;

    try {
      setDeclineState('submitting');
      setDeclineError(null);

      const res = await fetch('/api/family/invitations/decline', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...getIdentityHeaders(me),
        },
        body: JSON.stringify({ token: acceptToken }),
      });

      const json: any = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || 'Failed to decline invitation');
      }

      toast('Invitation declined.', 'success');
      setDeclineState('done');
      await loadAudit(me);
      router.replace('/family');
    } catch (e: any) {
      const message = e?.message || 'Failed to decline invitation';
      setDeclineError(message);
      setDeclineState('error');
      toast(message, 'error');
    }
  }

  async function handleLinkMedicalAid() {
    if (!me?.user?.id) {
      toast('You need to be signed in.', 'error');
      return;
    }
    if (!medicalAidRelationshipId.trim() || !medicalAidPolicyId.trim()) {
      toast('relationshipId and hostPolicyId are required.', 'error');
      return;
    }

    try {
      setLinkingMedicalAid(true);

      const res = await fetch('/api/family/medical-aid/link', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...getIdentityHeaders(me),
        },
        body: JSON.stringify({
          relationshipId: medicalAidRelationshipId.trim(),
          hostPolicyId: medicalAidPolicyId.trim(),
          dependentCode: medicalAidDependentCode.trim() || null,
        }),
      });

      const json: any = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed to link medical aid');

      toast('Medical aid linked for dependant use.', 'success');
      setMedicalAidDependentCode('');
    } catch (e: any) {
      toast(e?.message || 'Failed to link medical aid', 'error');
    } finally {
      setLinkingMedicalAid(false);
    }
  }

  async function doRevokeRelationship(relationshipId?: string) {
    if (!relationshipId || !me?.user?.id) return;

    try {
      setActionBusyId(`rel-${relationshipId}`);

      const res = await fetch(`/api/family/relationships/${encodeURIComponent(relationshipId)}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          ...getIdentityHeaders(me),
        },
        body: JSON.stringify({ action: 'revoke' }),
      });

      const json: any = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || 'Failed to revoke relationship');
      }

      toast('Access revoked.', 'success');
      await loadRelationships(me);
      await loadAudit(me);
    } catch (e: any) {
      toast(e?.message || 'Failed to revoke relationship', 'error');
    } finally {
      setActionBusyId(null);
      setConfirmState(null);
    }
  }

  async function doCancelInvitation(invitationId?: string) {
    if (!invitationId || !me?.user?.id) return;

    try {
      setActionBusyId(`inv-cancel-${invitationId}`);

      const res = await fetch(`/api/family/invitations/${encodeURIComponent(invitationId)}`, {
        method: 'DELETE',
        headers: getIdentityHeaders(me),
      });

      const json: any = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || 'Failed to cancel invitation');
      }

      toast('Invitation cancelled.', 'success');
      await loadRelationships(me);
      await loadAudit(me);
    } catch (e: any) {
      toast(e?.message || 'Failed to cancel invitation', 'error');
    } finally {
      setActionBusyId(null);
      setConfirmState(null);
    }
  }

  async function handleResendInvitation(invitationId?: string) {
    if (!invitationId || !me?.user?.id) return;

    try {
      setActionBusyId(`inv-resend-${invitationId}`);

      const res = await fetch(`/api/family/invitations/${encodeURIComponent(invitationId)}/resend`, {
        method: 'POST',
        headers: getIdentityHeaders(me),
      });

      const json: any = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || 'Failed to resend invitation');
      }

      toast('Invitation resent.', 'success');
      await loadRelationships(me);
      await loadAudit(me);
    } catch (e: any) {
      toast(e?.message || 'Failed to resend invitation', 'error');
    } finally {
      setActionBusyId(null);
    }
  }

  function openPermissionEditor(member: FamilyMember) {
    setPermissionTarget(member);
    setPermissionsDraft(permissionsToDraft(member.permissions));
    setPermissionEditorOpen(true);
  }

  async function handleSavePermissions() {
    if (!permissionTarget?.relationshipId || !me?.user?.id) return;

    try {
      setSavingPermissions(true);

      const res = await fetch(`/api/family/relationships/${encodeURIComponent(permissionTarget.relationshipId)}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          ...getIdentityHeaders(me),
        },
        body: JSON.stringify({
          action: 'update_permissions',
          permissions: permissionsDraft,
        }),
      });

      const json: any = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || 'Failed to update permissions');
      }

      toast('Permissions updated.', 'success');
      setPermissionEditorOpen(false);
      setPermissionTarget(null);
      await loadRelationships(me);
      await loadAudit(me);
    } catch (e: any) {
      toast(e?.message || 'Failed to update permissions', 'error');
    } finally {
      setSavingPermissions(false);
    }
  }

  const tabs: { id: TabId; label: string; description: string }[] = [
    { id: 'overview', label: 'Overview', description: 'Snapshot across care, appointments and reminders.' },
    { id: 'encounters', label: 'Cases & Encounters', description: 'Visits, notes and active cases.' },
    { id: 'appointments', label: 'Appointments', description: 'Upcoming and past bookings you manage for them.' },
    { id: 'reminders', label: 'Reminders', description: 'Medication, follow-up and self-care reminders.' },
    { id: 'meds', label: 'Medications', description: 'Current meds, adherence and pharmacy orders.' },
    { id: 'labs', label: 'Labs & Results', description: 'Test results and trends over time.' },
    { id: 'reports', label: 'Reports & Insights', description: 'Fertility, stress, sleep and wellbeing reports.' },
    { id: 'care', label: 'CarePort & MedReach', description: 'Care teams, deliveries and virtual care sessions.' },
    { id: 'history', label: 'History', description: 'Recent relationship and invitation activity.' },
  ];

  const confirmBusy =
    (confirmState?.kind === 'revoke' && actionBusyId === `rel-${confirmState.relationshipId}`) ||
    (confirmState?.kind === 'cancel_invite' && actionBusyId === `inv-cancel-${confirmState.invitationId}`);

  return (
    <main data-p-ui="patient-family-page" className="min-w-0 overflow-x-clip relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.08),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(34,211,238,0.08),_transparent_24%),linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_48%,_#f8faff_100%)] px-4 pb-10 pt-4 md:px-6 md:pt-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute left-[-10%] top-[-6%] h-[360px] w-[360px] rounded-full bg-cyan-300/16 blur-3xl" />
        <div className="absolute right-[-8%] top-[8%] h-[320px] w-[320px] rounded-full bg-indigo-300/12 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[1540px] flex-col gap-5 md:gap-6">
        <FamilyHero stats={stats} isPremium={isPremium} />

        <FamilyInviteBanner
          visible={Boolean(acceptToken && acceptState !== 'done' && declineState !== 'done')}
          acceptState={acceptState}
          declineState={declineState}
          acceptError={acceptError}
          declineError={declineError}
          onAccept={handleAcceptInvitation}
          onDecline={handleDeclineInvitation}
        />

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)]">
          <FamilySidebar
            members={members}
            selectedId={selectedId}
            onSelect={(m) => {
              setSelectedId(m.id);
              if (m.relationshipId) setMedicalAidRelationshipId(m.relationshipId);
            }}
            onOpenPermissions={openPermissionEditor}
            onRevoke={(relationshipId) =>
              relationshipId &&
              setConfirmState({
                kind: 'revoke',
                relationshipId,
                label: 'Revoke access',
              })
            }
            onResend={handleResendInvitation}
            onCancelInvite={(invitationId) =>
              invitationId &&
              setConfirmState({
                kind: 'cancel_invite',
                invitationId,
                label: 'Cancel invite',
              })
            }
            actionBusyId={actionBusyId}
            loading={loading}
            loadError={loadError}
            usingMock={usingMock}
            mockNote={mockNote}
            onRetry={() => {
              loadRelationships(me);
              loadAudit(me);
            }}
            inviteName={inviteName}
            setInviteName={setInviteName}
            inviteContact={inviteContact}
            setInviteContact={setInviteContact}
            inviteRelation={inviteRelation}
            setInviteRelation={setInviteRelation}
            inviting={inviting}
            inviteError={inviteError}
            isPremium={isPremium}
            onInviteSubmit={handleCreateInvite}
          />

          <section className="rounded-[28px] border border-white/60 bg-white/86 p-4 shadow-[0_10px_40px_rgba(15,23,42,0.05)] backdrop-blur-xl md:p-5 xl:p-6">
            {!selected ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
                Add a family member or friend on the left to start coordinating their care.
              </div>
            ) : (
              <>
                <FamilyMemberHeader member={selected} />

                {!isActiveMember ? <FamilyPendingPanel member={selected} /> : null}

                {isActiveMember && selected.patientId ? (
                  <>
                    <FamilyTabs tabs={tabs} tab={tab} onChange={setTab} />

                    {tab === 'overview' ? (
                      <FamilyOverviewTab
                        member={selected}
                        medicalAidRelationshipId={medicalAidRelationshipId}
                        medicalAidPolicyId={medicalAidPolicyId}
                        medicalAidDependentCode={medicalAidDependentCode}
                        setMedicalAidRelationshipId={setMedicalAidRelationshipId}
                        setMedicalAidPolicyId={setMedicalAidPolicyId}
                        setMedicalAidDependentCode={setMedicalAidDependentCode}
                        linkingMedicalAid={linkingMedicalAid}
                        onLinkMedicalAid={handleLinkMedicalAid}
                      />
                    ) : null}

                    {tab === 'encounters' ? (
                      <div className="mt-4">
                        <FamilyTabTeaser
                          title="Cases & Encounters"
                          description={`View ${selected.name}'s open and past cases, notes and discharge summaries.`}
                          primaryHref={buildScopedHref('/encounters', selected.patientId, selected.relationshipId)}
                          primaryLabel="Go to Encounters"
                          secondaryHref="/encounters"
                          secondaryLabel="View my own cases"
                        />
                      </div>
                    ) : null}

                    {tab === 'appointments' ? (
                      <div className="mt-4">
                        <FamilyTabTeaser
                          title="Appointments"
                          description={`Book and manage appointments for ${selected.name}, including Televisit and in-person visits.`}
                          primaryHref={buildScopedHref('/appointments', selected.patientId, selected.relationshipId)}
                          primaryLabel="Manage their appointments"
                          secondaryHref="/appointments"
                          secondaryLabel="View my appointments"
                        />
                      </div>
                    ) : null}

                    {tab === 'reminders' ? (
                      <div className="mt-4">
                        <FamilyTabTeaser
                          title="Reminders"
                          description={`Set up reminders for medications, follow-ups and self-care tasks for ${selected.name}.`}
                          primaryHref={buildScopedHref('/reminders', selected.patientId, selected.relationshipId)}
                          primaryLabel="Manage their reminders"
                          secondaryHref="/reminders"
                          secondaryLabel="My reminders"
                          icon={<Bell className="h-4 w-4 text-amber-500" />}
                        />
                      </div>
                    ) : null}

                    {tab === 'meds' ? (
                      <div className="mt-4">
                        <FamilyTabTeaser
                          title="Medications & Orders"
                          description={`Track prescriptions, orders and adherence for ${selected.name}.`}
                          primaryHref={buildScopedHref('/medications', selected.patientId, selected.relationshipId)}
                          primaryLabel="Manage their medications"
                          secondaryHref="/medications"
                          secondaryLabel="My medications"
                        />
                      </div>
                    ) : null}

                    {tab === 'labs' ? (
                      <div className="mt-4">
                        <FamilyTabTeaser
                          title="Labs & Results"
                          description={`See lab results and trends for ${selected.name}.`}
                          primaryHref={buildScopedHref('/labs', selected.patientId, selected.relationshipId)}
                          primaryLabel="View their labs"
                          secondaryHref="/labs"
                          secondaryLabel="My labs"
                        />
                      </div>
                    ) : null}

                    {tab === 'reports' ? (
                      <div className="mt-4">
                        <FamilyTabTeaser
                          title="Reports & Insights"
                          description={`View fertility, stress, sleep and wellness insights for ${selected.name}.`}
                          primaryHref={buildScopedHref('/reports', selected.patientId, selected.relationshipId)}
                          primaryLabel="View their reports"
                          secondaryHref="/reports"
                          secondaryLabel="My reports"
                        />
                      </div>
                    ) : null}

                    {tab === 'care' ? (
                      <div className="mt-4">
                        <FamilyTabTeaser
                          title="CarePort, MedReach & care teams"
                          description={`Coordinate deliveries, care teams and outreach for ${selected.name}.`}
                          primaryHref={buildScopedHref('/careport', selected.patientId, selected.relationshipId)}
                          primaryLabel="Open their CarePort"
                          secondaryHref="/medreach"
                          secondaryLabel="MedReach & outreach"
                        />
                      </div>
                    ) : null}

                    {tab === 'history' ? (
                      <FamilyAuditPanel
                        items={auditItems}
                        loading={auditLoading}
                        error={auditError}
                        onRefresh={() => loadAudit(me)}
                      />
                    ) : null}
                  </>
                ) : null}
              </>
            )}
          </section>
        </section>
      </div>

      <FamilyPermissionsModal
        open={permissionEditorOpen}
        member={permissionTarget}
        draft={permissionsDraft}
        setDraft={setPermissionsDraft}
        saving={savingPermissions}
        onClose={() => {
          setPermissionEditorOpen(false);
          setPermissionTarget(null);
        }}
        onSave={handleSavePermissions}
      />

      <FamilyConfirmDialog
        open={Boolean(confirmState)}
        title={
          confirmState?.kind === 'revoke'
            ? 'Revoke family access?'
            : confirmState?.kind === 'cancel_invite'
              ? 'Cancel pending invitation?'
              : ''
        }
        body={
          confirmState?.kind === 'revoke'
            ? 'This will immediately remove the active relationship access for this person.'
            : confirmState?.kind === 'cancel_invite'
              ? 'This will expire the pending invitation so it can no longer be accepted.'
              : ''
        }
        confirmLabel={confirmState?.label ?? 'Confirm'}
        busy={Boolean(confirmBusy)}
        tone="danger"
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          if (!confirmState) return;
          if (confirmState.kind === 'revoke') {
            void doRevokeRelationship(confirmState.relationshipId);
          } else {
            void doCancelInvitation(confirmState.invitationId);
          }
        }}
      />
    </main>
  );
}

export default function FamilyPage() {
  return (
    <Suspense fallback={null}>
      <FamilyPageContent />
    </Suspense>
  );
}
