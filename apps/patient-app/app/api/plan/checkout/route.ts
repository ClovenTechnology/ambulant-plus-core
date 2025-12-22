// apps/patient-app/app/api/plan/checkout/route.ts
import { NextResponse } from 'next/server';
import type { Plan } from '../../../../lib/plans';
import { normalizePlan } from '../../../../lib/plans';

type BillingCycle = 'monthly' | 'annual';

function randTx() {
  return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
}

function normalizeCycle(x: any): BillingCycle {
  const s = String(x ?? '').toLowerCase().trim();
  return s === 'annual' ? 'annual' : 'monthly';
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const plan = normalizePlan(body?.plan) as Plan;

  // ✅ accept cycle OR billing
  const cycle = normalizeCycle(body?.cycle ?? body?.billing);

  if (!plan) {
    return NextResponse.json({ ok: false, error: 'Invalid plan.' }, { status: 400 });
  }

  const tx = randTx();
  const back = typeof body?.back === 'string' && body.back ? body.back : '/vitals';

  const checkoutUrl = `/plan/upgrade?status=success&paidPlan=${encodeURIComponent(plan)}&cycle=${encodeURIComponent(
    cycle
  )}&tx=${encodeURIComponent(tx)}&back=${encodeURIComponent(back)}`;

  return NextResponse.json({ ok: true, checkoutUrl, tx });
}
