// apps/api-gateway/app/api/rtc/admin/room/end/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  auditBestEffort,
  cors,
  prisma,
  requireRole,
  roomServiceClient,
  rtcErrorStatus,
  verifyJoinTicket,
} from '../../../_lib';

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: cors(req),
  });
}

export async function POST(req: NextRequest) {
  const h = cors(req);

  try {
    const actor = await verifyJoinTicket(req);
    requireRole(actor.role, ['clinician', 'admin']);

    const body = await req.json().catch(() => ({} as any));
    const reason = String(body?.reason || '').trim();

    const svc = await roomServiceClient();

    await svc.deleteRoom(actor.roomId);

    const now = new Date();

    const revoked = await prisma.televisitJoinTicket.updateMany({
      where: {
        visitId: actor.visitId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { revokedAt: now },
    });

    try {
      await prisma.televisit.update({
        where: { id: actor.visitId },
        data: { status: 'ended' as any },
      });
    } catch {
      // Schema-dependent; do not fail the RTC action.
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
        actor: {
          uid: actor.uid,
          role: actor.role,
        },
      },
      {
        status: 200,
        headers: h,
      },
    );
  } catch (e: any) {
    const msg = String(e?.message || 'Unknown error');

    return NextResponse.json(
      {
        ok: false,
        error: 'end_room_failed',
        message: msg,
      },
      {
        status: rtcErrorStatus(msg),
        headers: h,
      },
    );
  }
}