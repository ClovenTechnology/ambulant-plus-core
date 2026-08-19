// apps/api-gateway/app/api/org/designations/route.ts
// GET list, POST create
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
  requireStaffCapability,
} from '@/src/lib/admin-staff-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const items = await prisma.designation.findMany({
    orderBy: [{ departmentId: 'asc' }, { name: 'asc' }],
    include: { department: true, roles: { include: { role: true } } },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(req, { requirePassword: true });
    requireStaffCapability(actor, 'staff.hr.manage');
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || '').trim().slice(0, 180);
    const departmentId = String(body?.departmentId || '').trim().slice(0, 160);
    if (!name) return NextResponse.json({ ok: false, error: 'designation_name_required' }, { status: 400 });
    if (!departmentId) return NextResponse.json({ ok: false, error: 'designation_department_required' }, { status: 400 });
    const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true, active: true } });
    if (!department) return NextResponse.json({ ok: false, error: 'department_not_found' }, { status: 400 });
    const item = await prisma.designation.create({ data: { name, departmentId } });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    console.error('[org designations] create failed', error);
    return NextResponse.json({ ok: false, error: 'designation_create_failed' }, { status: 500 });
  }
}
