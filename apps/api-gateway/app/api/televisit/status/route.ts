// apps/api-gateway/app/api/televisit/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanStr(value: unknown): string {
  return String(value ?? '').trim();
}

function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'access-control-allow-origin': '*',
    },
  });
}

function getVisitId(req: NextRequest): string {
  const url = new URL(req.url);

  return (
    cleanStr(url.searchParams.get('visitId')) ||
    cleanStr(url.searchParams.get('televisitId')) ||
    cleanStr(url.searchParams.get('id'))
  );
}

function getJoinToken(req: NextRequest): string {
  const url = new URL(req.url);

  const auth = cleanStr(req.headers.get('authorization'));
  const bearer = auth.toLowerCase().startsWith('bearer ')
    ? auth.slice('bearer '.length).trim()
    : '';

  return (
    cleanStr(req.headers.get('x-join-token')) ||
    bearer ||
    cleanStr(url.searchParams.get('token')) ||
    cleanStr(url.searchParams.get('joinToken'))
  );
}

async function findTicketByToken(token: string) {
  if (!token) return null;

  const delegate = (prisma as any).televisitJoinTicket;

  if (!delegate?.findUnique) return null;

  return delegate.findUnique({
    where: {
      tokenHash: sha256Hex(token),
    },
    select: {
      id: true,
      visitId: true,
      uid: true,
      role: true,
      orgId: true,
      expiresAt: true,
      revokedAt: true,
      lastUsedAt: true,
      issuedAt: true,
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-allow-headers': 'authorization,x-join-token,content-type,x-uid,x-role,x-org-id',
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const visitId = getVisitId(req);
    const joinToken = getJoinToken(req);

    let resolvedVisitId = visitId;
    let ticket: any = null;

    if (joinToken) {
      ticket = await findTicketByToken(joinToken);

      if (ticket?.visitId && !resolvedVisitId) {
        resolvedVisitId = String(ticket.visitId);
      }
    }

    if (!resolvedVisitId) {
      return json({ ok: false, message: 'visitId or join token required' }, 400);
    }

    const v = await prisma.televisit.findUnique({
      where: { id: resolvedVisitId },
    });

    if (!v) {
      return json({ ok: false, message: 'Visit not found' }, 404);
    }

    const now = Date.now();
    const openAt = new Date(v.joinOpensAt).getTime();
    const closeAt = new Date(v.joinClosesAt).getTime();

    const joinWindowOpen = now >= openAt && now <= closeAt;
    const beforeJoinWindow = now < openAt;
    const afterJoinWindow = now > closeAt;

    const ticketStatus = ticket
      ? {
          id: ticket.id,
          uid: ticket.uid,
          role: ticket.role,
          orgId: ticket.orgId,
          revoked: Boolean(ticket.revokedAt),
          expired: new Date(ticket.expiresAt).getTime() <= now,
          expiresAt: ticket.expiresAt,
          lastUsedAt: ticket.lastUsedAt ?? null,
          issuedAt: ticket.issuedAt ?? null,
        }
      : null;

    return json({
      ok: true,
      visit: {
        id: v.id,
        status: v.status,
        orgId: v.orgId,
        roomId: v.roomId,
        appointmentId: v.appointmentId,
        encounterId: v.encounterId,
        scheduledStartAt: v.scheduledStartAt,
        scheduledEndAt: v.scheduledEndAt,
        joinOpensAt: v.joinOpensAt,
        joinClosesAt: v.joinClosesAt,
      },
      joinWindow: {
        open: joinWindowOpen,
        before: beforeJoinWindow,
        after: afterJoinWindow,
        openAt: v.joinOpensAt,
        closeAt: v.joinClosesAt,
      },
      ticket: ticketStatus,
    });
  } catch (err: any) {
    console.error('televisit status error', err);

    return json(
      {
        ok: false,
        message: err?.message || 'televisit_status_failed',
      },
      500,
    );
  }
}