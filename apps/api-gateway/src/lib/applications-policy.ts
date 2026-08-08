export const APPLICATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'DOCUMENTS_REQUESTED',
  'INTERVIEW_INVITED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEWED',
  'SUCCESSFUL',
  'OFFERED',
  'ONBOARDING',
  'DECLINED',
  'WITHDRAWN',
  'EXPIRED',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

const TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  DRAFT: ['SUBMITTED', 'WITHDRAWN', 'EXPIRED'],
  SUBMITTED: ['UNDER_REVIEW', 'DECLINED', 'WITHDRAWN', 'EXPIRED'],
  UNDER_REVIEW: ['SHORTLISTED', 'DOCUMENTS_REQUESTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED'],
  SHORTLISTED: ['DOCUMENTS_REQUESTED', 'INTERVIEW_INVITED', 'DECLINED', 'WITHDRAWN', 'EXPIRED'],
  DOCUMENTS_REQUESTED: ['UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_INVITED', 'DECLINED', 'WITHDRAWN', 'EXPIRED'],
  INTERVIEW_INVITED: ['INTERVIEW_SCHEDULED', 'DECLINED', 'WITHDRAWN', 'EXPIRED'],
  INTERVIEW_SCHEDULED: ['INTERVIEWED', 'DECLINED', 'WITHDRAWN', 'EXPIRED'],
  INTERVIEWED: ['SUCCESSFUL', 'OFFERED', 'DECLINED', 'WITHDRAWN', 'EXPIRED'],
  SUCCESSFUL: ['OFFERED', 'ONBOARDING', 'WITHDRAWN'],
  OFFERED: ['ONBOARDING', 'WITHDRAWN', 'EXPIRED'],
  ONBOARDING: ['WITHDRAWN'],
  DECLINED: [],
  WITHDRAWN: [],
  EXPIRED: [],
};

const OPPORTUNITY_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return APPLICATION_STATUSES.includes(value as ApplicationStatus);
}

export function canTransitionApplication(from: ApplicationStatus, to: ApplicationStatus) {
  return TRANSITIONS[from].includes(to);
}

export function normaliseApplicationOpportunitySlug(value: unknown) {
  const slug = String(value ?? '').trim().toLowerCase().slice(0, 160);
  return OPPORTUNITY_SLUG.test(slug) ? slug : '';
}

export function publicApplicationContext(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const slug = normaliseApplicationOpportunitySlug(
    (value as Record<string, unknown>).opportunitySlug,
  );
  return slug ? { opportunitySlug: slug } : null;
}


export const ADMIN_REVIEW_TRANSITIONS: Partial<
  Record<ApplicationStatus, readonly ApplicationStatus[]>
> = {
  SUBMITTED: ['UNDER_REVIEW', 'DECLINED'],
  UNDER_REVIEW: ['SHORTLISTED', 'DECLINED'],
  SHORTLISTED: ['DECLINED'],
};

export function canAdminTransitionApplication(
  from: ApplicationStatus,
  to: ApplicationStatus,
) {
  return Boolean(
    canTransitionApplication(from, to) &&
      ADMIN_REVIEW_TRANSITIONS[from]?.includes(to),
  );
}

export function cleanApplicationReason(value: unknown, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}
