import {
  NextRequest,
  NextResponse,
} from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  AdminApprovalAuthError,
  canonicalAuthority,
  requirePasswordAdmin,
  requirePasswordSuperAdmin,
} from '@/src/lib/admin-approval-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function apiError(
  error: string,
  status: number,
) {
  return NextResponse.json(
    {
      ok: false,
      error,
    },
    {
      status,
      headers: {
        'cache-control':
          'no-store',
      },
    },
  );
}

function handleError(
  error: unknown,
  operation: string,
) {
  if (
    error instanceof
    AdminApprovalAuthError
  ) {
    return apiError(
      error.message,
      error.status,
    );
  }

  console.error(
    `[role requests] ${operation} failed`,
    error,
  );

  return apiError(
    'role_request_operation_failed',
    500,
  );
}

export async function GET(
  request: NextRequest,
) {
  try {
    await requirePasswordSuperAdmin(
      request,
    );

    const requestedStatus =
      new URL(request.url)
        .searchParams
        .get('status');

    const status =
      requestedStatus === 'pending' ||
      requestedStatus === 'approved' ||
      requestedStatus === 'denied'
        ? requestedStatus
        : null;

    if (
      requestedStatus &&
      !status
    ) {
      return apiError(
        'invalid_role_request_status',
        400,
      );
    }

    const items =
      await prisma.roleRequest.findMany({
        where:
          status
            ? {
                status,
              }
            : undefined,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
          department: true,
          designation: true,
        },
      });

    return NextResponse.json(
      {
        ok: true,
        items:
          items.map(
            (item) => ({
              ...item,
              requestedRoles:
                item.roles.map(
                  (entry) =>
                    entry.role.name,
                ),
            }),
          ),
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
    return handleError(
      error,
      'list',
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    const actor =
      await requirePasswordAdmin(
        request,
      );

    const body =
      await request
        .json()
        .catch(() => ({}));

    const requestedRoleNames =
      Array.isArray(
        body?.roleNames,
      )
        ? Array.from(
            new Set(
              body.roleNames
                .map(
                  (value: unknown) =>
                    String(value || '')
                      .trim(),
                )
                .filter(Boolean),
            ),
          )
        : [];

    const requestedRoleIds =
      Array.isArray(
        body?.roleIds,
      )
        ? Array.from(
            new Set(
              body.roleIds
                .map(
                  (value: unknown) =>
                    String(value || '')
                      .trim(),
                )
                .filter(Boolean),
            ),
          )
        : [];

    if (
      !requestedRoleNames.length &&
      !requestedRoleIds.length
    ) {
      return apiError(
        'at_least_one_role_required',
        400,
      );
    }

    const knownRoles =
      await prisma.role.findMany({
        select: {
          id: true,
          name: true,
        },
      });

    const requestedCanonicalNames =
      new Set(
        requestedRoleNames.map(
          canonicalAuthority,
        ),
      );

    const requestedIds =
      new Set(
        requestedRoleIds,
      );

    const selectedRoles =
      knownRoles.filter(
        (role) =>
          requestedIds.has(role.id) ||
          requestedCanonicalNames.has(
            canonicalAuthority(
              role.name,
            ),
          ),
      );

    const unknownNames =
      requestedRoleNames.filter(
        (requestedName) =>
          !knownRoles.some(
            (role) =>
              canonicalAuthority(
                role.name,
              ) ===
              canonicalAuthority(
                requestedName,
              ),
          ),
      );

    const unknownIds =
      requestedRoleIds.filter(
        (requestedId) =>
          !knownRoles.some(
            (role) =>
              role.id ===
              requestedId,
          ),
      );

    if (
      unknownNames.length ||
      unknownIds.length
    ) {
      return apiError(
        'one_or_more_roles_not_found',
        400,
      );
    }

    if (
      selectedRoles.some(
        (role) =>
          canonicalAuthority(
            role.name,
          ) ===
          'superadmin',
      )
    ) {
      return apiError(
        'superadmin_role_requires_separate_assignment',
        403,
      );
    }

    const existingPending =
      await prisma.roleRequest.findFirst({
        where: {
          status: 'pending',
          OR: [
            {
              userId:
                actor.profileId,
            },
            {
              email:
                actor.email,
            },
          ],
        },
        select: {
          id: true,
        },
      });

    if (existingPending) {
      return apiError(
        'role_request_already_pending',
        409,
      );
    }

    const created =
      await prisma.$transaction(
        async (tx) => {
          const roleRequest =
            await tx.roleRequest.create({
              data: {
                userId:
                  actor.profileId,
                email:
                  actor.email,
                name:
                  actor.name,
                departmentId:
                  actor.departmentId,
                designationId:
                  actor.designationId,
                status:
                  'pending',
              },
            });

          await tx.roleRequestRole.createMany({
            data:
              selectedRoles.map(
                (role) => ({
                  roleRequestId:
                    roleRequest.id,
                  roleId:
                    role.id,
                }),
              ),
            skipDuplicates:
              true,
          });

          return tx.roleRequest.findUnique({
            where: {
              id:
                roleRequest.id,
            },
            include: {
              roles: {
                include: {
                  role: true,
                },
              },
              department: true,
              designation: true,
            },
          });
        },
      );

    return NextResponse.json(
      {
        ok: true,
        request:
          created,
        requestedRoles:
          created?.roles.map(
            (entry) =>
              entry.role.name,
          ) ?? [],
      },
      {
        status: 201,
        headers: {
          'cache-control':
            'no-store',
        },
      },
    );
  }
  catch (error) {
    return handleError(
      error,
      'create',
    );
  }
}