// apps/patient-app/app/api/clinician/vouchers/sweep-expired/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { releaseHold } from '@/lib/wallet.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req: NextRequest) {
  if (process.env.NODE_ENV !== 'production') return true;
  const k = String(req.headers.get('x-sweep-key') || '').trim();
  return Boolean(process.env.VOUCHER_SWEEP_KEY) && k === String(process.env.VOUCHER_SWEEP_KEY);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });

  const now = new Date();

  const expired = await prisma.voucherCode.findMany({
    where: {
      kind: 'FREE_CONSULT',
      sponsorType: 'CLINICIAN',
      active: true,
      expiresAt: { lt: now },
      usedCount: 0,
      sponsorHoldId: { not: null },
    },
    select: { id: true, sponsorHoldId: true, constraints: true },
    take: 500,
  });

  let released = 0;

  for (const v of expired) {
    const holdId = String(v.sponsorHoldId || '');
    if (holdId) {
      await releaseHold(holdId).catch(() => null);
      released++;
    }

    const c = (v.constraints || {}) as any;
    await prisma.voucherCode.update({
      where: { id: v.id },
      data: {
        active: false,
        constraints: { ...(c || {}), releasedAtISO: new Date().toISOString(), releasedReason: 'expired_unused' },
      },
    });
  }

  return NextResponse.json({ ok: true, scanned: expired.length, released });
}
