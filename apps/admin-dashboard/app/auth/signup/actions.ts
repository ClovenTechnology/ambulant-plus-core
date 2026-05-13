// apps/admin-dashboard/app/auth/signup/actions.ts
'use server';

import type { RoleName } from '@/lib/org';

export async function completeAdminSignup(input: {
  name: string;
  email: string;
  password: string;
  departmentId: string;
  designationId: string;
  requestedRoleNames?: RoleName[];
}) {
  // The current signup page uses the gateway AuthApi/RoleReqApi client flow.
  // Keep this server action type-safe so legacy imports/builds do not fail.
  // When admin signup is moved fully server-side, wire this to the gateway or Prisma user service.
  const email = String(input.email || '').trim().toLowerCase();
  if (!email) throw new Error('Email required');

  return {
    ok: true,
    userId: email,
    departmentId: input.departmentId,
    designationId: input.designationId,
    requestedRoleNames: input.requestedRoleNames ?? [],
  };
}
