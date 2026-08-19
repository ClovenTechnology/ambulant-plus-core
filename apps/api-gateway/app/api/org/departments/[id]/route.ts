// apps/api-gateway/app/api/org/departments/[id]/route.ts
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
    requireStaffCapability(actor, 'staff.hr.manage');
    const body = await req.json().catch(() => ({}));
    const data: { name?: string; active?: boolean } = {};
    if (body?.name !== undefined) {
      const name = String(body.name || '').trim().slice(0, 180);
      if (!name) return NextResponse.json({ ok: false, error: 'department_name_required' }, { status: 400 });
      data.name = name;
    }
    if (body?.active !== undefined) data.active = Boolean(body.active);
    if (!Object.keys(data).length) return NextResponse.json({ ok: false, error: 'department_update_required' }, { status: 400 });
    const item = await prisma.department.update({ where: { id: params.id }, data });
    return NextResponse.json(item);
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    console.error('[org departments] update failed', error);
    return NextResponse.json({ ok: false, error: 'department_update_failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireAdminStaffActor(req, { requirePassword: true });
    requireStaffCapability(actor, 'staff.hr.manage');
    await prisma.department.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    console.error('[org departments] delete failed', error);
    return NextResponse.json({ ok: false, error: 'department_delete_failed' }, { status: 500 });
  }
}
