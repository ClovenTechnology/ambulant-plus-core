// apps/api-gateway/app/api/shop/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';

type ChannelQ = 'clinician' | 'patient' | 'medreach' | 'careport';
const FALLBACK_IMAGE = '/images/shop/_placeholder.png';

function toChannelEnum(ch: ChannelQ) {
  switch (ch) {
    case 'clinician':
      return 'CLINICIAN';
    case 'patient':
      return 'PATIENT';
    case 'medreach':
      return 'MEDREACH';
    case 'careport':
      return 'CAREPORT';
  }
}

function channelsAllow(allowed: Array<{ channel: string }>, channel: string) {
  // If no channel rows => visible to all
  if (!allowed || allowed.length === 0) return true;
  return allowed.some((x) => x.channel === channel);
}

function pickPrice(base?: number | null, sale?: number | null) {
  const s = Number(sale ?? 0);
  if (Number.isFinite(s) && s > 0) return s;
  const b = Number(base ?? 0);
  if (Number.isFinite(b) && b > 0) return b;
  return 0;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const channelQ = (url.searchParams.get('channel') || 'patient') as ChannelQ;
  const channel = toChannelEnum(channelQ);

  const products = await prisma.shopProduct.findMany({
    where: { active: true },
    orderBy: { updatedAt: 'desc' },
    include: {
      channels: true,
      variants: {
        include: { channels: true },
        orderBy: { label: 'asc' },
      },
    },
  });

  const items = products
    .filter((p) => channelsAllow(p.channels, channel))
    .map((p) => {
      const imgs = (p.images || []).filter(Boolean);
      const imageUrl = p.fallbackImage || imgs[0] || FALLBACK_IMAGE;

      // Visible variants:
      const visibleVariants = (p.variants || [])
        .filter((v) => v.active)
        .filter((v) => {
          // variant channels inherit product channels if none set
          const vAllowed = v.channels?.length ? v.channels : p.channels;
          return channelsAllow(vAllowed, channel);
        })
        .map((v) => {
          const allowBackorder =
            v.allowBackorder ?? p.allowBackorder;

          const inStockFlag = v.inStock !== false;
          const qtyKnown = typeof v.stockQty === 'number';
          const qtyOk = !qtyKnown || (v.stockQty as number) > 0;

          return {
            id: v.id,
            sku: v.sku,
            label: v.label,
            unitAmountZar: v.unitAmountZar,
            saleUnitAmountZar: v.saleUnitAmountZar,
            priceZar: pickPrice(v.unitAmountZar, v.saleUnitAmountZar),
            imageUrl: v.imageUrl || imageUrl,
            inStock: (inStockFlag && qtyOk) || allowBackorder,
            stockQty: v.stockQty,
            allowBackorder,
          };
        });

      const basePrice = pickPrice(p.unitAmountZar, p.saleAmountZar);

      // Product-level stock label for UI convenience
      const productInStock =
        visibleVariants.length > 0
          ? visibleVariants.some((v) => v.inStock)
          : (() => {
              const inStockFlag = p.active !== false;
              const qtyKnown = typeof (p as any).stockQty === 'number';
              const stockQty = (p as any).stockQty as number | undefined;
              const qtyOk = !qtyKnown || (stockQty ?? 1) > 0;
              return inStockFlag && qtyOk;
            })();

      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        type: p.type,
        tags: p.tags || [],
        images: imgs.length ? imgs : [imageUrl],
        imageUrl,
        active: p.active,
        allowBackorder: p.allowBackorder,
        maxQtyPerOrder: p.maxQtyPerOrder,
        unitAmountZar: p.unitAmountZar,
        saleAmountZar: p.saleAmountZar,
        priceZar: basePrice,
        inStock: productInStock,
        variants: visibleVariants,
      };
    })
    // If product has variants but none match channel, drop it.
    .filter((p) => (p.variants?.length ? p.variants.length > 0 : true));

  return NextResponse.json({ ok: true, items });
}
