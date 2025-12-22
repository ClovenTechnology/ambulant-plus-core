// apps/api-gateway/app/api/org/departments/route.ts
// GET list, POST create
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const items = await prisma.department.findMany({
    orderBy: { name: 'asc' },
    include: { designations: true },
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const body = await req.json();
  const item = await prisma.department.create({
    data: { name: body.name, active: body.active ?? true },
  });
  return NextResponse.json(item, { status: 201 });
}
