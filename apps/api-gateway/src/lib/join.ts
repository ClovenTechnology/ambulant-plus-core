import { prisma } from './db';

export function getJoinWindow(startMs: number, durMin: number, openLeadSec: number, closeLagSec: number) {
  const openAt = startMs - openLeadSec * 1000;
  const closeAt = startMs + durMin * 60_000 + closeLagSec * 1000;
  return { openAt, closeAt };
}

export async function upsertTicket(visitId: string, userId: string, ttlSec: number) {
  const now = Date.now();
  const existing = await prisma.ticket.findFirst({ where: { visitId, userId } });
  if (existing && Number(existing.expiresAt) > now + 10_000) return existing;

  const token = `TV.${Math.random().toString(36).slice(2)}.${Math.random().toString(36).slice(2).toUpperCase()}`;
  const issuedAt = BigInt(now);
  const expiresAt = BigInt(now + ttlSec * 1000);

  const id = existing?.id ?? crypto.randomUUID();
  return prisma.ticket.upsert({
    where: { id },
    update: { token, issuedAt, expiresAt },
    create: { id, visitId, userId, token, issuedAt, expiresAt },
  });
}
