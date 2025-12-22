// apps/admin-dashboard/app/auth/signup/actions.ts
'use server';
import { assignUserDesignation, grantUserRoles } from '@/lib/org';

export async function completeAdminSignup(input: {
  name: string; email: string; password: string;
  departmentId: string; designationId: string;
  requestedRoleNames?: RoleName[];
}) {
  const userId = await createUser(input); // your existing logic
  await assignUserDesignation(userId, input.departmentId, input.designationId);

  // auto-grant roles mapped to designation
  const mappedRoles = await db.rolesForDesignation(input.designationId); // RoleName[]
  await grantUserRoles(userId, mappedRoles);

  // optional: store requested extras for HR approval
  if (input.requestedRoleNames?.length) {
    await db.createRoleRequests(userId, input.requestedRoleNames);
  }
  return { userId };
}
