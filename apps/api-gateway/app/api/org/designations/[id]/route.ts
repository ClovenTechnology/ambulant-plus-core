// apps/api-gateway/app/api/org/designations/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const item = await prisma.designation.update({
    where: { id: params.id },
    data: { name: body.name, departmentId: body.departmentId },
  });
  return NextResponse.json(item);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.designation.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
