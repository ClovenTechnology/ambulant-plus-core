import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import {
  buyerUidFromHeaders,
  eligibilityAllows,
  normalizeShopChannel,
  publicationAllows,
  resolveBuyerTypes,
  type ShopAuthorityBuyerType,
} from '@/src/lib/shop-authority';
import {
  isManagedEnterpriseMediaRef,
  objectKeyFromManagedEnterpriseMediaRef,
  presignEnterpriseMediaView,
} from '@/src/lib/enterprise-media-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FALLBACK_IMAGE = '/images/shop/_placeholder.png';

function pickPrice(base?: number | null, sale?: number | null) {
  const saleValue = Number(sale ?? 0);
  if (Number.isFinite(saleValue) && saleValue > 0) return saleValue;
  const baseValue = Number(base ?? 0);
  return Number.isFinite(baseValue) && baseValue > 0 ? baseValue : 0;
}

async function storefrontImage(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!isManagedEnterpriseMediaRef(raw)) return raw;
  const objectKey = objectKeyFromManagedEnterpriseMediaRef(raw);
  if (!objectKey) return '';
  try {
    return (await presignEnterpriseMediaView(objectKey)).viewUrl;
  } catch (error) {
    console.error('[shop] managed image signing failed', { objectKey, error });
    return '';
  }
}

async function storefrontImages(values: unknown[]) {
  const resolved = await Promise.all((values || []).map(storefrontImage));
  return resolved.filter(Boolean);
}

function variantPublicationRows(variantRows: any[], productRows: any[]) {
  return variantRows?.length ? variantRows : productRows;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const channel = normalizeShopChannel(url.searchParams.get('channel') || 'PATIENT');
    if (!channel) {
      return NextResponse.json({ ok: false, error: 'invalid_shop_channel' }, { status: 400 });
    }

    // Identity-sensitive channels must be derived from trusted forwarded headers,
    // never a query-string buyerUid supplied by the browser.
    const buyerUid = buyerUidFromHeaders(req.headers);
    const buyerTypes = await resolveBuyerTypes(prisma as any, channel, buyerUid);

    if (channel !== 'PATIENT' && !buyerTypes.length) {
      return NextResponse.json(
        {
          ok: false,
          error: 'partner_shop_buyer_identity_or_eligibility_required',
          channel,
        },
        { status: 403 },
      );
    }

    const products = await prisma.shopProduct.findMany({
      where: { active: true },
      orderBy: { updatedAt: 'desc' },
      include: {
        channels: true,
        buyerEligibility: true,
        variants: {
          include: {
            channels: true,
            buyerEligibility: true,
          },
          orderBy: { label: 'asc' },
        },
      },
    });

    const items: any[] = [];

    for (const product of products as any[]) {
      if (!publicationAllows(product.channels, channel)) continue;
      if (!eligibilityAllows(product.buyerEligibility, buyerTypes)) continue;

      const productManagedImages = (product.images || []).filter(Boolean);
      const signedImages = await storefrontImages(productManagedImages);
      const fallbackSigned = await storefrontImage(product.fallbackImage);
      const imageUrl = signedImages[0] || fallbackSigned || FALLBACK_IMAGE;
      const images = signedImages.length ? signedImages : [imageUrl];

      const visibleVariants = [];
      for (const variant of product.variants || []) {
        if (!variant.active) continue;

        const channelRows = variantPublicationRows(variant.channels, product.channels);
        const eligibilityRows = variantPublicationRows(
          variant.buyerEligibility,
          product.buyerEligibility,
        );

        if (!publicationAllows(channelRows, channel)) continue;
        if (!eligibilityAllows(eligibilityRows, buyerTypes)) continue;

        const allowBackorder = variant.allowBackorder ?? product.allowBackorder;
        const qtyKnown = typeof variant.stockQty === 'number';
        const qtyOk = !qtyKnown || Number(variant.stockQty) > 0;
        const variantImage =
          (await storefrontImage(variant.imageUrl)) || imageUrl;

        visibleVariants.push({
          id: variant.id,
          sku: variant.sku,
          label: variant.label,
          unitAmountZar: variant.unitAmountZar,
          saleUnitAmountZar: variant.saleUnitAmountZar,
          priceZar: pickPrice(
            variant.unitAmountZar,
            variant.saleUnitAmountZar,
          ),
          imageUrl: variantImage,
          inStock: (variant.inStock !== false && qtyOk) || allowBackorder,
          stockQty: variant.stockQty,
          allowBackorder,
        });
      }

      const hasActiveVariants = (product.variants || []).some(
        (variant: any) => variant.active,
      );
      if (hasActiveVariants && !visibleVariants.length) continue;

      items.push({
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        type: product.type,
        tags: product.tags || [],
        images,
        imageUrl,
        active: product.active,
        allowBackorder: product.allowBackorder,
        maxQtyPerOrder: product.maxQtyPerOrder,
        unitAmountZar: product.unitAmountZar,
        saleAmountZar: product.saleAmountZar,
        priceZar: pickPrice(product.unitAmountZar, product.saleAmountZar),
        inStock: visibleVariants.length
          ? visibleVariants.some((variant) => variant.inStock)
          : true,
        variants: visibleVariants,
      });
    }

    return NextResponse.json({
      ok: true,
      channel,
      buyerTypes: buyerTypes as ShopAuthorityBuyerType[],
      items,
    });
  } catch (error: any) {
    console.error('[shop] catalog failed', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'shop_catalog_failed' },
      { status: 500 },
    );
  }
}
