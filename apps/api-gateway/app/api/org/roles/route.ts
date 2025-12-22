//apps/api-gateway/app/api/org/roles/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const items = await prisma.role.findMany({
    orderBy: { name: 'asc' },
    include: { scopes: true },
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const body = await req.json(); // { name, scopes?: string[] }
  const role = await prisma.role.create({ data: { name: body.name } });

  if (Array.isArray(body.scopes) && body.scopes.length) {
    await prisma.roleScope.createMany({
      data: body.scopes.map((s: string) => ({ roleId: role.id, scope: s })),
      skipDuplicates: true,
    });
  }

  const full = await prisma.role.findUnique({ where: { id: role.id }, include: { scopes: true } });
  return NextResponse.json(full, { status: 201 });
}
