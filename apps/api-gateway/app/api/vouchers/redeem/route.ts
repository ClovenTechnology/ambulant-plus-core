//apps/api-gateway/app/api/vouchers/redeem/route.ts
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

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  if (who.role !== 'patient' && who.role !== 'admin') {
    return cors({ error: 'forbidden' }, 403);
  }

  const raw = await req.json().catch(() => ({} as any));
  const codeRaw = String(raw.code || '').trim();
  if (!codeRaw) {
    return cors({ error: 'code_required' }, 400);
  }
  const code = codeRaw.toUpperCase();

  const now = new Date();
  const patientId =
    who.role === 'patient'
      ? who.uid ?? raw.patientId ?? null
      : raw.patientId ?? null;

  const token = await prisma.promoToken.findUnique({
    where: { code },
  });

  if (!token) {
    return cors({ error: 'invalid_code' }, 400);
  }

  // basic eligibility checks
  if (!token.active) {
    return cors({ error: 'voucher_inactive' }, 400);
  }

  if (token.maxUses > 0 && token.usedCount >= token.maxUses) {
    return cors({ error: 'voucher_exhausted' }, 400);
  }

  if (token.validFrom && token.validFrom > now) {
    return cors({ error: 'voucher_not_yet_valid' }, 400);
  }

  if (token.expiresAt && token.expiresAt < now) {
    return cors({ error: 'voucher_expired' }, 400);
  }

  if (token.patientId && patientId && token.patientId !== patientId) {
    return cors({ error: 'voucher_not_for_this_patient' }, 403);
  }

  // redeem: bump usedCount and optionally auto-disable
  const newUsedCount = token.usedCount + 1;
  const stillActive =
    token.active && (token.maxUses === 0 || newUsedCount < token.maxUses);

  const updated = await prisma.promoToken.update({
    where: { code },
    data: {
      usedCount: newUsedCount,
      active: stillActive,
      updatedAt: new Date(),
    },
  });

  const remainingUses =
    updated.maxUses === 0
      ? Infinity
      : Math.max(0, updated.maxUses - updated.usedCount);

  return cors({
    ok: true,
    voucher: updated,
    valueCents: updated.amountCents,
    remainingUses,
  });
}
