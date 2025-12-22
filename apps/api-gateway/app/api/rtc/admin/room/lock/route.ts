// apps/api-gateway/app/api/rtc/admin/room/lock/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auditBestEffort, cors, prisma, requireRole, roomServiceClient, verifyJoinTicket } from '../../../_lib';

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) });
}

/**
 * POST /api/rtc/admin/room/lock
 * Headers: x-join-token
 * Body: { reason?: string, eject?: boolean, blockNewJoins?: boolean }
 *
 * - Clinician/Admin only
 * - Sets room metadata "locked"
 * - If eject=true: removes all participants (forces everyone out)
 * - If blockNewJoins=true: revokes all active tickets for the visit (blocks rejoin)
 */
export async function POST(req: NextRequest) {
  const h = cors(req);

  try {
    const actor = await verifyJoinTicket(req);
    requireRole(actor.role, ['clinician', 'admin']);

    const body = await req.json().catch(() => ({} as any));
    const reason = String(body?.reason || '').trim();
    const eject = !!body?.eject;
    const blockNewJoins = body?.blockNewJoins === undefined ? true : !!body?.blockNewJoins;

    const svc = await roomServiceClient();
    const nowISO = new Date().toISOString();

    const metadata = JSON.stringify({
      locked: true,
      lockedAt: nowISO,
      lockedBy: actor.uid,
      reason: reason || undefined,
      eject,
      blockNewJoins,
    });

    // Mark room locked (UX signal)
    try {
      await svc.updateRoomMetadata(actor.roomId, metadata);
    } catch {
      // If server doesn't support metadata update, we still proceed with revoke/eject
    }

    let ejectedCount = 0;

    if (eject) {
      // Remove everyone currently connected
      const lp = await svc.listParticipants(actor.roomId);
      const participants = (lp as any)?.participants || [];

      for (const p of participants) {
        const id = String(p?.identity || '').trim();
        if (!id) continue;
        try {
          await svc.removeParticipant(actor.roomId, id);
          ejectedCount++;
        } catch {
          // ignore individual failures
        }
      }
    }

    let revokedCount = 0;
    if (blockNewJoins) {
      const now = new Date();
      const upd = await prisma.televisitJoinTicket.updateMany({
        where: { visitId: actor.visitId, revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now },
      });
      revokedCount = upd.count || 0;
    }

    await auditBestEffort({
      action: 'rtc.room.lock',
      createdAt: new Date(),
      ok: true,
      actorUid: actor.uid,
      actorRole: actor.role,
      visitId: actor.visitId,
      roomId: actor.roomId,
      reason: reason || null,
      eject,
      ejectedCount,
      blockNewJoins,
      revokedCount,
    });

    return NextResponse.json(
      {
        ok: true,
        locked: true,
        roomId: actor.roomId,
        visitId: actor.visitId,
        eject,
        ejectedCount,
        blockNewJoins,
        revokedCount,
        actor: { uid: actor.uid, role: actor.role },
      },
      { status: 200, headers: h },
    );
  } catch (e: any) {
    const msg = String(e?.message || 'Unknown error');
    const status =
      msg.includes('missing_join_token') || msg.includes('invalid_join') || msg.includes('ticket_') ? 401 :
      msg.includes('forbidden') ? 403 : 400;

    return NextResponse.json({ ok: false, error: 'lock_room_failed', message: msg }, { status, headers: h });
  }
}
