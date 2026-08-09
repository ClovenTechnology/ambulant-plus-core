export type StaffCapability =
  | 'staff.directory.read'
  | 'staff.manage'
  | 'staff.roles.manage'
  | 'communications.use'
  | 'recruitment.templates.read'
  | 'recruitment.templates.manage'
  | 'recruitment.settings.manage'
  | 'applications.onboarding.manage'
  | 'meetings.create'
  | 'meetings.moderate'
  | 'meetings.invite_external'
  | 'meetings.record'
  | 'meetings.audit.read';

export type StaffLifecycleState =
  | 'ACTIVE'
  | 'LEAVE'
  | 'SUSPENDED'
  | 'ARCHIVED';

export type StaffPresenceState =
  | 'AVAILABLE'
  | 'BUSY'
  | 'IN_MEETING'
  | 'DO_NOT_DISTURB'
  | 'OFFLINE';

function canonical(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s&_.:-]+/g, '');
}

const LEGACY_CAPABILITY_ALIASES: Record<StaffCapability, string[]> = {
  'staff.directory.read': ['hr', 'manageroles'],
  'staff.manage': ['hr', 'manageroles'],
  'staff.roles.manage': ['manageroles'],
  'communications.use': [],
  'recruitment.templates.read': ['hr', 'manageroles', 'opportunitiesread', 'opportunitiesmanage'],
  'recruitment.templates.manage': ['hr', 'manageroles', 'opportunitiesmanage'],
  'recruitment.settings.manage': ['hr', 'manageroles'],
  'applications.onboarding.manage': ['hr', 'manageroles', 'applicationsdecision'],
  'meetings.create': [],
  'meetings.moderate': [],
  'meetings.invite_external': [],
  'meetings.record': [],
  'meetings.audit.read': ['complianceauditread'],
};

export function hasStaffCapability(
  input: {
    roles?: string[];
    scopes?: string[];
    isSuperAdmin?: boolean;
  },
  capability: StaffCapability,
) {
  if (input.isSuperAdmin) return true;

  const values = new Set(
    [...(input.roles || []), ...(input.scopes || [])]
      .map(canonical)
      .filter(Boolean),
  );

  if (
    values.has('superadmin') ||
    values.has('adminall') ||
    values.has('*')
  ) {
    return true;
  }

  if (values.has(canonical(capability))) return true;

  return LEGACY_CAPABILITY_ALIASES[capability]
    .some((alias) => values.has(alias));
}

const LIFECYCLE_TRANSITIONS: Record<StaffLifecycleState, StaffLifecycleState[]> = {
  ACTIVE: ['LEAVE', 'SUSPENDED', 'ARCHIVED'],
  LEAVE: ['ACTIVE', 'SUSPENDED', 'ARCHIVED'],
  SUSPENDED: ['ACTIVE', 'ARCHIVED'],
  ARCHIVED: ['ACTIVE'],
};

export function canTransitionStaffLifecycle(
  from: StaffLifecycleState,
  to: StaffLifecycleState,
) {
  if (from === to) return true;
  return LIFECYCLE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function effectivePresence(
  input: {
    state?: StaffPresenceState | null;
    expiresAt?: Date | string | null;
  } | null | undefined,
  now = new Date(),
): StaffPresenceState {
  if (!input?.state || !input.expiresAt) return 'OFFLINE';
  const expiry = new Date(input.expiresAt);
  if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= now.getTime()) {
    return 'OFFLINE';
  }
  return input.state;
}

export function staffPresenceTtlMs() {
  const configured = Number(process.env.STAFF_PRESENCE_TTL_MS || '90000');
  if (!Number.isFinite(configured)) return 90_000;
  return Math.min(10 * 60_000, Math.max(30_000, Math.floor(configured)));
}
