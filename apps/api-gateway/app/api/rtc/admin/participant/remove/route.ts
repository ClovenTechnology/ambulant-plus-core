// apps/api-gateway/app/api/rtc/admin/participant/remove/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auditBestEffort, cors, prisma, requireRole, roomServiceClient, verifyJoinTicket } from '../../../_lib';

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) });
}

/**
 * POST /api/rtc/admin/participant/remove
 * Headers: x-join-token (join ticket JWT), x-uid, x-role (optional; token is source of truth)
 * Body: { targetIdentity: string, reason?: string, blockRejoin?: boolean }
 *
 * - Patient: may only remove OBSERVER (guest) identities
 * - Clinician/Admin: may remove anyone (except optional self, you can enforce in UI)
 */
export async function POST(req: NextRequest) {
  const h = cors(req);

  try {
    const actor = await verifyJoinTicket(req);
    const body = await req.json().catch(() => ({} as any));
    const targetIdentity = String(body?.targetIdentity || body?.identity || '').trim();
    const reason = String(body?.reason || '').trim();
    const blockRejoin = !!body?.blockRejoin;

    if (!targetIdentity) {
      return NextResponse.json({ ok: false, error: 'missing_target', message: 'targetIdentity is required' }, { status: 400, headers: h });
    }

    // Patient policy: can only remove OBSERVER (guest)
    if (actor.role === 'patient') {
      const now = new Date();
      const t = await prisma.televisitJoinTicket.findFirst({
        where: {
          visitId: actor.visitId,
          uid: targetIdentity,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { issuedAt: 'desc' },
        select: { role: true },
      });

      if (!t || t.role !== 'observer') {
        return NextResponse.json(
          {
            ok: false,
            error: 'forbidden_target',
            message: 'Patients may only remove observer/guest participants',
          },
          { status: 403, headers: h },
        );
      }
    } else {
      // Clinician/Admin allowed; staff optional (disable by default)
      requireRole(actor.role, ['clinician', 'admin']);
    }

    const svc = await roomServiceClient();

    // Remove now (best-effort; if not found, treat as ok=false)
    let removed = false;
    let removeErr = '';
    try {
      await svc.removeParticipant(actor.roomId, targetIdentity);
      removed = true;
    } catch (e: any) {
      removeErr = e?.message || 'remove_failed';
    }

    // Optional: block rejoin by revoking active tickets for this identity
    let revokedCount = 0;
    if (blockRejoin) {
      const now = new Date();
      const upd = await prisma.televisitJoinTicket.updateMany({
        where: {
          visitId: actor.visitId,
          uid: targetIdentity,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });
      revokedCount = upd.count || 0;
    }

    await auditBestEffort({
      action: 'rtc.participant.remove',
      createdAt: new Date(),
      ok: removed,
      actorUid: actor.uid,
      actorRole: actor.role,
      visitId: actor.visitId,
      roomId: actor.roomId,
      targetIdentity,
      reason: reason || null,
      blockRejoin,
      error: removed ? null : removeErr || 'remove_failed',
    });

    if (!removed) {
      return NextResponse.json(
        { ok: false, error: 'remove_failed', message: removeErr || 'Could not remove participant', revokedCount },
        { status: 400, headers: h },
      );
    }

    return NextResponse.json(
      { ok: true, removed: true, revokedCount, actor: { uid: actor.uid, role: actor.role }, targetIdentity },
      { status: 200, headers: h },
    );
  } catch (e: any) {
    const msg = String(e?.message || 'Unknown error');
    const status =
      msg.includes('missing_join_token') || msg.includes('invalid_join') || msg.includes('ticket_') ? 401 :
      msg.includes('forbidden') ? 403 : 400;

    return NextResponse.json({ ok: false, error: 'remove_participant_failed', message: msg }, { status, headers: h });
  }
}
