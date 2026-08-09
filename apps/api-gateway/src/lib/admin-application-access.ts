import {
  AdminStaffAuthError,
  type AdminStaffActor,
} from '@/src/lib/admin-staff-auth';

export type ApplicationScope =
  | 'applications.read'
  | 'applications.review'
  | 'applications.assign'
  | 'applications.decision'
  | 'applications.documents.read'
  | 'applications.documents.request'
  | 'applications.documents.review'
  | 'applications.interviews.read'
  | 'applications.interviews.schedule'
  | 'applications.interviews.manage';

const IMPLIED_SCOPES: Record<ApplicationScope, ApplicationScope[]> = {
  'applications.read': [
    'applications.read',
    'applications.review',
    'applications.assign',
    'applications.decision',
    'applications.documents.read',
    'applications.documents.request',
    'applications.documents.review',
    'applications.interviews.read',
    'applications.interviews.schedule',
    'applications.interviews.manage',
  ],
  'applications.review': ['applications.review', 'applications.decision'],
  'applications.assign': ['applications.assign'],
  'applications.decision': ['applications.decision'],
  'applications.documents.read': [
    'applications.documents.read',
    'applications.documents.request',
    'applications.documents.review',
  ],
  'applications.documents.request': [
    'applications.documents.request',
    'applications.documents.review',
  ],
  'applications.documents.review': ['applications.documents.review'],
  'applications.interviews.read': [
    'applications.interviews.read',
    'applications.interviews.schedule',
    'applications.interviews.manage',
  ],
  'applications.interviews.schedule': [
    'applications.interviews.schedule',
    'applications.interviews.manage',
  ],
  'applications.interviews.manage': ['applications.interviews.manage'],
};

export function hasApplicationScope(
  actor: AdminStaffActor,
  required: ApplicationScope,
) {
  if (actor.isSuperAdmin) return true;
  return IMPLIED_SCOPES[required].some((scope) => actor.scopes.includes(scope));
}

export function requireApplicationScope(
  actor: AdminStaffActor,
  required: ApplicationScope,
) {
  if (!hasApplicationScope(actor, required)) {
    throw new AdminStaffAuthError('application_scope_required', 403);
  }
  return actor;
}
