// apps/patient-app/app/api/wallet/balance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { walletSummary } from '../../../../lib/wallet.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function uidFromReq(req: NextRequest) {
  const h = String(req.headers.get('x-uid') || '').trim();
  if (h) return h;
  if (process.env.NODE_ENV !== 'production') return 'demo-patient';
  return '';
}

export async function GET(req: NextRequest) {
  const uid = uidFromReq(req);
  if (!uid) return NextResponse.json({ ok: false, error: 'Missing x-uid.' }, { status: 401 });

  const w = await walletSummary(uid);
  return NextResponse.json({
    ok: true,
    currency: w.currency,
    balanceZar: w.balanceZar,
    heldZar: w.heldZar,
    availableZar: w.availableZar,
  });
}
