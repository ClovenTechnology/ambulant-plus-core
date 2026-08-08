import {
  NextRequest,
} from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  verifyLegacyAdminSessionToken,
} from '@/src/lib/admin-session-compat';

export class AdminApprovalAuthError extends Error {
  status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);
    this.status = status;
  }
}

export function canonicalAuthority(
  value: unknown,
) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s&_-]+/g, '');
}

export type AdminApprovalActor = {
  profileId: string;
  userId: string;
  email: string;
  name: string | null;
  departmentId: string | null;
  designationId: string | null;
  roles: string[];
  scopes: string[];
  isSuperAdmin: boolean;
};

export async function requirePasswordAdmin(
  request: NextRequest,
): Promise<AdminApprovalActor> {
  const token =
    request.cookies
      .get('adm.profile')
      ?.value;

  const session =
    verifyLegacyAdminSessionToken(
      token,
    );

  if (!session) {
    throw new AdminApprovalAuthError(
      'admin_authentication_required',
      401,
    );
  }

  if (
    session.authMethod !==
    'password'
  ) {
    throw new AdminApprovalAuthError(
      'secure_admin_credential_required',
      403,
    );
  }

  const profile =
    await prisma.adminUserProfile.findFirst({
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
                    scopes: {
                      select: {
                        scope: true,
                      },
                    },
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
                scopes: {
                  select: {
                    scope: true,
                  },
                },
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
    throw new AdminApprovalAuthError(
      'admin_profile_not_active',
      403,
    );
  }

  const designationRoles =
    (
      profile.designation
        ?.roles ?? []
    ).map(
      (entry) =>
        entry.role,
    );

  const directRoles =
    profile.roles.map(
      (entry) =>
        entry.role,
    );

  const effectiveRoles = [
    ...designationRoles,
    ...directRoles,
  ];

  const roles =
    Array.from(
      new Set(
        effectiveRoles
          .map(
            (role) =>
              role.name,
          )
          .filter(Boolean),
      ),
    );

  const scopes =
    Array.from(
      new Set(
        effectiveRoles
          .flatMap(
            (role) =>
              role.scopes.map(
                (scope) =>
                  scope.scope,
              ),
          )
          .filter(Boolean),
      ),
    );

  const isSuperAdmin =
    roles.some(
      (role) =>
        canonicalAuthority(role) ===
        'superadmin',
    ) ||
    scopes.includes('admin:all') ||
    scopes.includes('*');

  return {
    profileId:
      profile.id,
    userId:
      profile.userId,
    email:
      profile.email,
    name:
      profile.name,
    departmentId:
      profile.departmentId,
    designationId:
      profile.designationId,
    roles,
    scopes,
    isSuperAdmin,
  };
}

export async function requirePasswordSuperAdmin(
  request: NextRequest,
) {
  const actor =
    await requirePasswordAdmin(
      request,
    );

  if (!actor.isSuperAdmin) {
    throw new AdminApprovalAuthError(
      'super_admin_required',
      403,
    );
  }

  return actor;
}