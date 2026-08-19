// apps/api-gateway/app/api/org/designations/[id]/roles/route.ts
// PUT to set the exact role set for a designation
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
  requireStaffCapability,
} from '@/src/lib/admin-staff-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireAdminStaffActor(req, { requirePassword: true });
    requireStaffCapability(actor, 'staff.roles.manage');
    const body = await req.json().catch(() => ({}));
    const roleIds: string[] = Array.isArray(body?.roleIds)
      ? Array.from(new Set<string>(body.roleIds.map((value: unknown) => String(value || '').trim()).filter((value: string) => Boolean(value))))
      : [];

    let ids = roleIds;
    if (!ids.length && Array.isArray(body?.roleNames)) {
      const roleNames: string[] = Array.from(new Set<string>(body.roleNames.map((value: unknown) => String(value || '').trim()).filter((value: string) => Boolean(value))));
      const found = await prisma.role.findMany({ where: { name: { in: roleNames } }, select: { id: true, name: true } });
      if (found.length !== roleNames.length) {
        return NextResponse.json({ ok: false, error: 'role_not_found' }, { status: 400 });
      }
      ids = found.map((item) => item.id);
    }

    if (ids.length) {
      const existing = await prisma.role.findMany({ where: { id: { in: ids } }, select: { id: true } });
      if (existing.length !== ids.length) {
        return NextResponse.json({ ok: false, error: 'role_not_found' }, { status: 400 });
      }
    }

    const designation = await prisma.designation.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!designation) return NextResponse.json({ ok: false, error: 'designation_not_found' }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.designationRole.deleteMany({ where: { designationId: params.id } });
      if (ids.length) {
        await tx.designationRole.createMany({
          data: ids.map((roleId) => ({ designationId: params.id, roleId })),
          skipDuplicates: true,
        });
      }
    });

    const refreshed = await prisma.designation.findUnique({
      where: { id: params.id },
      include: { roles: { include: { role: true } } },
    });

    return NextResponse.json({
      id: refreshed?.id,
      roles: refreshed?.roles.map((row) => ({ id: row.role.id, name: row.role.name })) ?? [],
    });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    console.error('[org designations] role mapping failed', error);
    return NextResponse.json({ ok: false, error: 'designation_role_update_failed' }, { status: 500 });
  }
}
