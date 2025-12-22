// apps/patient-app/app/api/televisit/revoke/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { TelevisitRole } from '@prisma/client';

function mustActorUid(req: Request) {
  const uid = (req.headers.get('x-uid') || '').trim();
  if (!uid) throw new Error('Missing x-uid');
  return uid;
}

function mustActorRole(req: Request) {
  const r = (req.headers.get('x-role') || '').trim();
  if (!['patient', 'clinician', 'staff', 'observer', 'admin'].includes(r)) throw new Error('Invalid x-role');
  return r as TelevisitRole;
}

function asRole(v: unknown): TelevisitRole | null {
  const r = typeof v === 'string' ? v.trim() : '';
  if (!r) return null;
  if (!['patient', 'clinician', 'staff', 'observer', 'admin'].includes(r)) return null;
  return r as TelevisitRole;
}

export async function POST(req: Request) {
  try {
    const actorUid = mustActorUid(req);
    const actorRole = mustActorRole(req);

    // Only privileged roles can revoke
    if (!['staff', 'admin', 'clinician'].includes(actorRole)) {
      return NextResponse.json(
        { ok: false, error: 'forbidden', message: 'Only staff/admin/clinician can revoke join tickets' },
        { status: 403 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      visitId?: string;
      roomId?: string;
      uid?: string;
      role?: string;
    };

    const visitId = String(body?.visitId || '').trim();
    const roomId = String(body?.roomId || '').trim();
    const targetUid = String(body?.uid || '').trim();
    const targetRole = asRole(body?.role);

    if (!visitId && !roomId) {
      return NextResponse.json(
        { ok: false, error: 'bad_request', message: 'visitId or roomId required' },
        { status: 400 },
      );
    }

    const visit =
      (visitId ? await prisma.televisit.findUnique({ where: { id: visitId } }) : null) ||
      (roomId ? await prisma.televisit.findUnique({ where: { roomId } }) : null);

    if (!visit) {
      return NextResponse.json({ ok: false, error: 'not_found', message: 'Televisit not found' }, { status: 404 });
    }

    const now = new Date();

    const where: any = {
      visitId: visit.id,
      revokedAt: null,
      expiresAt: { gt: now },
    };

    if (targetUid) where.uid = targetUid;
    if (targetRole) where.role = targetRole;

    const result = await prisma.televisitJoinTicket.updateMany({
      where,
      data: { revokedAt: now },
    });

    // (Optional) You can also add an AuditLog entry here later
    return NextResponse.json({
      ok: true,
      visitId: visit.id,
      roomId: visit.roomId,
      revokedCount: result.count,
      actor: { uid: actorUid, role: actorRole },
      target: { uid: targetUid || null, role: targetRole || null },
      at: now.toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: 'revoke_failed', message: e?.message || 'Unknown error' },
      { status: 400 },
    );
  }
}
