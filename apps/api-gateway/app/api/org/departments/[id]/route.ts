// apps/api-gateway/app/api/org/departments/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const item = await prisma.department.update({
    where: { id: params.id },
    data: { name: body.name, active: body.active },
  });
  return NextResponse.json(item);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.department.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
