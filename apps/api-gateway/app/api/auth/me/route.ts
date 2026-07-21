import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from '@/src/lib/admin-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function canonicalAuthority(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function isSuperAdminRole(value: unknown) {
  return canonicalAuthority(value) === 'superadmin';
}

function isSuperScope(value: unknown) {
  const scope = String(value || '')
    .trim()
    .toLowerCase();

  return (
    scope === '*' ||
    scope === 'admin:all' ||
    canonicalAuthority(scope) === 'superadmin'
  );
}

async function getAllKnownScopes() {
  const roles = await prisma.role.findMany({
    select: {
      scopes: {
        select: {
          scope: true,
        },
      },
    },
  });

  return Array.from(
    new Set(
      roles
        .flatMap((role) =>
          role.scopes.map((scope) => scope.scope),
        )
        .filter(Boolean),
    ),
  );
}

async function resolveEffectiveRolesAndScopes(
  userId: string,
  email: string,
) {
  const profile =
    await prisma.adminUserProfile.findFirst({
      where: {
        OR: [
          { userId },
          { email },
        ],
      },
      select: {
        id: true,
        userId: true,
        email: true,
        name: true,
        departmentId: true,
        designationId: true,
        designation: {
          select: {
            id: true,
            roles: {
              select: {
                role: {
                  select: {
                    id: true,
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
                id: true,
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

  if (!profile) return null;

  const designationRoles =
    (profile.designation?.roles || [])
      .map((assignment) => assignment.role);
  const directRoles =
    (profile.roles || [])
      .map((assignment) => assignment.role);
  const effectiveRoles = [
    ...designationRoles,
    ...directRoles,
  ];

  const roleNames = Array.from(
    new Set(
      effectiveRoles
        .map((role) => role.name)
        .filter(Boolean),
    ),
  );

  let scopes = Array.from(
    new Set(
      effectiveRoles
        .flatMap((role) =>
          role.scopes.map((scope) => scope.scope),
        )
        .filter(Boolean),
    ),
  );

  const superAdmin =
    roleNames.some(isSuperAdminRole) ||
    scopes.some(isSuperScope);

  if (superAdmin) {
    scopes = Array.from(
      new Set([
        ...(await getAllKnownScopes()),
        ...scopes,
        'admin:all',
        'superadmin',
        '*',
      ]),
    );

    if (!roleNames.some(isSuperAdminRole)) {
      roleNames.push('superadmin');
    }
  }

  return {
    profile,
    roles: roleNames,
    scopes,
    superAdmin,
  };
}

export async function GET() {
  const token =
    cookies().get(ADMIN_SESSION_COOKIE)?.value ||
    null;
  const session =
    verifyAdminSessionToken(token);

  if (!session) {
    return NextResponse.json(
      { authenticated: false },
      {
        status: 200,
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  }

  const authority =
    await resolveEffectiveRolesAndScopes(
      session.sub,
      session.email,
    );

  if (!authority) {
    return NextResponse.json(
      { authenticated: false },
      {
        status: 200,
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  }

  const { profile, roles, scopes, superAdmin } =
    authority;

  return NextResponse.json(
    {
      authenticated: true,
      user: {
        id: profile.userId,
        email: profile.email,
        name: profile.name,
        departmentId: profile.departmentId,
        designationId: profile.designationId,
        roles,
        scopes,
        superAdmin,
      },
    },
    {
      status: 200,
      headers: {
        'cache-control': 'no-store',
      },
    },
  );
}
