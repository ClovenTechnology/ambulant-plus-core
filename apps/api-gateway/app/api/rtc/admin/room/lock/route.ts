// apps/api-gateway/app/api/rtc/admin/room/lock/route.ts
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
    const eject = Boolean(body?.eject);
    const blockNewJoins =
      body?.blockNewJoins === undefined ? true : Boolean(body?.blockNewJoins);

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

    try {
      await svc.updateRoomMetadata(actor.roomId, metadata);
    } catch {
      // Some LiveKit SDK/server versions may not support metadata updates.
    }

    let ejectedCount = 0;

    if (eject) {
      const participantList = await svc.listParticipants(actor.roomId);
      const participants = (participantList as any)?.participants || [];

      for (const participant of participants) {
        const identity = String(participant?.identity || '').trim();

        if (!identity) continue;

        try {
          await svc.removeParticipant(actor.roomId, identity);
          ejectedCount += 1;
        } catch {
          // Ignore individual participant removal failures.
        }
      }
    }

    let revokedCount = 0;

    if (blockNewJoins) {
      const now = new Date();

      const upd = await prisma.televisitJoinTicket.updateMany({
        where: {
          visitId: actor.visitId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
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
        error: 'lock_room_failed',
        message: msg,
      },
      {
        status: rtcErrorStatus(msg),
        headers: h,
      },
    );
  }
}