import {
  NextResponse,
} from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import {
  verifyLegacyAdminSessionToken,
} from '@/src/lib/admin-session-compat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function canonicalAuthority(
  value: unknown,
) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s&_-]+/g, '');
}

async function getAllKnownScopes() {
  const roles =
    await prisma.role.findMany({
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
          role.scopes.map(
            (scope) =>
              scope.scope,
          ),
        )
        .filter(Boolean),
    ),
  );
}

function unauthenticated() {
  return NextResponse.json(
    {
      authenticated: false,
    },
    {
      status: 200,
      headers: {
        'cache-control':
          'no-store',
      },
    },
  );
}

export async function GET() {
  try {
    const token =
      cookies()
        .get('adm.profile')
        ?.value;

    const session =
      verifyLegacyAdminSessionToken(
        token,
      );

    if (!session || session.authMethod !== 'password') {
      return unauthenticated();
    }

    /*
     * Requiring both fields prevents a signed
     * session from resolving a different profile
     * through a loose OR lookup.
     */
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
          lastActivityAt: true,
          directReports: {
            select: {
              id: true,
            },
          },
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
      return unauthenticated();
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

    const roleNames =
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

    let scopes =
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
      roleNames.some(
        (role) =>
          canonicalAuthority(role) ===
          'superadmin',
      ) ||
      scopes.includes('admin:all') ||
      scopes.includes('*');

    if (isSuperAdmin) {
      const allKnownScopes =
        await getAllKnownScopes();

      scopes =
        Array.from(
          new Set([
            ...allKnownScopes,
            ...scopes,
            'admin:all',
            'superadmin',
            '*',
          ]),
        );

      if (
        !roleNames.some(
          (role) =>
            canonicalAuthority(role) ===
            'superadmin',
        )
      ) {
        roleNames.push(
          'superadmin',
        );
      }
    }

    return NextResponse.json(
      {
        authenticated: true,
        user: {
          id: profile.userId,
          profileId: profile.id,
          email: profile.email,
          name: profile.name,
          departmentId:
            profile.departmentId,
          designationId:
            profile.designationId,
          lifecycleState:
            profile.lifecycleState,
          lastActivityAt:
            profile.lastActivityAt,
          directReportIds:
            profile.directReports.map(
              (entry) =>
                entry.id,
            ),
          roles: roleNames,
          scopes,
        },
      },
      {
        status: 200,
        headers: {
          'cache-control':
            'no-store',
        },
      },
    );
  }
  catch (error) {
    console.error(
      '[admin auth me] request failed',
      error,
    );

    return NextResponse.json(
      {
        authenticated: false,
        error:
          'admin_session_validation_failed',
      },
      {
        status: 500,
        headers: {
          'cache-control':
            'no-store',
        },
      },
    );
  }
}