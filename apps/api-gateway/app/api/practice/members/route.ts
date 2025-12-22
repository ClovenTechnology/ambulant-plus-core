// apps/api-gateway/app/api/practice/members/route.ts
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

export async function GET(req: NextRequest) {
  try {
    const uid = req.headers.get('x-uid');
    if (!uid) return jsonError('Missing x-uid header', 401);

    const ctx = await getPracticeForUser(uid);
    if (!ctx) return jsonError('No practice found for this user', 404);

    const members = await prisma.practiceMember.findMany({
      where: { practiceId: ctx.practiceId },
      orderBy: { createdAt: 'asc' },
    });

    const payload = members.map((m) => ({
      id: m.id,
      userId: m.userId,
      fullName: m.fullName,
      email: m.email,
      role: m.role,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
    }));

    return NextResponse.json({ ok: true, members: payload });
  } catch (err: any) {
    console.error('[practice/members] GET error', err);
    return jsonError(err?.message || 'Failed to list members', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const uid = req.headers.get('x-uid');
    if (!uid) return jsonError('Missing x-uid header', 401);

    const ctx = await getPracticeForUser(uid);
    if (!ctx) return jsonError('No practice found for this user', 404);

    // Optional: enforce that only owner/admin can invite
    // if (!['owner', 'admin'].includes(ctx.member.role)) {
    //   return jsonError('Forbidden', 403);
    // }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? '').trim().toLowerCase();
    const fullName = body.name ? String(body.name).trim() : null;
    const role = body.role ? String(body.role) : 'clinician';
    const notes = body.notes ? String(body.notes) : null;

    if (!email) return jsonError('Email is required', 400);

    const existing = await prisma.practiceMember.findFirst({
      where: { practiceId: ctx.practiceId, email },
    });

    if (existing) {
      // idempotent: just return existing
      return NextResponse.json({
        ok: true,
        member: {
          id: existing.id,
          userId: existing.userId,
          fullName: existing.fullName,
          email: existing.email,
          role: existing.role,
          status: existing.status,
          createdAt: existing.createdAt.toISOString(),
        },
      });
    }

    const created = await prisma.practiceMember.create({
      data: {
        practiceId: ctx.practiceId,
        email,
        fullName,
        role,
        status: 'invited',
        // optional: you can add a "notes" Json/String field later
      },
    });

    const payload = {
      id: created.id,
      userId: created.userId,
      fullName: created.fullName,
      email: created.email,
      role: created.role,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
    };

    // TODO: trigger invite email / notification

    return NextResponse.json({ ok: true, member: payload });
  } catch (err: any) {
    console.error('[practice/members] POST error', err);
    return jsonError(err?.message || 'Failed to invite/add member', 500);
  }
}
