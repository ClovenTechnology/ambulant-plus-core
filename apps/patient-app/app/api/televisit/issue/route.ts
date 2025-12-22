// apps/patient-app/app/api/televisit/issue/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { TelevisitRole } from '@prisma/client';
import { ipFromReq, safeUA, sha256Hex, randomToken } from '@/src/lib/televisit/security';
import { SignJWT } from 'jose';

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

function envFirst(names: string[]) {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return v.trim();
  }
  return '';
}

function envInt(name: string, fallback: number) {
  const v = process.env[name];
  const n = v != null ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export async function POST(req: Request) {
  try {
    const uid = mustUid(req);
    const role = mustRole(req);

    const body = await req.json().catch(() => ({} as any));
    const visitId = String(body.visitId || '').trim();
    const roomId = String(body.roomId || '').trim();
    const force = !!body.force;

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
    if (!joinOpen) {
      return NextResponse.json(
        { ok: false, error: 'Join window not open', joinOpensAt: visit.joinOpensAt, joinClosesAt: visit.joinClosesAt },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const consent = await prisma.televisitConsent.findFirst({
      where: { visitId: visit.id, uid, role },
      orderBy: { acceptedAt: 'desc' },
      select: { id: true },
    });

    if (!consent) {
      return NextResponse.json(
        { ok: false, error: 'Consent required before issuing join ticket' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // If an active ticket exists, we can't return it (we never store raw token).
    // If force=false, block and tell client to keep its token.
    const existing = await prisma.televisitJoinTicket.findFirst({
      where: { visitId: visit.id, uid, role, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { issuedAt: 'desc' },
      select: { expiresAt: true },
    });

    if (existing && !force) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Active ticket already exists (client must keep token). Pass {force:true} to rotate.',
          expiresAt: existing.expiresAt,
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // ---- JWT config (must match api-gateway verification) ----
    const joinSecret = envFirst(['TELEVISIT_JOIN_JWT_SECRET', 'RTC_JOIN_JWT_SECRET', 'JOIN_TICKET_JWT_SECRET']);
    if (!joinSecret) {
      return NextResponse.json(
        { ok: false, error: 'server_misconfig', message: 'Missing TELEVISIT_JOIN_JWT_SECRET' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const issuer = envFirst(['TELEVISIT_JOIN_JWT_ISSUER', 'JOIN_TICKET_JWT_ISSUER']);
    const audience = envFirst(['TELEVISIT_JOIN_JWT_AUDIENCE', 'JOIN_TICKET_JWT_AUDIENCE']);

    // TTL: default 2h, but never beyond joinClosesAt
    const ttlSec = envInt('TELEVISIT_JOIN_TOKEN_TTL_SEC', envInt('JOIN_TOKEN_TTL_SEC', 2 * 60 * 60));
    const expMsHard = Math.min(now.getTime() + ttlSec * 1000, new Date(visit.joinClosesAt).getTime());
    const expiresAt = new Date(expMsHard);

    // Allow small skew. (Join window already enforced above.)
    const nbf = Math.floor((now.getTime() - 5_000) / 1000);
    const iat = Math.floor(now.getTime() / 1000);
    const exp = Math.floor(expiresAt.getTime() / 1000);

    const orgId = (visit as any)?.orgId ? String((visit as any).orgId) : 'org-default';

    // Claims MUST match api-gateway accepted keys
    const claims = {
      uid,
      role, // 'patient' | 'clinician' | 'staff' | 'observer' | 'admin'
      visitId: visit.id,
      roomId: visit.roomId,
      orgId,
    };

    const key = new TextEncoder().encode(joinSecret);

    const joinJwt = await new SignJWT(claims as any)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(uid) // gives APIGW a fallback via 'sub' if needed
      .setIssuedAt(iat)
      .setNotBefore(nbf)
      .setExpirationTime(exp)
      .setJti(randomToken(16))
      .setIssuer(issuer || undefined)
      .setAudience(audience || undefined)
      .sign(key);

    // Store ONLY hash (never store raw token)
    const tokenHash = sha256Hex(joinJwt);

    const ip = ipFromReq(req);
    const ua = safeUA(req);

    // Rotate: revoke any prior active tickets for same visit/user/role
    // (best practice: keep at most one active per actor per visit)
    await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.televisitJoinTicket.updateMany({
          where: { visitId: visit.id, uid, role, revokedAt: null, expiresAt: { gt: now } },
          data: { revokedAt: now },
        });
      }

      await tx.televisitJoinTicket.create({
        data: {
          visitId: visit.id,
          uid,
          role,
          tokenHash,
          expiresAt,
          ipHash: ip ? sha256Hex(ip) : null,
          userAgent: ua,
          orgId,
        },
      });
    });

    return NextResponse.json(
      {
        ok: true,
        joinToken: joinJwt, // JWT string
        expiresAt,
        // helpful echoes
        visitId: visit.id,
        roomId: visit.roomId,
        role,
        uid,
        orgId,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Unknown error' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
