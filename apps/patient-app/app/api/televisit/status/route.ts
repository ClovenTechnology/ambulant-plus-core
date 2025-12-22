// apps/patient-app/app/api/televisit/status/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { TelevisitRole } from '@prisma/client';
import { sha256Hex } from '@/src/lib/televisit/security';

function mustUid(req: Request) {
  const uid = (req.headers.get('x-uid') || '').trim();
  if (!uid) throw new Error('Missing x-uid');
  return uid;
}
function mustRole(req: Request) {
  const r = (req.headers.get('x-role') || 'patient').trim();
  if (!['patient', 'clinician', 'staff', 'observer', 'admin'].includes(r)) throw new Error('Invalid x-role');
  return r as TelevisitRole;
}

export async function GET(req: Request) {
  try {
    const uid = mustUid(req);
    const role = mustRole(req);

    const url = new URL(req.url);
    const visitId = (url.searchParams.get('visitId') || url.searchParams.get('id') || '').trim();
    const roomId = (url.searchParams.get('roomId') || url.searchParams.get('room') || '').trim();

    if (!visitId && !roomId) {
      return NextResponse.json({ ok: false, error: 'visitId or roomId required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const visit =
      (visitId ? await prisma.televisit.findUnique({ where: { id: visitId } }) : null) ||
      (roomId ? await prisma.televisit.findUnique({ where: { roomId } }) : null);

    if (!visit) {
      return NextResponse.json({ ok: false, error: 'Televisit not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    const now = new Date();
    const joinOpen = now >= visit.joinOpensAt && now <= visit.joinClosesAt;

    const consent = await prisma.televisitConsent.findFirst({
      where: { visitId: visit.id, uid, role },
      orderBy: { acceptedAt: 'desc' },
      select: { id: true },
    });

    // If client sends join token, we can validate it.
    const joinToken = (req.headers.get('x-join-token') || '').trim();
    let hasValidTicket = false;
    let ticketExpiresAt: Date | null = null;

    if (joinToken) {
      const tokenHash = sha256Hex(joinToken);
      const t = await prisma.televisitJoinTicket.findUnique({
        where: { tokenHash },
        select: { visitId: true, uid: true, role: true, expiresAt: true, revokedAt: true },
      });
      if (
        t &&
        !t.revokedAt &&
        t.visitId === visit.id &&
        t.uid === uid &&
        t.role === role &&
        new Date(t.expiresAt).getTime() > now.getTime()
      ) {
        hasValidTicket = true;
        ticketExpiresAt = t.expiresAt;
      }
    } else {
      // No token provided: we can only say whether an active ticket exists (not give it back).
      const existing = await prisma.televisitJoinTicket.findFirst({
        where: { visitId: visit.id, uid, role, revokedAt: null, expiresAt: { gt: now } },
        orderBy: { issuedAt: 'desc' },
        select: { expiresAt: true },
      });
      ticketExpiresAt = existing?.expiresAt ?? null;
    }

    return NextResponse.json(
      {
        ok: true,
        now: now.toISOString(),
        visitId: visit.id,
        roomId: visit.roomId,
        window: {
          joinOpensAt: visit.joinOpensAt,
          joinClosesAt: visit.joinClosesAt,
          isOpen: joinOpen,
        },
        consent: { ok: !!consent },
        ticket: {
          provided: !!joinToken,
          valid: hasValidTicket,
          expiresAt: ticketExpiresAt,
        },
        needsConsent: joinOpen && !consent,
        needsTicket: joinOpen && !!consent && !hasValidTicket,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Unknown error' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
