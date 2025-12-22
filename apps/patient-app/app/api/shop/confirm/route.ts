// apps/patient-app/app/api/shop/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { captureHold, creditWallet } from '@/lib/wallet.server';
import { planMeta } from '@/lib/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function rewardValueZar(reward: any) {
  const plan = reward?.plan === 'family' ? 'family' : 'premium';
  const monthly = planMeta(plan as any).priceMonthlyZar || 0;
  const days = reward?.days === 90 ? 90 : 30;
  const months = days === 90 ? 3 : 1;
  return monthly * months;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const sessionId = String(body?.sessionId || '').trim();

  if (!sessionId) return NextResponse.json({ ok: false, error: 'Missing sessionId.' }, { status: 400 });

  const order = await prisma.shopOrder.findUnique({ where: { sessionId }, include: { items: true } });
  if (!order) return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 });
  if (order.status !== 'PENDING') return NextResponse.json({ ok: true, status: order.status, orderId: order.id });

  const pm = (order.providerMeta || {}) as any;
  const holdId = String(pm?.holdId || '');
  if (!holdId) return NextResponse.json({ ok: false, error: 'Missing wallet hold.' }, { status: 400 });

  await captureHold(holdId, { reason: 'shop_confirm', orderId: order.id, sessionId });

  const paid = await prisma.shopOrder.update({
    where: { id: order.id },
    data: { status: 'PAID', paidAt: new Date() },
  });

  // ✅ Promo: credit wallet once, after payment success (wallet flow only)
  try {
    const uid = String(pm?.uid || '').trim();
    const already = Boolean(pm?.promoCreditedAt);
    const reward = pm?.promo?.reward;

    if (uid && !already && reward) {
      const valueZar = rewardValueZar(reward);
      if (valueZar > 0) {
        await creditWallet({
          userId: uid,
          amountZar: valueZar,
          scope: 'PLAN',
          sponsorType: 'PLATFORM',
          sponsorId: null,
          txRef: `promo:${paid.id}`,
          meta: { kind: pm?.promo?.kind || 'promo', reward, orderId: paid.id },
        });

        await prisma.shopOrder.update({
          where: { id: paid.id },
          data: { providerMeta: { ...(pm || {}), promoCreditedAt: new Date().toISOString(), promoValueZar: valueZar } },
        });
      }
    }
  } catch {
    // don't fail checkout confirm if promo credit fails (log later)
  }

  return NextResponse.json({
    ok: true,
    orderId: paid.id,
    status: paid.status,
    paidAt: paid.paidAt,
    totalZar: paid.totalZar,
  });
}
