//apps/api-gateway/app/api/vouchers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';

export const dynamic = 'force-dynamic';

function cors(json: any, status = 200) {
  return NextResponse.json(json, {
    status,
    headers: { 'access-control-allow-origin': '*' },
  });
}

function generateCode(): string {
  const base = 'AMB';
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${base}-${rand}`;
}

// GET /api/vouchers?active=&code=
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const activeParam = url.searchParams.get('active');
  const codeParam = url.searchParams.get('code');

  const where: any = {};
  if (activeParam === 'true') where.active = true;
  if (activeParam === 'false') where.active = false;
  if (codeParam) where.code = codeParam.toUpperCase();

  const vouchers = await prisma.promoToken.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return cors({ vouchers });
}

// POST /api/vouchers  (admin-only)
// Body: { code?, kind?, description?, amountCents, currency?, maxUses?, patientId?, validFrom?, expiresAt?, meta? }
export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  if (who.role !== 'admin') {
    return cors({ error: 'forbidden' }, 403);
  }

  const raw = await req.json().catch(() => ({} as any));

  const amountCents = Number(raw.amountCents ?? 0);
  if (!Number.isFinite(amountCents) || amountCents < 0) {
    return cors({ error: 'invalid_amount' }, 400);
  }

  const maxUses = Number(raw.maxUses ?? 1);
  if (!Number.isFinite(maxUses) || maxUses <= 0) {
    return cors({ error: 'invalid_maxUses' }, 400);
  }

  const codeRaw = (raw.code || '').trim();
  const code = (codeRaw || generateCode()).toUpperCase();

  let validFrom: Date | null = null;
  let expiresAt: Date | null = null;

  if (raw.validFrom) {
    const d = new Date(raw.validFrom);
    if (!Number.isNaN(d.getTime())) validFrom = d;
  }
  if (raw.expiresAt) {
    const d = new Date(raw.expiresAt);
    if (!Number.isNaN(d.getTime())) expiresAt = d;
  }

  await prisma.promoToken.create({
    data: {
      code,
      kind: String(raw.kind || 'consult'),
      description: raw.description || null,
      amountCents,
      currency: String(raw.currency || 'ZAR'),
      maxUses,
      patientId: raw.patientId || null,
      active: raw.active !== false,
      validFrom: validFrom || undefined,
      expiresAt: expiresAt || undefined,
      meta: raw.meta ?? {},
      createdBy: who.uid ?? null,
    },
  });

  const vouchers = await prisma.promoToken.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return cors({ vouchers }, 201);
}
