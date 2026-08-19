import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyLegacyAdminSessionToken } from '@/src/lib/admin-session-compat';
import { hasStaffCapability, type StaffCapability } from '@/src/lib/admin-staff-policy';

export class AdminStaffAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function canonicalAuthority(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s&_-]+/g, '');
}

export type AdminStaffActor = {
  profileId: string;
  userId: string;
  email: string;
  name: string | null;
  departmentId: string | null;
  designationId: string | null;
  lifecycleState: 'ACTIVE' | 'LEAVE' | 'SUSPENDED' | 'ARCHIVED';
  roles: string[];
  scopes: string[];
  isSuperAdmin: boolean;
};

export async function requireAdminStaffActor(
  request: NextRequest,
  _options: { requirePassword?: boolean } = {},
): Promise<AdminStaffActor> {
  const token = request.cookies.get('adm.profile')?.value;
  const session = verifyLegacyAdminSessionToken(token);

  if (!session) {
    throw new AdminStaffAuthError('admin_authentication_required', 401);
  }

  if (session.authMethod !== 'password') {
    throw new AdminStaffAuthError('secure_admin_credential_required', 403);
  }

  const profile = await prisma.adminUserProfile.findFirst({
    where: {
      userId: session.sub,
      email: session.email,
    },
    select: {
      id: true,
      userId: true,
      email: true,
      name: true,
      departmentId: true,
      designationId: true,
      lifecycleState: true,
      designation: {
        select: {
          roles: {
            select: {
              role: {
                select: {
                  name: true,
                  scopes: { select: { scope: true } },
                },
              },
            },
          },
        },
      },
      roles: {
        select: {
          role: {
            select: {
              name: true,
              scopes: { select: { scope: true } },
            },
          },
        },
      },
    },
  });

  if (
    !profile ||
    profile.lifecycleState === 'SUSPENDED' ||
    profile.lifecycleState === 'ARCHIVED'
  ) {
    throw new AdminStaffAuthError('admin_profile_not_active', 403);
  }

  const effectiveRoles = [
    ...(profile.designation?.roles ?? []).map((entry) => entry.role),
    ...profile.roles.map((entry) => entry.role),
  ];

  const roles = Array.from(new Set(effectiveRoles.map((role) => role.name).filter(Boolean)));
  const scopes = Array.from(new Set(effectiveRoles.flatMap((role) => role.scopes.map((entry) => entry.scope)).filter(Boolean)));
  const isSuperAdmin =
    roles.some((role) => canonicalAuthority(role) === 'superadmin') ||
    scopes.includes('admin:all') ||
    scopes.includes('*');

  return {
    profileId: profile.id,
    userId: profile.userId,
    email: profile.email,
    name: profile.name,
    departmentId: profile.departmentId,
    designationId: profile.designationId,
    lifecycleState: profile.lifecycleState,
    roles,
    scopes,
    isSuperAdmin,
  };
}

export function requireStaffCapability(
  actor: AdminStaffActor,
  capability: StaffCapability,
) {
  if (!hasStaffCapability(actor, capability)) {
    throw new AdminStaffAuthError('staff_capability_required', 403);
  }
  return actor;
}

export function adminStaffAuthResponse(error: unknown) {
  if (error instanceof AdminStaffAuthError) {
    return { status: error.status, body: { ok: false, error: error.message } };
  }
  return null;
}
