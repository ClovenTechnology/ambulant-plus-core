// apps/api-gateway/app/api/practice/members/[memberId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function getPracticeForUser(uid: string) {
  const member = await prisma.practiceMember.findFirst({
    where: { userId: uid },
    include: { practice: true },
  });
  if (!member || !member.practice) return null;
  return { practiceId: member.practiceId, member };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { memberId: string } },
) {
  try {
    const uid = req.headers.get('x-uid');
    if (!uid) return jsonError('Missing x-uid header', 401);

    const ctx = await getPracticeForUser(uid);
    if (!ctx) return jsonError('No practice found for this user', 404);

    const memberId = params.memberId;
    const body = await req.json().catch(() => ({} as any));

    const member = await prisma.practiceMember.findFirst({
      where: { id: memberId, practiceId: ctx.practiceId },
    });

    if (!member) return jsonError('Member not found', 404);

    // Optional: enforce owner/admin roles here

    const data: any = {};
    if (typeof body.fullName === 'string') data.fullName = body.fullName.trim();
    if (typeof body.email === 'string') data.email = body.email.trim().toLowerCase();
    if (typeof body.role === 'string') data.role = body.role;
    if (typeof body.status === 'string') data.status = body.status;

    const updated = await prisma.practiceMember.update({
      where: { id: memberId },
      data,
    });

    const payload = {
      id: updated.id,
      userId: updated.userId,
      fullName: updated.fullName,
      email: updated.email,
      role: updated.role,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
    };

    return NextResponse.json({ ok: true, member: payload });
  } catch (err: any) {
    console.error('[practice/members/:id] PATCH error', err);
    return jsonError(err?.message || 'Failed to update member', 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { memberId: string } },
) {
  try {
    const uid = req.headers.get('x-uid');
    if (!uid) return jsonError('Missing x-uid header', 401);

    const ctx = await getPracticeForUser(uid);
    if (!ctx) return jsonError('No practice found for this user', 404);

    const memberId = params.memberId;

    // Optional: forbid deleting yourself or the last owner, etc.

    const member = await prisma.practiceMember.findFirst({
      where: { id: memberId, practiceId: ctx.practiceId },
    });

    if (!member) return jsonError('Member not found', 404);

    await prisma.practiceMember.delete({ where: { id: memberId } });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[practice/members/:id] DELETE error', err);
    return jsonError(err?.message || 'Failed to remove member', 500);
  }
}
