import {
  NextRequest,
  NextResponse,
} from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  hashAdminPassword,
  validateAdminPassword,
} from '@/src/lib/admin-password';

class AdminSignupError extends Error {
  status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);
    this.status = status;
  }
}

function cleanEmail(
  value: unknown,
) {
  const email =
    String(value || '')
      .trim()
      .toLowerCase();

  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email,
    )
      ? email
      : null
  );
}

function cleanText(
  value: unknown,
) {
  const text =
    String(value || '').trim();

  return text || null;
}

function canonicalRole(
  value: unknown,
) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s&_-]+/g, '');
}

function requestedRoleNames(
  value: unknown,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) =>
          String(item || '').trim(),
        )
        .filter(Boolean),
    ),
  );
}

async function resolveOrgReferences(
  body: Record<string, unknown>,
) {
  const warnings: string[] = [];

  const requestedDepartmentId =
    cleanText(body.departmentId);

  const requestedDesignationId =
    cleanText(body.designationId);

  let departmentId: string | null =
    null;

  let designationId: string | null =
    null;

  if (requestedDepartmentId) {
    const department =
      await prisma.department.findUnique({
        where: {
          id: requestedDepartmentId,
        },
        select: {
          id: true,
        },
      });

    if (!department) {
      warnings.push(
        'department_not_found',
      );
    }
    else {
      departmentId =
        department.id;
    }
  }

  if (requestedDesignationId) {
    const designation =
      await prisma.designation.findUnique({
        where: {
          id: requestedDesignationId,
        },
        select: {
          id: true,
          departmentId: true,
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

    if (!designation) {
      warnings.push(
        'designation_not_found',
      );
    }
    else if (
      departmentId &&
      designation.departmentId !==
        departmentId
    ) {
      warnings.push(
        'designation_department_mismatch',
      );
    }
    else if (
      designation.roles.some(
        (entry) =>
          canonicalRole(
            entry.role.name,
          ) ===
            'superadmin' ||
          entry.role.scopes.some(
            (scope) =>
              scope.scope ===
                'admin:all' ||
              scope.scope ===
                '*' ||
              canonicalRole(
                scope.scope,
              ) ===
                'superadmin',
          ),
      )
    ) {
      throw new AdminSignupError(
        'superadmin_designation_requires_separate_assignment',
        403,
      );
    }
    else {
      designationId =
        designation.id;

      departmentId =
        departmentId ||
        designation.departmentId;
    }
  }

  return {
    departmentId,
    designationId,
    warnings,
  };
}

async function createAdminApplication(
  body: Record<string, unknown>,
) {
  const email =
    cleanEmail(body.email);

  const name =
    cleanText(body.name);

  const password =
    typeof body.password === 'string'
      ? body.password
      : '';

  if (!email) {
    throw new AdminSignupError(
      'valid_email_required',
      400,
    );
  }

  if (!name) {
    throw new AdminSignupError(
      'name_required',
      400,
    );
  }

  const passwordValidation =
    validateAdminPassword(password);

  if (!passwordValidation.ok) {
    throw new AdminSignupError(
      passwordValidation.error,
      400,
    );
  }

  const org =
    await resolveOrgReferences(body);

  if (
    cleanText(body.departmentId) &&
    !org.departmentId
  ) {
    throw new AdminSignupError(
      'invalid_department',
      400,
    );
  }

  if (
    cleanText(body.designationId) &&
    !org.designationId
  ) {
    throw new AdminSignupError(
      'invalid_designation',
      400,
    );
  }

  const suppliedRoles =
    requestedRoleNames(
      body.roleNames,
    );

  const allowedRoles =
    suppliedRoles.filter(
      (role) =>
        canonicalRole(role) !==
        'superadmin',
    );

  if (
    allowedRoles.length !==
    suppliedRoles.length
  ) {
    org.warnings.push(
      'superadmin_role_requires_separate_assignment',
    );
  }

  const knownRoles =
    await prisma.role.findMany({
      select: {
        id: true,
        name: true,
        scopes: {
          select: {
            scope: true,
          },
        },
      },
    });

  const rolesByName =
    new Map(
      knownRoles.map((role) => [
        canonicalRole(role.name),
        role,
      ]),
    );

  const roleIds =
    Array.from(
      new Set(
        allowedRoles
          .map(
            (role) => {
              const knownRole =
                rolesByName.get(
                  canonicalRole(role),
                );

              if (!knownRole) {
                return null;
              }

              const grantsSuperAdmin =
                canonicalRole(
                  knownRole.name,
                ) ===
                  'superadmin' ||
                knownRole.scopes.some(
                  (scope) =>
                    scope.scope ===
                      'admin:all' ||
                    scope.scope ===
                      '*' ||
                    canonicalRole(
                      scope.scope,
                    ) ===
                      'superadmin',
                );

              if (grantsSuperAdmin) {
                org.warnings.push(
                  'superadmin_role_requires_separate_assignment',
                );

                return null;
              }

              return knownRole.id;
            },
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(value),
          ),
      ),
    );

  for (const role of allowedRoles) {
    if (
      !rolesByName.has(
        canonicalRole(role),
      )
    ) {
      org.warnings.push(
        `role_not_found:${role}`,
      );
    }
  }

  const passwordHash =
    hashAdminPassword(password);

  return prisma.$transaction(
    async (tx) => {
      const [
        existingProfile,
        existingCredential,
        latestRequest,
      ] =
        await Promise.all([
          tx.adminUserProfile.findUnique({
            where: {
              email,
            },
            select: {
              id: true,
            },
          }),
          tx.adminAuthCredential.findUnique({
            where: {
              email,
            },
            select: {
              id: true,
            },
          }),
          tx.roleRequest.findFirst({
            where: {
              email,
            },
            orderBy: {
              createdAt: 'desc',
            },
            select: {
              id: true,
              status: true,
            },
          }),
        ]);

      if (existingProfile) {
        throw new AdminSignupError(
          'account_exists',
          409,
        );
      }

      if (
        latestRequest?.status ===
        'pending'
      ) {
        throw new AdminSignupError(
          'admin_approval_pending',
          409,
        );
      }

      if (
        latestRequest?.status ===
        'denied'
      ) {
        throw new AdminSignupError(
          'admin_application_denied',
          403,
        );
      }

      if (
        existingCredential ||
        latestRequest
      ) {
        throw new AdminSignupError(
          'admin_application_requires_review',
          409,
        );
      }

      await tx.adminAuthCredential.create({
        data: {
          email,
          passwordHash,
          mustResetPassword: false,
        },
      });

      const request =
        await tx.roleRequest.create({
          data: {
            email,
            name,
            userId: null,
            departmentId:
              org.departmentId,
            designationId:
              org.designationId,
            status: 'pending',
          },
        });

      if (roleIds.length) {
        await tx.roleRequestRole.createMany({
          data: roleIds.map(
            (roleId) => ({
              roleRequestId:
                request.id,
              roleId,
            }),
          ),
          skipDuplicates: true,
        });
      }

      return {
        request,
        warnings:
          Array.from(
            new Set(
              org.warnings,
            ),
          ),
      };
    },
  );
}

export async function POST(
  request: NextRequest,
) {
  try {
    const body =
      await request
        .json()
        .catch(() => ({}));

    const kind =
      body?.kind === 'admin'
        ? 'admin'
        : 'patient';

    if (kind === 'admin') {
      const application =
        await createAdminApplication(
          body,
        );

      return NextResponse.json(
        {
          ok: true,
          status:
            'admin_approval_pending',
          requestId:
            application.request.id,
          warnings:
            application.warnings,
          message:
            'Your application has been submitted for Super Admin approval.',
        },
        {
          status: 202,
          headers: {
            'cache-control':
              'no-store',
          },
        },
      );
    }

    const email =
      cleanEmail(body?.email);

    const name =
      cleanText(body?.name);

    const phone =
      cleanText(body?.phone);

    if (!email) {
      return NextResponse.json(
        {
          error:
            'valid_email_required',
        },
        {
          status: 400,
        },
      );
    }

    const profile =
      await prisma.patientProfile.upsert({
        where: {
          userId: email,
        },
        update: {
          name:
            name ?? undefined,
          contactEmail: email,
          phone:
            phone ?? undefined,
          updatedAt:
            new Date(),
        },
        create: {
          userId: email,
          name:
            name ?? undefined,
          contactEmail: email,
          phone:
            phone ?? undefined,
        },
      });

    return NextResponse.json(
      {
        ok: true,
        profile,
      },
      {
        status: 201,
      },
    );
  }
  catch (error) {
    if (
      error instanceof
      AdminSignupError
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            error.message,
        },
        {
          status:
            error.status,
          headers: {
            'cache-control':
              'no-store',
          },
        },
      );
    }

    console.error(
      '[admin signup] application failed',
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'admin_application_failed',
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