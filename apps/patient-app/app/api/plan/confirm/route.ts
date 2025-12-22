// apps/patient-app/app/api/plan/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { Plan } from '../../../../lib/plans';
import { normalizePlan, PLAN_COOKIE } from '../../../../lib/plans';

type BillingCycle = 'monthly' | 'annual';
type Credits = { premiumDays: number; familyDays: number };

const PLAN_CREDITS_COOKIE = 'ambulant.planCredits';
const PLAN_CYCLE_COOKIE = 'ambulant.planCycle';

function clampInt(n: any, fallback = 0) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.floor(x));
}

function readCredits(req: NextRequest): Credits {
  const raw = req.cookies.get(PLAN_CREDITS_COOKIE)?.value;
  if (!raw) return { premiumDays: 0, familyDays: 0 };
  try {
    const decoded = decodeURIComponent(raw);
    const js = JSON.parse(decoded);
    return {
      premiumDays: clampInt(js?.premiumDays, 0),
      familyDays: clampInt(js?.familyDays, 0),
    };
  } catch {
    return { premiumDays: 0, familyDays: 0 };
  }
}

function writeCredits(res: NextResponse, credits: Credits) {
  res.cookies.set(PLAN_CREDITS_COOKIE, encodeURIComponent(JSON.stringify(credits)), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}

function normalizeCycle(x: any): BillingCycle {
  const s = String(x ?? '').toLowerCase().trim();
  return s === 'annual' ? 'annual' : 'monthly';
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const plan = normalizePlan(body?.plan) as Plan;
  const tx = String(body?.tx ?? '').trim();
  const cycle = normalizeCycle(body?.cycle);

  if (!tx) {
    return NextResponse.json({ ok: false, error: 'Missing transaction id.' }, { status: 400 });
  }
  if (!plan) {
    return NextResponse.json({ ok: false, error: 'Invalid plan.' }, { status: 400 });
  }

  const credits = readCredits(req);

  const res = NextResponse.json({
    ok: true,
    entitlement: {
      plan,
      cycle,
      credits,
    },
    message: `Payment confirmed. You’re now on ${String(plan)} (${cycle}).`,
  });

  res.cookies.set(PLAN_COOKIE, plan, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  res.cookies.set(PLAN_CYCLE_COOKIE, cycle, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  // keep credits stable
  writeCredits(res, credits);

  return res;
}
