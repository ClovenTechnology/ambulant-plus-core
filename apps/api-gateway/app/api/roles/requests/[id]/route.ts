//apps/api-gateway/app/api/roles/requests/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json(); // { status: 'approved'|'denied', decidedBy?: string, reason?: string }
  if (!['approved','denied'].includes(body.status)) {
    return NextResponse.json({ error: 'status must be approved|denied' }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.roleRequest.update({
      where: { id: params.id },
      data: {
        status: body.status,
        decidedBy: body.decidedBy ?? null,
        reason: body.reason ?? null,
        decidedAt: new Date(),
      },
      include: { roles: true },
    });

    if (body.status === 'approved' && current.userId && current.roles.length) {
      // Grant roles to user
      await tx.userRole.createMany({
        data: current.roles.map(r => ({ userId: current.userId!, roleId: r.roleId })),
        skipDuplicates: true,
      });
    }
    return current;
  });

  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.roleRequest.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
