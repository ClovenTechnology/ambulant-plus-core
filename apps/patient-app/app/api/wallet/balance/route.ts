// apps/patient-app/app/api/wallet/balance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { walletSummary } from '../../../../lib/wallet.server';

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

export async function GET(req: NextRequest) {
  const userId = await authenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'patient_authentication_required' }, { status: 401 });
  }

  const w = await walletSummary(userId);
  return NextResponse.json({
    ok: true,
    currency: w.currency,
    balanceZar: w.balanceZar,
    heldZar: w.heldZar,
    availableZar: w.availableZar,
  });
}
