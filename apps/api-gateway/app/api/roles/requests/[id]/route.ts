import {
  NextRequest,
  NextResponse,
} from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  AdminApprovalAuthError,
  canonicalAuthority,
  requirePasswordSuperAdmin,
} from '@/src/lib/admin-approval-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

class RoleDecisionError extends Error {
  status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);
    this.status = status;
  }
}

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

function cleanReason(
  value: unknown,
) {
  const reason =
    String(value || '')
      .trim();

  if (!reason) {
    return null;
  }

  return reason.slice(
    0,
    1000,
  );
}

function handleError(
  error: unknown,
) {
  if (
    error instanceof
    AdminApprovalAuthError ||
    error instanceof
    RoleDecisionError
  ) {
    return apiError(
      error.message,
      error.status,
    );
  }

  console.error(
    '[role request decision] failed',
    error,
  );

  return apiError(
    'role_request_decision_failed',
    500,
  );
}

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: {
      id: string;
    };
  },
) {
  try {
    const actor =
      await requirePasswordSuperAdmin(
        request,
      );

    const body =
      await request
        .json()
        .catch(() => ({}));

    const decision =
      body?.status === 'approved' ||
      body?.status === 'denied'
        ? body.status
        : null;

    if (!decision) {
      return apiError(
        'status_must_be_approved_or_denied',
        400,
      );
    }

    const reason =
      cleanReason(
        body?.reason,
      );

    const result =
      await prisma.$transaction(
        async (tx) => {
          const current =
            await tx.roleRequest.findUnique({
              where: {
                id:
                  params.id,
              },
              include: {
                roles: {
                  include: {
                    role: true,
                  },
                },
              },
            });

          if (!current) {
            throw new RoleDecisionError(
              'role_request_not_found',
              404,
            );
          }

          if (
            current.status !==
            'pending'
          ) {
            throw new RoleDecisionError(
              'role_request_already_decided',
              409,
            );
          }

          const isSelfDecision =
            current.email
              .trim()
              .toLowerCase() ===
              actor.email
                .trim()
                .toLowerCase() ||
            current.userId ===
              actor.profileId ||
            current.userId ===
              actor.userId;

          if (isSelfDecision) {
            throw new RoleDecisionError(
              'self_approval_not_permitted',
              403,
            );
          }

          if (
            decision ===
            'approved'
          ) {
            const requestedRoles =
              await tx.role.findMany({
                where: {
                  id: {
                    in:
                      current.roles.map(
                        (entry) =>
                          entry.roleId,
                      ),
                  },
                },
                select: {
                  name: true,
                  scopes: {
                    select: {
                      scope: true,
                    },
                  },
                },
              });

            const designationRoles =
              current.designationId
                ? await tx.designationRole.findMany({
                    where: {
                      designationId:
                        current.designationId,
                    },
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
                  })
                : [];

            const grantsSuperAdmin =
              (
                role: {
                  name: string;
                  scopes: {
                    scope: string;
                  }[];
                },
              ) =>
                canonicalAuthority(
                  role.name,
                ) ===
                  'superadmin' ||
                role.scopes.some(
                  (scope) =>
                    scope.scope ===
                      'admin:all' ||
                    scope.scope ===
                      '*' ||
                    canonicalAuthority(
                      scope.scope,
                    ) ===
                      'superadmin',
                );

            if (
              requestedRoles.some(
                grantsSuperAdmin,
              )
            ) {
              throw new RoleDecisionError(
                'superadmin_role_requires_separate_assignment',
                403,
              );
            }

            if (
              designationRoles.some(
                (entry) =>
                  grantsSuperAdmin(
                    entry.role,
                  ),
              )
            ) {
              throw new RoleDecisionError(
                'superadmin_designation_requires_separate_assignment',
                403,
              );
            }

            if (
              !requestedRoles.length &&
              !designationRoles.length
            ) {
              throw new RoleDecisionError(
                'role_request_requires_at_least_one_role',
                409,
              );
            }

            let targetProfile:
              | {
                  id: string;
                  userId: string;
                  email: string;
                }
              | null =
              null;

            if (current.userId) {
              targetProfile =
                await tx.adminUserProfile.findFirst({
                  where: {
                    OR: [
                      {
                        id:
                          current.userId,
                      },
                      {
                        userId:
                          current.userId,
                      },
                      {
                        email:
                          current.email,
                      },
                    ],
                  },
                  select: {
                    id: true,
                    userId: true,
                    email: true,
                  },
                });

              if (!targetProfile) {
                throw new RoleDecisionError(
                  'requested_admin_profile_not_found',
                  409,
                );
              }

              await tx.adminUserProfile.update({
                where: {
                  id:
                    targetProfile.id,
                },
                data: {
                  name:
                    current.name ??
                    undefined,
                  departmentId:
                    current.departmentId,
                  designationId:
                    current.designationId,
                },
              });
            }
            else {
              const existingProfile =
                await tx.adminUserProfile.findUnique({
                  where: {
                    email:
                      current.email,
                  },
                  select: {
                    id: true,
                  },
                });

              if (existingProfile) {
                throw new RoleDecisionError(
                  'admin_account_already_active',
                  409,
                );
              }

              const credential =
                await tx.adminAuthCredential.findUnique({
                  where: {
                    email:
                      current.email,
                  },
                  select: {
                    id: true,
                  },
                });

              if (!credential) {
                throw new RoleDecisionError(
                  'pending_application_credential_missing',
                  409,
                );
              }

              targetProfile =
                await tx.adminUserProfile.create({
                  data: {
                    userId:
                      current.email,
                    email:
                      current.email,
                    name:
                      current.name,
                    departmentId:
                      current.departmentId,
                    designationId:
                      current.designationId,
                  },
                  select: {
                    id: true,
                    userId: true,
                    email: true,
                  },
                });
            }

            await tx.userRole.createMany({
              data:
                current.roles.map(
                  (entry) => ({
                    adminUserId:
                      targetProfile!.id,
                    roleId:
                      entry.roleId,
                  }),
                ),
              skipDuplicates:
                true,
            });

            const claimed =
              await tx.roleRequest.updateMany({
                where: {
                  id:
                    current.id,
                  status:
                    'pending',
                },
                data: {
                  userId:
                    targetProfile.id,
                  status:
                    'approved',
                  reason,
                  decidedBy:
                    actor.email,
                  decidedAt:
                    new Date(),
                },
              });

            if (
              claimed.count !==
              1
            ) {
              throw new RoleDecisionError(
                'role_request_decision_conflict',
                409,
              );
            }

            const applicationConversion =
              await tx.applicationStaffConversion.findUnique({
                where: {
                  roleRequestId:
                    current.id,
                },
                select: {
                  id: true,
                  applicationId: true,
                  status: true,
                },
              });

            if (
              applicationConversion &&
              applicationConversion.status ===
                'PENDING_APPROVAL'
            ) {
              const activatedAt =
                new Date();

              await tx.applicationStaffConversion.update({
                where: {
                  id:
                    applicationConversion.id,
                },
                data: {
                  status:
                    'ACTIVE',
                  staffProfileId:
                    targetProfile.id,
                  activatedByProfileId:
                    actor.profileId,
                  activatedAt,
                },
              });

              const application =
                await tx.application.findUnique({
                  where: {
                    id:
                      applicationConversion.applicationId,
                  },
                  select: {
                    id: true,
                    status: true,
                    referenceCode: true,
                  },
                });

              if (
                application &&
                (
                  application.status ===
                    'SUCCESSFUL' ||
                  application.status ===
                    'OFFERED'
                )
              ) {
                const moved =
                  await tx.application.updateMany({
                    where: {
                      id:
                        application.id,
                      status:
                        application.status,
                    },
                    data: {
                      status:
                        'ONBOARDING',
                      statusReason:
                        'Canonical Staff profile activated from successful application',
                      statusChangedAt:
                        activatedAt,
                    },
                  });

                if (
                  moved.count ===
                  1
                ) {
                  await tx.applicationStatusEvent.create({
                    data: {
                      applicationId:
                        application.id,
                      fromStatus:
                        application.status,
                      toStatus:
                        'ONBOARDING',
                      actorType:
                        'ADMIN',
                      actorRefId:
                        actor.profileId,
                      reason:
                        'Canonical Staff profile activated from approved recruitment onboarding',
                      metadata: {
                        roleRequestId:
                          current.id,
                        conversionId:
                          applicationConversion.id,
                        staffProfileId:
                          targetProfile.id,
                      },
                    },
                  });
                }
              }

              await tx.auditLog.create({
                data: {
                  actorUserId:
                    actor.userId,
                  actorType:
                    'ADMIN',
                  actorRefId:
                    actor.profileId,
                  app:
                    'admin-dashboard',
                  action:
                    'application.staff_onboarding.activated',
                  entityType:
                    'ApplicationStaffConversion',
                  entityId:
                    applicationConversion.id,
                  description:
                    'Successful applicant activated as canonical Staff profile',
                  meta: {
                    applicationId:
                      applicationConversion.applicationId,
                    roleRequestId:
                      current.id,
                    staffProfileId:
                      targetProfile.id,
                  },
                },
              });
            }
          }
          else {
            const claimed =
              await tx.roleRequest.updateMany({
                where: {
                  id:
                    current.id,
                  status:
                    'pending',
                },
                data: {
                  status:
                    'denied',
                  reason,
                  decidedBy:
                    actor.email,
                  decidedAt:
                    new Date(),
                },
              });

            if (
              claimed.count !==
              1
            ) {
              throw new RoleDecisionError(
                'role_request_decision_conflict',
                409,
              );
            }

            await tx.applicationStaffConversion.updateMany({
              where: {
                roleRequestId:
                  current.id,
                status:
                  'PENDING_APPROVAL',
              },
              data: {
                status:
                  'REJECTED',
              },
            });
          }

          return tx.roleRequest.findUnique({
            where: {
              id:
                current.id,
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
        {
          isolationLevel:
            'Serializable',
        },
      );

    return NextResponse.json(
      {
        ok: true,
        status:
          result?.status,
        request:
          result,
        requestedRoles:
          result?.roles.map(
            (entry) =>
              entry.role.name,
          ) ?? [],
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
    );
  }
}

export async function DELETE(
  request: NextRequest,
) {
  try {
    await requirePasswordSuperAdmin(
      request,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'role_request_history_is_immutable',
      },
      {
        status: 405,
        headers: {
          allow:
            'PATCH',
          'cache-control':
            'no-store',
        },
      },
    );
  }
  catch (error) {
    return handleError(
      error,
    );
  }
}