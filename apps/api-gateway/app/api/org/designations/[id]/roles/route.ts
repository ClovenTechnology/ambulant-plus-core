// apps/api-gateway/app/api/org/designations/[id]/roles/route.ts
// PUT to set the exact role set for a designation
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json(); // { roleIds: string[] } OR { roleNames: string[] }
  const roleIds: string[] = Array.isArray(body.roleIds) ? body.roleIds : [];

  let ids = roleIds;
  if (!ids.length && Array.isArray(body.roleNames)) {
    const found = await prisma.role.findMany({ where: { name: { in: body.roleNames } }, select: { id: true }});
    ids = found.map(f => f.id);
  }

  // reset mapping
  await prisma.designationRole.deleteMany({ where: { designationId: params.id }});
  if (ids.length) {
    await prisma.designationRole.createMany({
      data: ids.map(id => ({ designationId: params.id, roleId: id })),
      skipDuplicates: true,
    });
  }

  const refreshed = await prisma.designation.findUnique({
    where: { id: params.id },
    include: { roles: { include: { role: true } } },
  });

  return NextResponse.json({
    id: refreshed?.id,
    roles: refreshed?.roles.map(r => ({ id: r.role.id, name: r.role.name })) ?? [],
  });
}
