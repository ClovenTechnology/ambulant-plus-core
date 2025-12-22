// apps/api-gateway/app/api/shop/orders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeDate(d: any) {
  try { return new Date(d).toISOString(); } catch { return null; }
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id;

  const order = await prisma.shopOrder.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const o: any = order;

  return NextResponse.json({
    ok: true,
    order: {
      id: o.id,
      status: o.status,
      channel: o.channel,
      currency: o.currency || 'ZAR',
      createdAt: safeDate(o.createdAt),
      paidAt: safeDate(o.paidAt),
      receiptUrl: o.receiptUrl || null,
      shippingAddress: o.shippingAddress || null,
      providerMeta: o.providerMeta || null,
      items: (o.items || []).map((it: any) => ({
        id: it.id,
        productId: it.productId || null,
        variantId: it.variantId || null,
        name: it.name || it.label || 'Item',
        sku: it.sku || null,
        quantity: it.quantity || 1,
        unitAmountZar: it.unitAmountZar ?? it.unitAmount ?? null,
        imageUrl: it.imageUrl || null,
      })),
    },
  });
}
