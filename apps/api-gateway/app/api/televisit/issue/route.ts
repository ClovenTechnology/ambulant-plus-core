// apps/api-gateway/app/api/televisit/issue/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { SignJWT } from 'jose';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RtcRole = 'patient' | 'clinician' | 'staff' | 'observer' | 'admin';

function cleanStr(value: unknown): string {
  return String(value ?? '').trim();
}

function normaliseRole(value: unknown): RtcRole {
  const role = cleanStr(value).toLowerCase();

  if (
    role === 'patient' ||
    role === 'clinician' ||
    role === 'staff' ||
    role === 'observer' ||
    role === 'admin'
  ) {
    return role;
  }

  return 'patient';
}

function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function envFirst(names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }

  return '';
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'access-control-allow-origin': '*',
    },
  });
}

function getUid(req: NextRequest, body: any): string {
  return (
    cleanStr(body.uid) ||
    cleanStr(body.userId) ||
    cleanStr(body.patientId) ||
    cleanStr(body.clinicianId) ||
    cleanStr(req.headers.get('x-uid')) ||
    cleanStr(req.headers.get('x-user-id')) ||
    cleanStr(req.headers.get('x-ambulant-user-id'))
  );
}

function getVisitId(req: NextRequest, body: any): string {
  const url = new URL(req.url);

  return (
    cleanStr(body.visitId) ||
    cleanStr(body.televisitId) ||
    cleanStr(url.searchParams.get('visitId')) ||
    cleanStr(url.searchParams.get('televisitId'))
  );
}

async function mintJoinJwt(args: {
  secret: string;
  uid: string;
  role: RtcRole;
  visitId: string;
  roomId: string;
  orgId: string;
  expiresAt: Date;
}) {
  const key = new TextEncoder().encode(args.secret);
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = Math.floor(args.expiresAt.getTime() / 1000);

  return new SignJWT({
    uid: args.uid,
    userId: args.uid,
    role: args.role,
    visitId: args.visitId,
    roomId: args.roomId,
    orgId: args.orgId,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(nowSec)
    .setExpirationTime(Math.max(nowSec + 60, expSec))
    .sign(key);
}

async function createJoinTicket(data: {
  tokenHash: string;
  visitId: string;
  uid: string;
  role: RtcRole;
  orgId: string;
  expiresAt: Date;
}) {
  const delegate = (prisma as any).televisitJoinTicket;

  if (!delegate?.create) {
    throw new Error('televisit_join_ticket_store_unavailable');
  }

  return delegate.create({
    data: {
      tokenHash: data.tokenHash,
      visitId: data.visitId,
      uid: data.uid,
      role: data.role,
      orgId: data.orgId,
      expiresAt: data.expiresAt,
      revokedAt: null,
      lastUsedAt: null,
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers': 'content-type,x-uid,x-user-id,x-ambulant-user-id,x-role,x-org-id',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const visitId = getVisitId(req, body);
    const uid = getUid(req, body);
    const role = normaliseRole(body.role || req.headers.get('x-role'));
    const orgId =
      cleanStr(body.orgId) ||
      cleanStr(req.headers.get('x-org-id')) ||
      cleanStr(req.headers.get('x-org')) ||
      'org-default';

    if (!visitId) {
      return json({ ok: false, message: 'visitId required' }, 400);
    }

    if (!uid) {
      return json({ ok: false, message: 'uid required' }, 400);
    }

    const v = await prisma.televisit.findUnique({
      where: { id: visitId },
    });

    if (!v) {
      return json({ ok: false, message: 'Visit not found' }, 404);
    }

    const now = new Date();

    const openAt = new Date(v.joinOpensAt).getTime();
    const closeAt = new Date(v.joinClosesAt).getTime();
    const nowMs = now.getTime();

    if (nowMs < openAt) {
      return json(
        {
          ok: false,
          message: 'Join window not open yet',
          joinOpensAt: v.joinOpensAt,
        },
        403,
      );
    }

    if (nowMs > closeAt) {
      return json(
        {
          ok: false,
          message: 'Join window has closed',
          joinClosesAt: v.joinClosesAt,
        },
        403,
      );
    }

    const secret = envFirst([
      'TELEVISIT_JOIN_JWT_SECRET',
      'RTC_JOIN_JWT_SECRET',
      'JOIN_TICKET_JWT_SECRET',
    ]);

    if (!secret) {
      return json(
        {
          ok: false,
          message: 'Missing TELEVISIT_JOIN_JWT_SECRET / RTC_JOIN_JWT_SECRET',
        },
        500,
      );
    }

    const expiresAt = new Date(v.joinClosesAt);

    const token = await mintJoinJwt({
      secret,
      uid,
      role,
      visitId: v.id,
      roomId: v.roomId,
      orgId: v.orgId || orgId,
      expiresAt,
    });

    const tokenHash = sha256Hex(token);

    await createJoinTicket({
      tokenHash,
      visitId: v.id,
      uid,
      role,
      orgId: v.orgId || orgId,
      expiresAt,
    });

    return json({
      ok: true,
      visitId: v.id,
      roomId: v.roomId,
      token,
      joinToken: token,
      role,
      uid,
      orgId: v.orgId || orgId,
      scheduledStartAt: v.scheduledStartAt,
      scheduledEndAt: v.scheduledEndAt,
      joinOpensAt: v.joinOpensAt,
      joinClosesAt: v.joinClosesAt,
      expiresAt,
    });
  } catch (err: any) {
    console.error('televisit issue error', err);

    return json(
      {
        ok: false,
        message: err?.message || 'televisit_issue_failed',
      },
      500,
    );
  }
}