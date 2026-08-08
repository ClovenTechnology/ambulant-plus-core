import {
  AdminStaffAuthError,
  type AdminStaffActor,
} from '@/src/lib/admin-staff-auth';

export type EnterpriseFormScope =
  | 'forms.read'
  | 'forms.design'
  | 'forms.publish'
  | 'forms.submissions.read'
  | 'forms.submissions.sensitive.read';

const IMPLIED_SCOPES: Record<EnterpriseFormScope, EnterpriseFormScope[]> = {
  'forms.read': ['forms.read', 'forms.design', 'forms.publish'],
  'forms.design': ['forms.design'],
  'forms.publish': ['forms.publish'],
  'forms.submissions.read': [
    'forms.submissions.read',
    'forms.submissions.sensitive.read',
  ],
  'forms.submissions.sensitive.read': ['forms.submissions.sensitive.read'],
};

export function hasEnterpriseFormScope(
  actor: AdminStaffActor,
  required: EnterpriseFormScope,
) {
  if (actor.isSuperAdmin) return true;
  const accepted = IMPLIED_SCOPES[required];
  return accepted.some((scope) => actor.scopes.includes(scope));
}

export function requireEnterpriseFormScope(
  actor: AdminStaffActor,
  required: EnterpriseFormScope,
) {
  if (!hasEnterpriseFormScope(actor, required)) {
    throw new AdminStaffAuthError('enterprise_form_scope_required', 403);
  }
  return actor;
}
