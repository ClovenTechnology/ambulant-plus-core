// apps/api-gateway/app/api/rtc/admin/participant/remove/route.ts
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

    const body = await req.json().catch(() => ({} as any));
    const targetIdentity = String(body?.targetIdentity || body?.identity || '').trim();
    const reason = String(body?.reason || '').trim();
    const blockRejoin = Boolean(body?.blockRejoin);

    if (!targetIdentity) {
      return NextResponse.json(
        {
          ok: false,
          error: 'missing_target',
          message: 'targetIdentity is required',
        },
        {
          status: 400,
          headers: h,
        },
      );
    }

    if (actor.role === 'patient') {
      const now = new Date();

      const ticket = await prisma.televisitJoinTicket.findFirst({
        where: {
          visitId: actor.visitId,
          uid: targetIdentity,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { issuedAt: 'desc' },
        select: { role: true },
      });

      if (!ticket || ticket.role !== 'observer') {
        return NextResponse.json(
          {
            ok: false,
            error: 'forbidden_target',
            message: 'Patients may only remove observer/guest participants',
          },
          {
            status: 403,
            headers: h,
          },
        );
      }
    } else {
      requireRole(actor.role, ['clinician', 'admin']);
    }

    const svc = await roomServiceClient();

    let removed = false;
    let removeErr = '';

    try {
      await svc.removeParticipant(actor.roomId, targetIdentity);
      removed = true;
    } catch (e: any) {
      removeErr = e?.message || 'remove_failed';
    }

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
      revokedCount,
      error: removed ? null : removeErr || 'remove_failed',
    });

    if (!removed) {
      return NextResponse.json(
        {
          ok: false,
          error: 'remove_failed',
          message: removeErr || 'Could not remove participant',
          revokedCount,
        },
        {
          status: 400,
          headers: h,
        },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        removed: true,
        revokedCount,
        actor: {
          uid: actor.uid,
          role: actor.role,
        },
        targetIdentity,
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
        error: 'remove_participant_failed',
        message: msg,
      },
      {
        status: rtcErrorStatus(msg),
        headers: h,
      },
    );
  }
}