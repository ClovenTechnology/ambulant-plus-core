// apps/patient-app/app/api/plan/pay-wallet/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PLAN_COOKIE, normalizePlan, type Plan } from '../../../../lib/plans';
import { holdWallet, captureHold, planCostZar, walletSummary } from '../../../../lib/wallet.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authenticatedUserId(req: NextRequest): Promise<string | null> {
  const url = new URL('/api/auth/me', req.url);

  const r = await fetch(url, {
    method: 'GET',
    headers: {
      cookie: req.headers.get('cookie') || '',
      authorization: req.headers.get('authorization') || '',
      accept: 'application/json',
    },
    cache: 'no-store',
  }).catch(() => null);

  if (!r?.ok) return null;

  const j = await r.json().catch(() => null);
  if (!j || j.ok === false) return null;

  const actorType = String(j.actorType ?? j.user?.actorType ?? '')
    .trim()
    .toUpperCase();
  if (actorType && actorType !== 'PATIENT') return null;

  const userId = String(
    j.userId ?? j.uid ?? j.id ?? j.user?.userId ?? j.user?.uid ?? j.user?.id ?? '',
  ).trim();

  return userId || null;
}

function normalizeCycle(x: any): 'monthly' | 'annual' {
  const s = String(x ?? '').toLowerCase().trim();
  return s === 'annual' ? 'annual' : 'monthly';
}

export async function POST(req: NextRequest) {
  const userId = await authenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'patient_authentication_required' }, { status: 401 });
  }

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
    userId,
    amountZar: cost,
    scope: 'PLAN',
    txRef,
    refType: 'plan',
    refId: `${plan}:${cycle}`,
  }).catch((e) => {
    return null as any;
  });

  if (!hold) {
    const w = await walletSummary(userId);
    return NextResponse.json(
      { ok: false, error: `Insufficient wallet credit. Available ${w.availableZar}.` },
      { status: 400 }
    );
  }

  await captureHold(hold.id, { reason: 'plan_pay_wallet', plan, cycle });

  const w2 = await walletSummary(userId);

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
