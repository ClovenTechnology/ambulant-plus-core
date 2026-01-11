// file: apps/patient-app/app/api/billing/checkout/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';

type PremiumOffer = 'bundle_40_free_year' | 'annual_premium_raffle';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as any;
  if (!body) return jsonError('Invalid JSON payload');

  const orderId = String(body?.orderId || '').trim();
  const status = String(body?.status || '').trim(); // success | cancel
  const offer = String(body?.offer || '') as PremiumOffer;

  if (!orderId) return jsonError('Missing orderId');
  if (status !== 'success' && status !== 'cancel') return jsonError('Invalid status');
  if (offer !== 'bundle_40_free_year' && offer !== 'annual_premium_raffle') return jsonError('Invalid offer');

  // NOTE:
  // This is where you’ll later:
  // - create an Order record (Prisma)
  // - mark payment status (paid/cancelled)
  // - apply entitlements (premiumUntil)
  // - create shipping fulfillment tasks for bundle orders
  //
  // For now, we respond OK (client will update local plan immediately on success page).

  return NextResponse.json(
    {
      ok: true,
      orderId,
      offer,
      status,
      confirmedAt: new Date().toISOString(),
    },
    { status: 200 },
  );
}
