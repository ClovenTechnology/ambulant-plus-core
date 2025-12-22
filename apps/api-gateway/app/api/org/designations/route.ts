// apps/api-gateway/app/api/org/designations/route.ts
// GET list, POST create
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const items = await prisma.designation.findMany({
    orderBy: [{ departmentId: 'asc' }, { name: 'asc' }],
    include: { department: true, roles: { include: { role: true } } },
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const body = await req.json();
  const item = await prisma.designation.create({
    data: { name: body.name, departmentId: body.departmentId },
  });
  return NextResponse.json(item, { status: 201 });
}
