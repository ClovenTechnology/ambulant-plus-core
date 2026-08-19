// apps/api-gateway/app/api/org/designations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
  requireStaffCapability,
} from '@/src/lib/admin-staff-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireAdminStaffActor(req, { requirePassword: true });
    requireStaffCapability(actor, 'staff.manage');
    const body = await req.json().catch(() => ({}));
    const data: { name?: string; departmentId?: string } = {};
    if (body?.name !== undefined) {
      const name = String(body.name || '').trim().slice(0, 180);
      if (!name) return NextResponse.json({ ok: false, error: 'designation_name_required' }, { status: 400 });
      data.name = name;
    }
    if (body?.departmentId !== undefined) {
      const departmentId = String(body.departmentId || '').trim().slice(0, 160);
      if (!departmentId) return NextResponse.json({ ok: false, error: 'designation_department_required' }, { status: 400 });
      const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } });
      if (!department) return NextResponse.json({ ok: false, error: 'department_not_found' }, { status: 400 });
      data.departmentId = departmentId;
    }
    if (!Object.keys(data).length) return NextResponse.json({ ok: false, error: 'designation_update_required' }, { status: 400 });
    const item = await prisma.designation.update({ where: { id: params.id }, data });
    return NextResponse.json(item);
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    console.error('[org designations] update failed', error);
    return NextResponse.json({ ok: false, error: 'designation_update_failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireAdminStaffActor(req, { requirePassword: true });
    requireStaffCapability(actor, 'staff.manage');
    await prisma.designation.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    console.error('[org designations] delete failed', error);
    return NextResponse.json({ ok: false, error: 'designation_delete_failed' }, { status: 500 });
  }
}
