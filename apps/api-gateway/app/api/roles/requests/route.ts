//apps/api-gateway/app/api/roles/requests/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status') as 'pending'|'approved'|'denied'|null;
  const where = status ? { status } : {};
  const items = await prisma.roleRequest.findMany({
    where, orderBy: { createdAt: 'desc' },
    include: { roles: { include: { role: true } }, department: true, designation: true },
  });

  return NextResponse.json({
    items: items.map(i => ({
      ...i,
      requestedRoles: i.roles.map(r => r.role.name),
    })),
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  // accepts { email, name?, userId?, departmentId?, designationId?, roleNames?: string[], roleIds?: string[] }
  let roleIds: string[] = Array.isArray(body.roleIds) ? body.roleIds : [];
  if (!roleIds.length && Array.isArray(body.roleNames)) {
    const found = await prisma.role.findMany({ where: { name: { in: body.roleNames } }, select: { id: true }});
    roleIds = found.map(f => f.id);
  }

  const created = await prisma.$transaction(async (tx) => {
    const rr = await tx.roleRequest.create({
      data: {
        email: body.email,
        name: body.name ?? null,
        userId: body.userId ?? null,
        departmentId: body.departmentId ?? null,
        designationId: body.designationId ?? null,
      },
    });

    if (roleIds.length) {
      await tx.roleRequestRole.createMany({
        data: roleIds.map(id => ({ roleRequestId: rr.id, roleId: id })),
        skipDuplicates: true,
      });
    }

    return rr;
  });

  const full = await prisma.roleRequest.findUnique({
    where: { id: created.id },
    include: { roles: { include: { role: true } } },
  });

  return NextResponse.json({
    ...full,
    requestedRoles: full?.roles.map(r => r.role.name) ?? [],
  }, { status: 201 });
}
