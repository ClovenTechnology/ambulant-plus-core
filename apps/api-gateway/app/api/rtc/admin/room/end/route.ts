// apps/api-gateway/app/api/rtc/admin/room/end/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auditBestEffort, cors, prisma, requireRole, roomServiceClient, verifyJoinTicket } from '../../../_lib';

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) });
}

/**
 * POST /api/rtc/admin/room/end
 * Headers: x-join-token
 * Body: { reason?: string }
 *
 * - Clinician/Admin only
 * - Deletes the room (forces everyone out)
 * - Revokes all active join tickets for visit (blocks rejoin)
 * - Best-effort: mark Televisit status ended (if field exists)
 */
export async function POST(req: NextRequest) {
  const h = cors(req);

  try {
    const actor = await verifyJoinTicket(req);
    requireRole(actor.role, ['clinician', 'admin']);

    const body = await req.json().catch(() => ({} as any));
    const reason = String(body?.reason || '').trim();

    const svc = await roomServiceClient();

    // Force end for everyone
    await svc.deleteRoom(actor.roomId);

    // Block rejoin: revoke all active tickets for this visit
    const now = new Date();
    const revoked = await prisma.televisitJoinTicket.updateMany({
      where: { visitId: actor.visitId, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    });

    // Best-effort: mark Televisit ended (schema-dependent)
    try {
      await prisma.televisit.update({
        where: { id: actor.visitId },
        data: { status: 'ended' as any },
      });
    } catch {
      // ignore if schema differs
    }

    await auditBestEffort({
      action: 'rtc.room.end',
      createdAt: new Date(),
      ok: true,
      actorUid: actor.uid,
      actorRole: actor.role,
      visitId: actor.visitId,
      roomId: actor.roomId,
      reason: reason || null,
      revokedCount: revoked.count || 0,
    });

    return NextResponse.json(
      {
        ok: true,
        ended: true,
        roomId: actor.roomId,
        visitId: actor.visitId,
        revokedCount: revoked.count || 0,
        actor: { uid: actor.uid, role: actor.role },
      },
      { status: 200, headers: h },
    );
  } catch (e: any) {
    const msg = String(e?.message || 'Unknown error');
    const status =
      msg.includes('missing_join_token') || msg.includes('invalid_join') || msg.includes('ticket_') ? 401 :
      msg.includes('forbidden') ? 403 : 400;

    return NextResponse.json({ ok: false, error: 'end_room_failed', message: msg }, { status, headers: h });
  }
}
