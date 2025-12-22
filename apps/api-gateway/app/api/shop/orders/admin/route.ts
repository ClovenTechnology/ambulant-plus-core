// apps/api-gateway/app/api/shop/orders/admin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function computeOrderTotalZar(order: any) {
  // Prefer explicit totals if your schema has them
  if (typeof order?.totalZar === 'number') return order.totalZar;
  if (typeof order?.totalAmountZar === 'number') return order.totalAmountZar;

  // If stored as cents
  if (typeof order?.totalCents === 'number') return Math.round(order.totalCents) / 100;

  // Otherwise sum items (best-effort)
  const items = Array.isArray(order?.items) ? order.items : [];
  let sum = 0;
  for (const it of items) {
    const qty = Math.max(1, Math.round(num(it?.quantity)));
    // common fields we might have
    const unitZar =
      typeof it?.unitAmountZar === 'number'
        ? it.unitAmountZar
        : typeof it?.unitPriceZar === 'number'
        ? it.unitPriceZar
        : typeof it?.unitAmount === 'number'
        ? it.unitAmount
        : typeof it?.unitPrice === 'number'
        ? it.unitPrice
        : 0;

    const lineZar =
      typeof it?.lineTotalZar === 'number'
        ? it.lineTotalZar
        : typeof it?.totalZar === 'number'
        ? it.totalZar
        : unitZar * qty;

    sum += num(lineZar);
  }
  return sum;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const statusQ = String(url.searchParams.get('status') || '').trim();
  const q = String(url.searchParams.get('q') || '').trim();
  const take = Math.min(500, Math.max(1, Number(url.searchParams.get('take') || 200)));
  const lowStockThreshold = Math.min(100, Math.max(0, Number(url.searchParams.get('lowStock') || 5)));

  const where: any = {};

  if (statusQ && statusQ !== 'ALL') {
    // allow CSV: PAID,FAILED
    const parts = statusQ.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 1) where.status = parts[0];
    else where.status = { in: parts };
  }

  if (q) {
    // minimal safe search: order id contains q
    where.id = { contains: q, mode: 'insensitive' };
  }

  const orders = (await prisma.shopOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
    include: { items: true },
  })) as any[];

  const items = orders.map((o) => {
    const totalZar = computeOrderTotalZar(o);
    return {
      id: String(o.id),
      status: String(o.status || ''),
      channel: o.channel ?? null,
      currency: o.currency ?? 'ZAR',
      createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
      paidAt: o.paidAt ? new Date(o.paidAt).toISOString() : null,
      itemCount: Array.isArray(o.items) ? o.items.length : 0,
      totalZar,
    };
  });

  const byStatus: Record<string, { count: number; totalZar: number }> = {};
  const byChannel: Record<string, { count: number; totalZar: number }> = {};

  let totalZar = 0;
  let paidZar = 0;

  for (const o of items) {
    const st = o.status || 'UNKNOWN';
    const ch = (o.channel || 'UNKNOWN') as string;
    const t = num(o.totalZar);

    totalZar += t;
    if (st === 'PAID') paidZar += t;

    byStatus[st] = byStatus[st] || { count: 0, totalZar: 0 };
    byStatus[st].count += 1;
    byStatus[st].totalZar += t;

    byChannel[ch] = byChannel[ch] || { count: 0, totalZar: 0 };
    byChannel[ch].count += 1;
    byChannel[ch].totalZar += t;
  }

  // Low stock widget (tracked stock only)
  const low = await prisma.shopVariant.findMany({
    where: {
      active: true,
      stockQty: { not: null, lte: lowStockThreshold },
    },
    orderBy: { stockQty: 'asc' },
    take: 25,
    include: { product: true },
  });

  const lowStock = low.map((v: any) => ({
    sku: v.sku ?? null,
    label: v.label ?? null,
    stockQty: typeof v.stockQty === 'number' ? v.stockQty : null,
    allowBackorder: v.allowBackorder ?? v.product?.allowBackorder ?? null,
    productName: v.product?.name ?? null,
    productSlug: v.product?.slug ?? null,
  }));

  return NextResponse.json({
    ok: true,
    items,
    stats: {
      count: items.length,
      totalZar,
      paidZar,
      byStatus,
      byChannel,
      lowStock,
      lowStockThreshold,
    },
  });
}
