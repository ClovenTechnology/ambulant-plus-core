// apps/patient-app/lib/wallet.server.ts
import crypto from 'crypto';
import { prisma } from './prisma';
import { planMeta, planRank, type Plan } from './plans';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeCode(raw: string) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

export function hashCode(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export function genCode(prefix = 'AMB', groups = 3, groupLen = 4) {
  const randChar = () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  const parts = Array.from({ length: groups }, () => Array.from({ length: groupLen }, randChar).join(''));
  return `${prefix}-${parts.join('-')}`;
}

export function formatZar(n: number) {
  const s = Math.round(n).toString();
  return `R${s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
}

export async function getOrCreateWallet(userId: string, orgId = 'org-default') {
  const existing = await prisma.walletAccount.findUnique({ where: { userId } });
  if (existing) return existing;

  return prisma.walletAccount.create({
    data: { userId, orgId, currency: 'ZAR', balanceZar: 0, heldZar: 0 },
  });
}

export async function walletSummary(userId: string) {
  const w = await getOrCreateWallet(userId);
  const availableZar = Math.max(0, w.balanceZar - w.heldZar);
  return { ...w, availableZar };
}

export async function creditWallet(opts: {
  userId: string;
  amountZar: number;
  scope?: 'SHOP' | 'PLAN' | 'APPOINTMENT';
  sponsorType?: 'PLATFORM' | 'CLINICIAN';
  sponsorId?: string | null;
  voucherId?: string | null;
  txRef?: string | null;
  meta?: any;
}) {
  const w = await getOrCreateWallet(opts.userId);

  const amount = Math.max(0, Math.trunc(opts.amountZar));

  const entry = await prisma.walletEntry.create({
    data: {
      accountId: w.id,
      kind: 'CREDIT',
      scope: (opts.scope as any) ?? null,
      amountZar: amount,
      currency: 'ZAR',
      sponsorType: (opts.sponsorType as any) ?? null,
      sponsorId: opts.sponsorId ?? null,
      voucherId: opts.voucherId ?? null,
      txRef: opts.txRef ?? null,
      meta: opts.meta ?? null,
      orgId: w.orgId,
    },
  });

  await prisma.walletAccount.update({
    where: { id: w.id },
    data: { balanceZar: { increment: amount } },
  });

  return entry;
}

export async function holdWallet(opts: {
  userId: string;
  amountZar: number;
  scope: 'SHOP' | 'PLAN' | 'APPOINTMENT';
  txRef?: string | null;
  refType?: string | null;
  refId?: string | null;
  expiresAt?: Date | null;
}) {
  const w = await getOrCreateWallet(opts.userId);
  const amount = Math.max(0, Math.trunc(opts.amountZar));

  const available = Math.max(0, w.balanceZar - w.heldZar);
  if (amount > available) {
    throw new Error(`Insufficient wallet funds. Available ${formatZar(available)}, requested ${formatZar(amount)}.`);
  }

  const hold = await prisma.walletHold.create({
    data: {
      accountId: w.id,
      scope: opts.scope as any,
      amountZar: amount,
      currency: 'ZAR',
      status: 'HELD',
      txRef: opts.txRef ?? null,
      refType: opts.refType ?? null,
      refId: opts.refId ?? null,
      expiresAt: opts.expiresAt ?? null,
      orgId: w.orgId,
    },
  });

  await prisma.walletAccount.update({
    where: { id: w.id },
    data: { heldZar: { increment: amount } },
  });

  return hold;
}

export async function releaseHold(holdId: string) {
  const hold = await prisma.walletHold.findUnique({ where: { id: holdId } });
  if (!hold || hold.status !== 'HELD') return hold;

  await prisma.walletHold.update({ where: { id: holdId }, data: { status: 'RELEASED' } });
  await prisma.walletAccount.update({
    where: { id: hold.accountId },
    data: { heldZar: { decrement: hold.amountZar } },
  });

  return { ...hold, status: 'RELEASED' as const };
}

export async function captureHold(holdId: string, meta?: any) {
  const hold = await prisma.walletHold.findUnique({ where: { id: holdId } });
  if (!hold || hold.status !== 'HELD') return hold;

  await prisma.walletHold.update({ where: { id: holdId }, data: { status: 'CAPTURED' } });
  await prisma.walletAccount.update({
    where: { id: hold.accountId },
    data: { heldZar: { decrement: hold.amountZar }, balanceZar: { decrement: hold.amountZar } },
  });

  await prisma.walletEntry.create({
    data: {
      accountId: hold.accountId,
      kind: 'DEBIT',
      scope: hold.scope,
      amountZar: -hold.amountZar,
      currency: 'ZAR',
      holdId: hold.id,
      txRef: hold.txRef,
      refType: hold.refType,
      refId: hold.refId,
      meta: meta ?? null,
      orgId: hold.orgId,
    },
  });

  return { ...hold, status: 'CAPTURED' as const };
}

export function canAutoUpgrade(current: Plan, target: Plan) {
  return planRank(current) < planRank(target);
}

export function planCostZar(target: Plan, cycle: 'monthly' | 'annual') {
  const monthly = planMeta(target).priceMonthlyZar ?? 0;
  if (monthly <= 0) return 0;
  if (cycle === 'monthly') return monthly;

  const payMonths = Math.max(1, 12 - 2); // 2 months free
  return monthly * payMonths;
}
