import {
  AdminStaffAuthError,
  type AdminStaffActor,
} from '@/src/lib/admin-staff-auth';

export type OpportunityScope =
  | 'opportunities.read'
  | 'opportunities.manage'
  | 'opportunities.publish';

const IMPLIED_SCOPES: Record<OpportunityScope, OpportunityScope[]> = {
  'opportunities.read': [
    'opportunities.read',
    'opportunities.manage',
    'opportunities.publish',
  ],
  'opportunities.manage': ['opportunities.manage'],
  'opportunities.publish': ['opportunities.publish'],
};

export function hasOpportunityScope(
  actor: AdminStaffActor,
  required: OpportunityScope,
) {
  if (actor.isSuperAdmin) return true;
  return IMPLIED_SCOPES[required].some((scope) => actor.scopes.includes(scope));
}

export function requireOpportunityScope(
  actor: AdminStaffActor,
  required: OpportunityScope,
) {
  if (!hasOpportunityScope(actor, required)) {
    throw new AdminStaffAuthError('opportunity_scope_required', 403);
  }
  return actor;
}
