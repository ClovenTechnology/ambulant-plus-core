// apps/api-gateway/src/lib/join.ts
import { createHash } from 'crypto';
import { prisma } from '@/src/lib/db';

export type JoinTicketCompat = {
  id: string;
  visitId: string;
  userId: string;
  uid: string;
  token: string;
  tokenHash: string;
  expiresAt: number;
  expiresAtDate: Date;
  revokedAt?: Date | null;
};

function ticketDelegate() {
  return (prisma as any).televisitJoinTicket ?? null;
}

function cleanStr(value: unknown): string {
  return String(value ?? '').trim();
}

function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function makeLegacyToken() {
  return `TV.${Math.random().toString(36).slice(2)}.${Math.random()
    .toString(36)
    .slice(2)
    .toUpperCase()}`;
}

function toCompat(row: any, token: string): JoinTicketCompat {
  const expiresAtDate =
    row?.expiresAt instanceof Date ? row.expiresAt : new Date(row?.expiresAt);

  return {
    id: String(row?.id || ''),
    visitId: String(row?.visitId || ''),
    userId: String(row?.uid || row?.userId || ''),
    uid: String(row?.uid || row?.userId || ''),
    token,
    tokenHash: String(row?.tokenHash || sha256Hex(token)),
    expiresAt: expiresAtDate.getTime(),
    expiresAtDate,
    revokedAt: row?.revokedAt ?? null,
  };
}

export async function upsertTicket(
  visitId: string,
  userId: string,
  ttlSec: number,
): Promise<JoinTicketCompat> {
  const vid = cleanStr(visitId);
  const uid = cleanStr(userId);

  if (!vid) throw new Error('visitId_required');
  if (!uid) throw new Error('userId_required');

  const delegate = ticketDelegate();

  if (!delegate?.findFirst || !delegate?.create) {
    const token = makeLegacyToken();
    const expiresAtDate = new Date(Date.now() + Math.max(60, ttlSec) * 1000);

    return {
      id: sha256Hex(`${vid}:${uid}:${token}`).slice(0, 24),
      visitId: vid,
      userId: uid,
      uid,
      token,
      tokenHash: sha256Hex(token),
      expiresAt: expiresAtDate.getTime(),
      expiresAtDate,
      revokedAt: null,
    };
  }

  const now = new Date();
  const minReusableExpiry = new Date(Date.now() + 10_000);

  /*
   * Existing rows store tokenHash, not the plaintext token.
   * We can reuse the DB row only for validity checks, but we cannot return the old plaintext token.
   * Therefore, create a fresh ticket when a token needs to be issued.
   */
  const existing = await delegate.findFirst({
    where: {
      visitId: vid,
      uid,
      revokedAt: null,
      expiresAt: { gt: minReusableExpiry },
    },
    orderBy: {
      expiresAt: 'desc',
    },
  });

  if (existing?.tokenPlaintext) {
    return toCompat(existing, String(existing.tokenPlaintext));
  }

  const token = makeLegacyToken();
  const tokenHash = sha256Hex(token);
  const expiresAtDate = new Date(Date.now() + Math.max(60, ttlSec) * 1000);

  const row = await delegate.create({
    data: {
      tokenHash,
      visitId: vid,
      uid,
      role: 'patient',
      orgId: 'org-default',
      expiresAt: expiresAtDate,
      revokedAt: null,
      lastUsedAt: null,
    },
  });

  return toCompat(row, token);
}

export async function validateTicket(
  token: string,
): Promise<JoinTicketCompat | null> {
  const raw = cleanStr(token);

  if (!raw) return null;

  const delegate = ticketDelegate();

  if (!delegate?.findUnique && !delegate?.findFirst) {
    return null;
  }

  const tokenHash = sha256Hex(raw);

  const row = delegate.findUnique
    ? await delegate.findUnique({
        where: { tokenHash },
      })
    : await delegate.findFirst({
        where: { tokenHash },
      });

  if (!row) return null;

  const expiresAt = new Date(row.expiresAt).getTime();

  if (row.revokedAt) return null;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

  if (delegate.update) {
    await delegate
      .update({
        where: { tokenHash },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => null);
  }

  return toCompat(row, raw);
}

export async function revokeTicket(token: string) {
  const raw = cleanStr(token);

  if (!raw) return { count: 0 };

  const delegate = ticketDelegate();

  if (!delegate?.updateMany) {
    return { count: 0 };
  }

  return delegate.updateMany({
    where: {
      tokenHash: sha256Hex(raw),
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}