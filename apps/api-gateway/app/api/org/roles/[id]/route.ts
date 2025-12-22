//apps/api-gateway/app/api/org/roles/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json(); // { name? }
  const role = await prisma.role.update({ where: { id: params.id }, data: { name: body.name } });
  return NextResponse.json(role);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.role.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
