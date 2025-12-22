// apps/patient-app/app/api/plan/pay-wallet/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PLAN_COOKIE, normalizePlan, type Plan } from '../../../../lib/plans';
import { holdWallet, captureHold, planCostZar, walletSummary } from '../../../../lib/wallet.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function uidFromReq(req: NextRequest) {
  const h = String(req.headers.get('x-uid') || '').trim();
  if (h) return h;
  if (process.env.NODE_ENV !== 'production') return 'demo-patient';
  return '';
}

function normalizeCycle(x: any): 'monthly' | 'annual' {
  const s = String(x ?? '').toLowerCase().trim();
  return s === 'annual' ? 'annual' : 'monthly';
}

export async function POST(req: NextRequest) {
  const uid = uidFromReq(req);
  if (!uid) return NextResponse.json({ ok: false, error: 'Missing x-uid.' }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const plan = normalizePlan(body?.plan) as Plan | null;
  const cycle = normalizeCycle(body?.cycle);

  if (!plan || plan === 'free') {
    return NextResponse.json({ ok: false, error: 'Invalid plan.' }, { status: 400 });
  }

  const cost = planCostZar(plan, cycle);
  if (cost <= 0) {
    return NextResponse.json({ ok: false, error: 'This plan has no cost.' }, { status: 400 });
  }

  const txRef = String(body?.tx || `planwallet:${Date.now()}`);

  const hold = await holdWallet({
    userId: uid,
    amountZar: cost,
    scope: 'PLAN',
    txRef,
    refType: 'plan',
    refId: `${plan}:${cycle}`,
  }).catch((e) => {
    return null as any;
  });

  if (!hold) {
    const w = await walletSummary(uid);
    return NextResponse.json(
      { ok: false, error: `Insufficient wallet credit. Available ${w.availableZar}.` },
      { status: 400 }
    );
  }

  await captureHold(hold.id, { reason: 'plan_pay_wallet', plan, cycle });

  const w2 = await walletSummary(uid);

  const res = NextResponse.json({
    ok: true,
    plan,
    cycle,
    paidZar: cost,
    wallet: { availableZar: w2.availableZar, heldZar: w2.heldZar, balanceZar: w2.balanceZar },
  });

  res.cookies.set(PLAN_COOKIE, plan, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  return res;
}
