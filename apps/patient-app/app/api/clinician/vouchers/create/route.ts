// apps/patient-app/app/api/clinician/vouchers/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { genCode, normalizeCode, hashCode, holdWallet, releaseHold } from '@/lib/wallet.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLATFORM_PCT = Number(process.env.APPT_PLATFORM_PCT ?? '0.30');
const MAX_COUNT_PER_MONTH = Number(process.env.CLIN_VOUCHER_MAX_COUNT ?? '5');
const MAX_FEE_EXPOSURE_PER_MONTH_ZAR = Number(process.env.CLIN_VOUCHER_MAX_FEE_EXPOSURE_ZAR ?? '500');

function uidFromReq(req: NextRequest) {
  const h = String(req.headers.get('x-uid') || '').trim();
  if (h) return h;
  if (process.env.NODE_ENV !== 'production') return 'demo-clinician';
  return '';
}

function monthRange(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end };
}

function safeInt(x: any, def = 0) {
  const n = Math.trunc(Number(x));
  return Number.isFinite(n) ? n : def;
}

export async function POST(req: NextRequest) {
  const clinicianId = uidFromReq(req);
  if (!clinicianId) return NextResponse.json({ ok: false, error: 'Missing x-uid.' }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));

  const consultPriceZar = Math.max(0, safeInt(body?.consultPriceZar, 0));
  if (!consultPriceZar) {
    return NextResponse.json({ ok: false, error: 'Missing consultPriceZar.' }, { status: 400 });
  }

  const expiresInDays = Math.min(90, Math.max(1, safeInt(body?.expiresInDays, 30)));
  const perPatientDays = Math.min(365, Math.max(7, safeInt(body?.perPatientDays, 90)));

  const platformFeeHoldZar = Math.max(1, Math.round(consultPriceZar * PLATFORM_PCT));

  // ✅ clinician gates
  const profile = await prisma.clinicianProfile.findUnique({ where: { userId: clinicianId } });
  if (!profile) return NextResponse.json({ ok: false, error: 'Clinician profile not found.' }, { status: 404 });

  if (profile.disabled || profile.archived) {
    return NextResponse.json({ ok: false, error: 'Clinician account is disabled/archived.' }, { status: 403 });
  }

  const status = String(profile.status || '').toLowerCase();
  const verified = ['verified', 'approved', 'active'].includes(status) || process.env.NODE_ENV !== 'production';
  if (!verified) return NextResponse.json({ ok: false, error: 'Clinician not verified yet.' }, { status: 403 });

  if (!profile.payoutAccountId && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: 'Payouts not enabled. Add payout details first.' }, { status: 403 });
  }

  const meta = (profile.meta ?? {}) as any;
  const acceptedTerms = Boolean(meta?.promoSpendAccepted) || process.env.NODE_ENV !== 'production';
  if (!acceptedTerms) {
    return NextResponse.json({ ok: false, error: 'Promo Spend Terms not accepted.' }, { status: 403 });
  }

  // ✅ limits
  const now = new Date();
  const { start, end } = monthRange(now);

  const createdThisMonth = await prisma.voucherCode.findMany({
    where: {
      sponsorType: 'CLINICIAN',
      sponsorId: clinicianId,
      kind: 'FREE_CONSULT',
      createdAt: { gte: start, lt: end },
    },
    select: { sponsorHoldId: true },
  });

  const countThisMonth = createdThisMonth.length;
  if (countThisMonth >= MAX_COUNT_PER_MONTH) {
    return NextResponse.json(
      { ok: false, error: `Monthly limit reached (${MAX_COUNT_PER_MONTH} vouchers).` },
      { status: 400 }
    );
  }

  const holdIds = createdThisMonth.map((x) => x.sponsorHoldId).filter(Boolean) as string[];
  const exposureAgg = holdIds.length
    ? await prisma.walletHold.aggregate({
        where: { id: { in: holdIds } },
        _sum: { amountZar: true },
      })
    : { _sum: { amountZar: 0 } as any };

  const exposureZar = Number(exposureAgg?._sum?.amountZar || 0);
  if (exposureZar + platformFeeHoldZar > MAX_FEE_EXPOSURE_PER_MONTH_ZAR) {
    return NextResponse.json(
      {
        ok: false,
        error: `Monthly promo fee exposure exceeded (limit R${MAX_FEE_EXPOSURE_PER_MONTH_ZAR}).`,
      },
      { status: 400 }
    );
  }

  // ✅ reserve platform fee on clinician wallet (hold)
  const hold = await holdWallet({
    userId: clinicianId,
    amountZar: platformFeeHoldZar,
    scope: 'APPOINTMENT',
    txRef: `clin-voucher-fee:${clinicianId}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
    refType: 'voucher_fee',
    refId: 'pending',
    expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
  }).catch(() => null);

  if (!hold) {
    return NextResponse.json(
      { ok: false, error: 'Insufficient promo budget (wallet) to reserve platform fee.' },
      { status: 400 }
    );
  }

  // ✅ create voucher code (store hash only)
  try {
    const rawCode = genCode('CLIN', 3, 4);
    const normalized = normalizeCode(rawCode);
    const codeHash = hashCode(normalized);
    const last4 = normalized.slice(-4);

    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const voucher = await prisma.voucherCode.create({
      data: {
        codeHash,
        codeLast4: last4,
        kind: 'FREE_CONSULT',
        valueZar: consultPriceZar,
        currency: 'ZAR',
        sponsorType: 'CLINICIAN',
        sponsorId: clinicianId,
        constraints: {
          scopes: ['APPOINTMENT'],
          singleUse: true,
          perPatientDays,
          consultPriceZar,
          platformFeeHoldZar,
          note: body?.note ? String(body.note) : undefined,
        },
        maxUses: 1,
        usedCount: 0,
        active: true,
        validFrom: now,
        expiresAt,
        sponsorHoldId: hold.id,
        orgId: 'org-default',
        createdByUserId: clinicianId,
      },
    });

    // Patch hold refId to voucher id (optional; best effort)
    await prisma.walletHold.update({
      where: { id: hold.id },
      data: { refId: voucher.id },
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      voucher: {
        id: voucher.id,
        kind: voucher.kind,
        // ✅ only time raw code is returned
        code: rawCode,
        expiresAt: voucher.expiresAt,
        platformFeeHoldZar,
        perPatientDays,
      },
      limits: {
        countThisMonth: countThisMonth + 1,
        maxCountPerMonth: MAX_COUNT_PER_MONTH,
        feeExposureThisMonthZar: exposureZar + platformFeeHoldZar,
        maxFeeExposurePerMonthZar: MAX_FEE_EXPOSURE_PER_MONTH_ZAR,
      },
    });
  } catch (e) {
    // If voucher creation fails, release the hold so clinician isn’t stuck
    await releaseHold(hold.id).catch(() => null);
    return NextResponse.json({ ok: false, error: 'Failed to create voucher.' }, { status: 500 });
  }
}
