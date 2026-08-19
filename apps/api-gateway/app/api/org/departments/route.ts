// apps/api-gateway/app/api/org/departments/route.ts
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
  const items = await prisma.department.findMany({
    orderBy: { name: 'asc' },
    include: { designations: true },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(req, { requirePassword: true });
    requireStaffCapability(actor, 'staff.hr.manage');
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || '').trim().slice(0, 180);
    if (!name) return NextResponse.json({ ok: false, error: 'department_name_required' }, { status: 400 });
    const item = await prisma.department.create({
      data: { name, active: body?.active !== false },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    console.error('[org departments] create failed', error);
    return NextResponse.json({ ok: false, error: 'department_create_failed' }, { status: 500 });
  }
}
