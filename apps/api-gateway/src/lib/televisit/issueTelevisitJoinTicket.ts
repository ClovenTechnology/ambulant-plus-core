// apps/api-gateway/src/lib/televisit/issueTelevisitJoinTicket.ts
import crypto from 'crypto';
import { SignJWT } from 'jose';
import type { PrismaClient, TelevisitRole } from '@prisma/client';

function sha256Hex(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

export async function issueTelevisitJoinTicket(prisma: PrismaClient, args: {
  visitId: string;
  uid: string;
  role: TelevisitRole;
  consentVersion?: string; // default v1
  userAgent?: string;
  ip?: string; // optional, will be hashed
  ttlSec?: number; // default 10 min, clamped to joinClosesAt
}) {
  const visit = await prisma.televisit.findUnique({ where: { id: args.visitId } });
  if (!visit) throw new Error('Televisit not found');

  const now = new Date();
  const joinOpen = now >= visit.joinOpensAt && now <= visit.joinClosesAt;
  if (!joinOpen) throw new Error('Join window not open');

  const consent = await prisma.televisitConsent.findFirst({
    where: { visitId: visit.id, uid: args.uid, role: args.role },
    orderBy: { acceptedAt: 'desc' },
    select: { consentVersion: true },
  });
  if (!consent) throw new Error('Consent required');

  // revoke any still-active tickets for same (visit, uid, role)
  await prisma.televisitJoinTicket.updateMany({
    where: {
      visitId: visit.id,
      uid: args.uid,
      role: args.role,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    data: { revokedAt: now },
  }).catch(() => {});

  const nbf = nowSec();
  const joinNotAfter = Math.floor(visit.joinClosesAt.getTime() / 1000);

  const desiredTtl = Math.max(60, Math.min(args.ttlSec ?? 10 * 60, 30 * 60)); // 1–30min guard
  const exp = Math.min(nbf + desiredTtl, joinNotAfter);

  if (exp <= nbf + 30) throw new Error('Join ticket TTL too short');

  const secret = process.env.TELEVISIT_JOIN_TICKET_SECRET || '';
  if (!secret) throw new Error('Missing TELEVISIT_JOIN_TICKET_SECRET');
  const key = new TextEncoder().encode(secret);

  const jti = crypto.randomUUID();
  const token = await new SignJWT({
    uid: args.uid,
    role: args.role,
    roomId: visit.roomId,
    visitId: visit.id,
    consentOk: true,
    consentVersion: args.consentVersion || consent.consentVersion || 'v1',
    joinNotAfter,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(nbf)
    .setNotBefore(nbf)
    .setExpirationTime(exp)
    .setJti(jti)
    .sign(key);

  const tokenHash = sha256Hex(token);

  await prisma.televisitJoinTicket.create({
    data: {
      visitId: visit.id,
      uid: args.uid,
      role: args.role,
      tokenHash,
      expiresAt: new Date(exp * 1000),
      userAgent: args.userAgent || null,
      ipHash: args.ip ? sha256Hex(args.ip) : null,
      orgId: visit.orgId,
    },
  });

  return {
    visitId: visit.id,
    roomId: visit.roomId,
    issuedAt: new Date(nbf * 1000),
    expiresAt: new Date(exp * 1000),
    ttlSec: exp - nbf,
    token, // return once (client must store it if you don't store raw)
  };
}
