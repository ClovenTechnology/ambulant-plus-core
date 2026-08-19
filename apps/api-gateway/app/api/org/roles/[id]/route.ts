// apps/api-gateway/app/api/org/roles/[id]/route.ts
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
    requireStaffCapability(actor, 'staff.roles.manage');
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || '').trim().slice(0, 180);
    if (!name) return NextResponse.json({ ok: false, error: 'role_name_required' }, { status: 400 });
    const role = await prisma.role.update({ where: { id: params.id }, data: { name } });
    return NextResponse.json(role);
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    console.error('[org roles] update failed', error);
    return NextResponse.json({ ok: false, error: 'role_update_failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireAdminStaffActor(req, { requirePassword: true });
    requireStaffCapability(actor, 'staff.roles.manage');
    await prisma.role.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    console.error('[org roles] delete failed', error);
    return NextResponse.json({ ok: false, error: 'role_delete_failed' }, { status: 500 });
  }
}
