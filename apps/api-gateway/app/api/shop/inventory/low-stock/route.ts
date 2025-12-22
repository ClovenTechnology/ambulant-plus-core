// apps/api-gateway/app/api/shop/inventory/low-stock/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readInt(v: string | null, def: number, min = 0, max = 10_000) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const threshold = readInt(url.searchParams.get('threshold'), 10, 0, 10_000);
  const limit = readInt(url.searchParams.get('limit'), 20, 1, 200);

  // “Low stock” means: stockQty is tracked AND <= threshold
  const variants = await prisma.shopVariant.findMany({
    where: {
      active: true,
      stockQty: { not: null, lte: threshold },
    } as any,
    orderBy: [{ stockQty: 'asc' }, { updatedAt: 'desc' }],
    take: limit,
    include: {
      product: true,
    },
  });

  const items = variants.map((v: any) => ({
    variantId: v.id,
    sku: v.sku,
    label: v.label,
    stockQty: v.stockQty,
    inStock: v.inStock,
    allowBackorder: v.allowBackorder ?? v.product?.allowBackorder,
    productId: v.productId,
    productName: v.product?.name || 'Product',
  }));

  return NextResponse.json({
    ok: true,
    threshold,
    items,
  });
}
