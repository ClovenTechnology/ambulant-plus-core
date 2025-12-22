//apps/api-gateway/app/api/org/roles/[id]/scopes/route.ts
// PUT to replace scopes; POST to add; DELETE to remove single scope via ?scope=
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json(); // { scopes: string[] }
  const scopes: string[] = Array.isArray(body.scopes) ? body.scopes : [];
  await prisma.roleScope.deleteMany({ where: { roleId: params.id }});
  if (scopes.length) {
    await prisma.roleScope.createMany({
      data: scopes.map(s => ({ roleId: params.id, scope: s })),
      skipDuplicates: true,
    });
  }
  const full = await prisma.role.findUnique({ where: { id: params.id }, include: { scopes: true } });
  return NextResponse.json(full);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json(); // { scopes: string[] }
  const scopes: string[] = Array.isArray(body.scopes) ? body.scopes : [];
  if (scopes.length) {
    await prisma.roleScope.createMany({
      data: scopes.map(s => ({ roleId: params.id, scope: s })),
      skipDuplicates: true,
    });
  }
  const full = await prisma.role.findUnique({ where: { id: params.id }, include: { scopes: true } });
  return NextResponse.json(full);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const scope = url.searchParams.get('scope');
  if (scope) await prisma.roleScope.delete({ where: { roleId_scope: { roleId: params.id, scope } } });
  return NextResponse.json({ ok: true });
}
