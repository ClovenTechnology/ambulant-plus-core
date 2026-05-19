import type {
  AccessProfile,
  ApiFamilyRelationship,
  ApiPendingInvite,
  AuthMe,
  FamilyMember,
  PermissionsDraft,
  RelationshipCategory,
  RelationshipStatus,
} from './types';

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export async function fetchAuthMe(): Promise<AuthMe | null> {
  try {
    const r = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!r.ok) return null;
    return (await r.json()) as AuthMe;
  } catch {
    return null;
  }
}

export function getIdentityHeaders(me?: AuthMe | null): HeadersInit {
  return {
    'x-role': 'patient',
    ...(me?.user?.id ? { 'x-uid': String(me.user.id) } : {}),
    ...(me?.user?.orgId ? { 'x-org-id': String(me.user.orgId) } : {}),
  };
}

export function statusLabel(status: RelationshipStatus) {
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

export function statusTone(status: RelationshipStatus) {
  switch (status) {
    case 'active':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'pending-invite':
    case 'pending-accept':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'revoked':
      return 'border-rose-200 bg-rose-50 text-rose-800';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

export const CATEGORY_LABELS: Record<RelationshipCategory, string> = {
  Partner: 'Partners',
  Child: 'Children & Dependants',
  Parent: 'Parents & Elders',
  Other: 'Care circle & friends',
};

export function mapRelationTypeToUi(
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

export function mapCategoryToRelationType(cat: RelationshipCategory) {
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

export function deriveAccessFromRelationType(
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
  return { canBook: false, canViewHealth: false, canJoinTelevisit: true };
}

export function deriveAccessFromPermissions(permissions: any, relationType: string): AccessProfile {
  if (!permissions || typeof permissions !== 'object') {
    return deriveAccessFromRelationType(relationType);
  }

  const appointments = permissions?.modules?.appointments ?? null;
  const encounters = permissions?.modules?.encounters ?? null;

  return {
    canBook: Boolean(permissions?.canBookAppointments) || Boolean(appointments?.book),
    canViewHealth:
      Boolean(permissions?.canViewHighLevelSummary) ||
      Boolean(encounters?.viewSummary) ||
      Boolean(encounters?.viewFullNotes),
    canJoinTelevisit: Boolean(permissions?.canJoinTelevisit),
  };
}

export function normalizeRelationshipStatus(raw?: string | null): RelationshipStatus {
  const s = String(raw || '').toUpperCase();
  if (s === 'ACTIVE') return 'active';
  if (s === 'PENDING') return 'pending-accept';
  if (s === 'REVOKED') return 'revoked';
  return 'active';
}

export function emptyPermissionsDraft(): PermissionsDraft {
  return {
    canJoinTelevisit: false,
    canBookAppointments: false,
    canViewHighLevelSummary: false,
    modules: {
      encounters: { viewSummary: false, viewFullNotes: false },
      appointments: { view: true, book: false, cancel: false, reschedule: false },
      reminders: { view: false, manage: false },
      meds: { view: false, manage: false },
      labs: { view: false },
      vitals: { view: false },
      reports: { view: false },
      careport: { view: false, manage: false },
      medreach: { view: false, manage: false },
    },
  };
}

export function permissionsToDraft(permissions: any): PermissionsDraft {
  const base = emptyPermissionsDraft();
  if (!permissions || typeof permissions !== 'object') return base;

  return {
    canJoinTelevisit: Boolean(permissions?.canJoinTelevisit),
    canBookAppointments: Boolean(permissions?.canBookAppointments),
    canViewHighLevelSummary: Boolean(permissions?.canViewHighLevelSummary),
    modules: {
      encounters: {
        viewSummary: Boolean(permissions?.modules?.encounters?.viewSummary),
        viewFullNotes: Boolean(permissions?.modules?.encounters?.viewFullNotes),
      },
      appointments: {
        view: permissions?.modules?.appointments?.view !== false,
        book: Boolean(permissions?.modules?.appointments?.book),
        cancel: Boolean(permissions?.modules?.appointments?.cancel),
        reschedule: Boolean(permissions?.modules?.appointments?.reschedule),
      },
      reminders: {
        view: Boolean(permissions?.modules?.reminders?.view),
        manage: Boolean(permissions?.modules?.reminders?.manage),
      },
      meds: {
        view: Boolean(permissions?.modules?.meds?.view),
        manage: Boolean(permissions?.modules?.meds?.manage),
      },
      labs: { view: Boolean(permissions?.modules?.labs?.view) },
      vitals: { view: Boolean(permissions?.modules?.vitals?.view) },
      reports: { view: Boolean(permissions?.modules?.reports?.view) },
      careport: {
        view: Boolean(permissions?.modules?.careport?.view),
        manage: Boolean(permissions?.modules?.careport?.manage),
      },
      medreach: {
        view: Boolean(permissions?.modules?.medreach?.view),
        manage: Boolean(permissions?.modules?.medreach?.manage),
      },
    },
  };
}

export function buildScopedHref(path: string, patientId?: string, relationshipId?: string) {
  const qs = new URLSearchParams();
  if (patientId) qs.set('subjectPatientId', patientId);
  if (relationshipId) qs.set('relationshipId', relationshipId);
  return `${path}${qs.toString() ? `?${qs.toString()}` : ''}`;
}

export function chooseDefaultSelected(prev: string | null, list: FamilyMember[]): string | null {
  if (prev && list.some((m) => m.id === prev)) return prev;
  const spouse = list.find((m) => m.category === 'Partner');
  return spouse?.id ?? list[0]?.id ?? null;
}

export function buildMockFamilyMembers(): FamilyMember[] {
  return [
    {
      id: 'demo-pat-amina',
      relationshipId: 'demo-rel-amina',
      patientId: 'demo-pat-amina',
      name: 'Amina S.',
      category: 'Partner',
      relationLabel: 'Spouse / Partner',
      status: 'active',
      permissions: emptyPermissionsDraft(),
      access: deriveAccessFromRelationType('SPOUSE'),
      upcomingAppointments: 2,
      openEncounters: 1,
      unreadReminders: 3,
    },
    {
      id: 'inv-demo-khai',
      invitationId: 'inv-demo-khai',
      name: 'Khai S.',
      category: 'Child',
      relationLabel: 'Child / Dependant',
      status: 'pending-invite',
      access: deriveAccessFromRelationType('CHILD'),
      invitedEmail: 'khai@example.com',
    },
  ];
}

export function mapInviteCategory(inv: ApiPendingInvite): RelationshipCategory {
  const { category } = mapRelationTypeToUi(inv.relationType);
  return category;
}

export function formatExpiry(expiresAt?: string | null) {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}