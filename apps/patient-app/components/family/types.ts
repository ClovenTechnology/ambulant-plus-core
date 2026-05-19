export type RelationshipCategory = 'Partner' | 'Child' | 'Parent' | 'Other';
export type RelationshipStatus = 'active' | 'pending-invite' | 'pending-accept' | 'revoked';

export type AccessProfile = {
  canBook: boolean;
  canViewHealth: boolean;
  canJoinTelevisit: boolean;
};

export type FamilyMember = {
  id: string;
  relationshipId?: string;
  invitationId?: string;
  patientId?: string;
  name: string;
  category: RelationshipCategory;
  relationLabel: string;
  status: RelationshipStatus;
  access: AccessProfile;
  permissions?: any;
  upcomingAppointments?: number;
  openEncounters?: number;
  unreadReminders?: number;
  invitedEmail?: string | null;
  invitedPhone?: string | null;
  expiresAt?: string | null;
};

export type TabId =
  | 'overview'
  | 'encounters'
  | 'appointments'
  | 'reminders'
  | 'meds'
  | 'labs'
  | 'reports'
  | 'care'
  | 'history';

export type ApiFamilySubject = {
  patientId: string;
  userId?: string | null;
  name?: string | null;
  dob?: string | null;
  gender?: string | null;
  city?: string | null;
};

export type ApiFamilyRelationship = {
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
  status?: string;
  permissions?: any;
  createdAt?: string | null;
  subject: ApiFamilySubject;
};

export type ApiPendingInvite = {
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
  status?: string;
  subjectPatientId?: string | null;
  subjectName?: string | null;
  invitedEmail?: string | null;
  invitedPhone?: string | null;
  subjectCategory?: string | null;
  expiresAt?: string | null;
  createdAt?: string | null;
};

export type ApiRelationshipsResponse = {
  ok: boolean;
  asHost: ApiFamilyRelationship[];
  asSubject: ApiFamilyRelationship[];
  pendingInvites?: ApiPendingInvite[];
  summaryBySubject?: Record<
    string,
    {
      upcomingAppointments: number;
      openEncounters: number;
      unreadReminders: number;
    }
  >;
};

export type FamilyAuditItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  actorUserId?: string | null;
  actorType?: string | null;
  createdAt?: string | null;
  meta?: any;
};

export type AuthMe = {
  ok?: boolean;
  user?: {
    id?: string | null;
    actorType?: string | null;
    actorRefId?: string | null;
    sid?: string | null;
    orgId?: string | null;
  } | null;
  iat?: number | null;
  exp?: number | null;
};

export type PermissionsDraft = {
  canJoinTelevisit: boolean;
  canBookAppointments: boolean;
  canViewHighLevelSummary: boolean;
  modules: {
    encounters: { viewSummary: boolean; viewFullNotes: boolean };
    appointments: { view: boolean; book: boolean; cancel: boolean; reschedule: boolean };
    reminders: { view: boolean; manage: boolean };
    meds: { view: boolean; manage: boolean };
    labs: { view: boolean };
    vitals: { view: boolean };
    reports: { view: boolean };
    careport: { view: boolean; manage: boolean };
    medreach: { view: boolean; manage: boolean };
  };
};

export type FamilyStats = {
  total: number;
  active: number;
  pending: number;
};