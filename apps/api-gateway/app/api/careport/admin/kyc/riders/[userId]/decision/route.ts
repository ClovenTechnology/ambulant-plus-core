//apps/api-gateway/app/api/careport/admin/kyc/riders/[userId]/decision/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { orgIdFromHeaders, requireRole } from '@/src/lib/careport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'access-control-allow-origin': '*' },
  });
}

export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  const who = readIdentity(req.headers);

  try {
    requireRole(who, ['admin']);

    const orgId = orgIdFromHeaders(req.headers);
    const userId = clean(params.userId, 160);
    if (!userId) return json({ ok: false, error: 'userId_required' }, 400);

    const body = await req.json().catch(() => ({}));
    const decision = clean(body?.decision || body?.status, 80).toUpperCase();
    const reason = clean(body?.reason || body?.note || '', 1000) || null;

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return json({ ok: false, error: 'decision_must_be_APPROVED_or_REJECTED' }, 400);
    }

    const existing = await (prisma as any).carePortRiderProfile.findFirst({ where: { orgId, userId } });
    if (!existing) return json({ ok: false, error: 'rider_not_found' }, 404);

    const updated = await (prisma as any).carePortRiderProfile.update({
      where: { userId },
      data: {
        kyiStatus: decision === 'APPROVED' ? 'VERIFIED' : 'REJECTED',
        kyiVerifiedAt: decision === 'APPROVED' ? new Date() : null,
        kyiRejectedReason: decision === 'REJECTED' ? reason || 'Rejected by CarePort admin.' : null,
        isActive: decision === 'APPROVED',
      } as any,
    });

    await (prisma as any).auditEvent.create({
      data: {
        kind: decision === 'APPROVED' ? 'careport_rider_kyi_approved' : 'careport_rider_kyi_rejected',
        actorId: who.uid ?? null,
        actorRole: who.role ?? null,
        subjectId: userId,
        meta: { orgId, userId, decision, reason },
      },
    }).catch(() => null);

    return json({ ok: true, rider: updated });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'careport_admin_rider_decision_failed' }, error?.status || 500);
  }
}
