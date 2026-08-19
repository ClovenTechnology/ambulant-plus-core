// apps/api-gateway/app/api/org/roles/route.ts
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
  const items = await prisma.role.findMany({
    orderBy: { name: 'asc' },
    include: { scopes: true },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(req, { requirePassword: true });
    requireStaffCapability(actor, 'staff.roles.manage');
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || '').trim().slice(0, 180);
    if (!name) return NextResponse.json({ ok: false, error: 'role_name_required' }, { status: 400 });
    const scopes: string[] = Array.isArray(body?.scopes)
      ? Array.from(new Set<string>(body.scopes.map((value: unknown) => String(value || '').trim()).filter((value: string) => Boolean(value))))
      : [];

    const full = await prisma.$transaction(async (tx) => {
      const role = await tx.role.create({ data: { name } });
      if (scopes.length) {
        await tx.roleScope.createMany({
          data: scopes.map((scope) => ({ roleId: role.id, scope })),
          skipDuplicates: true,
        });
      }
      return tx.role.findUnique({ where: { id: role.id }, include: { scopes: true } });
    });
    return NextResponse.json(full, { status: 201 });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    console.error('[org roles] create failed', error);
    return NextResponse.json({ ok: false, error: 'role_create_failed' }, { status: 500 });
  }
}
