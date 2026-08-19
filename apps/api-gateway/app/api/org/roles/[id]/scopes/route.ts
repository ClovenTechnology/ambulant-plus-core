// apps/api-gateway/app/api/org/roles/[id]/scopes/route.ts
// PUT to replace scopes; POST to add; DELETE to remove a single scope via ?scope=
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
  requireStaffCapability,
} from '@/src/lib/admin-staff-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanScopes(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)))
    : [];
}

async function authorisedActor(req: NextRequest) {
  const actor = await requireAdminStaffActor(req, { requirePassword: true });
  requireStaffCapability(actor, 'staff.roles.manage');
  return actor;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await authorisedActor(req);
    const body = await req.json().catch(() => ({}));
    const scopes = cleanScopes(body?.scopes);
    const full = await prisma.$transaction(async (tx) => {
      await tx.roleScope.deleteMany({ where: { roleId: params.id } });
      if (scopes.length) {
        await tx.roleScope.createMany({
          data: scopes.map((scope) => ({ roleId: params.id, scope })),
          skipDuplicates: true,
        });
      }
      return tx.role.findUnique({ where: { id: params.id }, include: { scopes: true } });
    });
    return NextResponse.json(full);
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    console.error('[org roles] replace scopes failed', error);
    return NextResponse.json({ ok: false, error: 'role_scope_replace_failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await authorisedActor(req);
    const body = await req.json().catch(() => ({}));
    const scopes = cleanScopes(body?.scopes);
    if (scopes.length) {
      await prisma.roleScope.createMany({
        data: scopes.map((scope) => ({ roleId: params.id, scope })),
        skipDuplicates: true,
      });
    }
    const full = await prisma.role.findUnique({ where: { id: params.id }, include: { scopes: true } });
    return NextResponse.json(full);
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    console.error('[org roles] add scopes failed', error);
    return NextResponse.json({ ok: false, error: 'role_scope_add_failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await authorisedActor(req);
    const url = new URL(req.url);
    const scope = String(url.searchParams.get('scope') || '').trim();
    if (!scope) return NextResponse.json({ ok: false, error: 'role_scope_required' }, { status: 400 });
    await prisma.roleScope.deleteMany({ where: { roleId: params.id, scope } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    console.error('[org roles] remove scope failed', error);
    return NextResponse.json({ ok: false, error: 'role_scope_remove_failed' }, { status: 500 });
  }
}
