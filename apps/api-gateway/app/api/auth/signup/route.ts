// apps/api-gateway/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/src/lib/admin-auth';
import { prisma } from '@/lib/prisma';

/**
 * Unified signup:
 * - kind: 'admin' | 'patient' default: patient
 * - Admin: creates AdminUserProfile and sets adm.profile cookie for dashboard
 * - Patient: legacy patientProfile upsert kept for compatibility
 */

function cleanEmail(value: unknown): string | null {
  const s = String(value ?? '').trim().toLowerCase();
  return s.includes('@') ? s : null;
}

function cleanStr(value: unknown): string | null {
  const s = String(value ?? '').trim();
  return s ? s : null;
}

async function resolveAdminOrgRefs(body: any): Promise<{
  departmentId: string | null;
  designationId: string | null;
  warnings: string[];
}> {
  const requestedDepartmentId = cleanStr(body?.departmentId);
  const requestedDesignationId = cleanStr(body?.designationId);
  const warnings: string[] = [];

  let departmentId: string | null = null;
  let designationId: string | null = null;

  if (requestedDepartmentId) {
    const department = await prisma.department.findUnique({
      where: { id: requestedDepartmentId },
      select: { id: true },
    });

    if (department?.id) {
      departmentId = department.id;
    } else {
      warnings.push('department_not_found_or_not_seeded');
    }
  }

  if (requestedDesignationId) {
    const designation = await prisma.designation.findFirst({
      where: {
        id: requestedDesignationId,
        ...(departmentId ? { departmentId } : {}),
      },
      select: {
        id: true,
        departmentId: true,
      },
    });

    if (designation?.id) {
      designationId = designation.id;
      if (!departmentId && designation.departmentId) {
        departmentId = designation.departmentId;
      }
    } else {
      warnings.push('designation_not_found_or_not_seeded');
    }
  }

  return { departmentId, designationId, warnings };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const kind = (body?.kind ?? 'patient') as 'admin' | 'patient';

    if (kind === 'admin') {
      if (
        process.env.NODE_ENV === 'production' &&
        !(await verifyAdminRequest(req))
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: 'admin_signup_forbidden',
          },
          { status: 403 },
        );
      }

      const email = cleanEmail(body?.email);
      const name = cleanStr(body?.name);

      if (!email) {
        return NextResponse.json({ error: 'email required' }, { status: 400 });
      }

      const userId = email;
      const orgRefs = await resolveAdminOrgRefs(body);

      const updateData: any = {
        name: name ?? undefined,
      };

      /*
       * Only overwrite org refs when the client supplied org refs.
       * If submitted refs are stale/unseeded, write null instead of throwing
       * AdminUserProfile_departmentId_fkey / designation FK errors.
       */
      if (cleanStr(body?.departmentId) || cleanStr(body?.designationId)) {
        updateData.departmentId = orgRefs.departmentId;
        updateData.designationId = orgRefs.designationId;
      }

      const admin = await prisma.adminUserProfile.upsert({
        where: { email: userId },
        update: updateData,
        create: {
          userId,
          email: userId,
          name: name ?? null,
          departmentId: orgRefs.departmentId,
          designationId: orgRefs.designationId,
        },
      });

      return NextResponse.json(
        {
          ok: true,
          warnings: orgRefs.warnings,
          admin: {
            id: admin.id,
            userId: admin.userId,
            email: admin.email,
            name: admin.name,
            departmentId: admin.departmentId,
            departmentName: null,
            designationId: admin.designationId,
            designationName: null,
          },
        },
        { status: 201 },
      );
    }

    // ---- patient legacy/compat signup ----
    const email = cleanEmail(body?.email);
    const name = cleanStr(body?.name);
    const phone = cleanStr(body?.phone);

    if (!email) {
      return NextResponse.json({ error: 'email required' }, { status: 400 });
    }

    const userId = email;

    const profile = await prisma.patientProfile.upsert({
      where: { userId },
      update: {
        name: name ?? undefined,
        contactEmail: email,
        phone: phone ?? undefined,
        updatedAt: new Date(),
      },
      create: {
        userId,
        name: name ?? undefined,
        contactEmail: email,
        phone: phone ?? undefined,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        profile,
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('auth signup error', err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'signup_failed',
      },
      { status: 500 },
    );
  }
}
