// apps/patient-app/app/api/plan/redeem/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PLAN_COOKIE, normalizePlan, type Plan } from '@/lib/plans';
import {
  normalizeCode,
  hashCode,
  creditWallet,
  walletSummary,
  canAutoUpgrade,
  planCostZar,
  holdWallet,
  captureHold,
} from '@/lib/wallet.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getUid(req: NextRequest) {
  return String(req.headers.get('x-uid') || '').trim();
}

function formatZar(n: number) {
  const s = Math.round(n).toString();
  return `R${s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
}

export async function POST(req: NextRequest) {
  const uid = getUid(req);
  if (!uid) return NextResponse.json({ ok: false, error: 'Missing x-uid.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as any;
  const raw = normalizeCode(body?.code || '');
  if (!raw || raw.length < 6) {
    return NextResponse.json({ ok: false, error: 'Please enter a valid code.' }, { status: 400 });
  }

  const codeHash = hashCode(raw);

  const voucher = await prisma.voucherCode.findUnique({ where: { codeHash } });
  if (!voucher || !voucher.active) {
    return NextResponse.json({ ok: false, error: 'Invalid code.' }, { status: 404 });
  }

  const now = new Date();
  if (voucher.validFrom && now < voucher.validFrom) {
    return NextResponse.json({ ok: false, error: 'This code is not active yet.' }, { status: 400 });
  }
  if (voucher.expiresAt && now > voucher.expiresAt) {
    return NextResponse.json({ ok: false, error: 'This code has expired.' }, { status: 400 });
  }
  if (voucher.usedCount >= voucher.maxUses) {
    return NextResponse.json({ ok: false, error: 'This code has already been used.' }, { status: 400 });
  }

  // ✅ Guardrail: FREE_CONSULT vouchers are appointment-only. Never redeem into wallet.
  if (voucher.kind === 'FREE_CONSULT') {
    return NextResponse.json(
      { ok: false, error: 'This voucher is appointment-only. Apply it during appointment booking.' },
      { status: 400 }
    );
  }

  // Determine current plan from cookie (more trustworthy than client)
  const cookiePlan = normalizePlan(req.cookies.get(PLAN_COOKIE)?.value) || 'free';
  const currentPlan = cookiePlan as Plan;

  // 1) credit wallet first (single value system)
  const credited = Math.max(0, voucher.valueZar | 0);

  const entry = await creditWallet({
    userId: uid,
    amountZar: credited,
    sponsorType: voucher.sponsorType,
    sponsorId: voucher.sponsorId,
    voucherId: voucher.id,
    meta: { kind: voucher.kind, codeLast4: voucher.codeLast4 },
  });

  await prisma.voucherRedemption.create({
    data: {
      voucherId: voucher.id,
      userId: uid,
      creditedZar: credited,
      walletEntryId: entry.id,
      meta: { codeLast4: voucher.codeLast4 },
      orgId: voucher.orgId,
    },
  });

  await prisma.voucherCode.update({
    where: { id: voucher.id },
    data: { usedCount: { increment: 1 } },
  });

  // 2) optional auto-plan apply: only for PLAN_INTENT and constraints.planTarget + constraints.autoApply=true
  const c = (voucher.constraints || {}) as any;
  const autoApply = Boolean(c?.autoApply);
  const planTarget = normalizePlan(c?.planTarget) as Plan | null;
  const cycle = (String(c?.cycle || 'monthly').toLowerCase() === 'annual' ? 'annual' : 'monthly') as
    | 'monthly'
    | 'annual';

  let effect: 'upgraded' | 'credit_saved' = 'credit_saved';
  let message = `Credit saved. ${formatZar(credited)} was added to your wallet.`;
  let allowShopSpend = true;

  if (voucher.kind === 'PLAN_INTENT' && autoApply && planTarget) {
    if (canAutoUpgrade(currentPlan, planTarget)) {
      const cost = planCostZar(planTarget, cycle);
      const sum = await walletSummary(uid);

      if (cost > 0 && sum.availableZar >= cost) {
        const hold = await holdWallet({
          userId: uid,
          amountZar: cost,
          scope: 'PLAN',
          txRef: `redeem:${voucher.id}`,
          refType: 'plan',
          refId: planTarget,
        });
        await captureHold(hold.id, { reason: 'auto_apply_plan', voucherId: voucher.id });

        const res = NextResponse.json({
          ok: true,
          redeemed: { code: `****${voucher.codeLast4}`, plan: planTarget, valueZar: credited },
          effect: 'upgraded',
          message: `Upgraded. ${planTarget.toUpperCase()} is now active. Wallet remaining: ${formatZar(
            Math.max(0, sum.availableZar - cost)
          )}.`,
          allowShopSpend,
        });

        res.cookies.set(PLAN_COOKIE, planTarget, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
        return res;
      } else {
        message = `Credit saved. Wallet funded with ${formatZar(credited)} — you can use it to upgrade at any time.`;
      }
    } else {
      message = `Credit saved. You already have ${currentPlan.toUpperCase()} — your wallet was funded with ${formatZar(
        credited
      )} for future use.`;
    }
  }

  return NextResponse.json({
    ok: true,
    redeemed: { code: `****${voucher.codeLast4}`, valueZar: credited },
    effect,
    message,
    allowShopSpend,
  });
}
