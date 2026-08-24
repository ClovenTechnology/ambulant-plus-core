import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import {
  normalizeShopBuyerTypes,
  SHOP_BUYER_TYPES,
  SHOP_CHANNELS,
  type ShopAuthorityBuyerType,
  type ShopAuthorityChannel,
  validateShopPublication,
} from '@/src/lib/shop-authority';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FALLBACK_IMAGE = '/images/shop/_placeholder.png';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function requireAdminKey(req: NextRequest) {
  const expected = String(process.env.API_GATEWAY_ADMIN_KEY || '');
  const received = String(req.headers.get('x-admin-key') || '');
  if (!expected) return json({ ok: false, error: 'shop_admin_key_not_configured' }, 503);
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return json({ ok: false, error: 'shop_admin_required' }, 403);
  }
  return null;
}

function toInt(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((item) => String(item || '').trim()).filter(Boolean)),
  );
}

function cleanSlug(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeChannels(value: unknown): ShopAuthorityChannel[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item || '').trim().toUpperCase())
        .filter((item) => SHOP_CHANNELS.includes(item as any)) as ShopAuthorityChannel[],
    ),
  );
}

function publicationError(input: {
  active: boolean;
  channels: ShopAuthorityChannel[];
  buyerTypes: ShopAuthorityBuyerType[];
  allowInheritance?: boolean;
}) {
  if (input.allowInheritance && !input.channels.length && !input.buyerTypes.length) {
    return null;
  }
  if (!input.active && !input.channels.length && !input.buyerTypes.length) {
    return null;
  }
  const validation = validateShopPublication({
    channels: input.channels,
    buyerTypes: input.buyerTypes,
  });
  return validation.ok ? null : validation.errors;
}

async function setProductChannels(tx: any, productId: string, channels: ShopAuthorityChannel[]) {
  await tx.shopProductChannel.deleteMany({ where: { productId } });
  if (channels.length) {
    await tx.shopProductChannel.createMany({
      data: channels.map((channel) => ({ productId, channel })),
      skipDuplicates: true,
    });
  }
}

async function setProductBuyers(tx: any, productId: string, buyerTypes: ShopAuthorityBuyerType[]) {
  await tx.shopProductBuyerEligibility.deleteMany({ where: { productId } });
  if (buyerTypes.length) {
    await tx.shopProductBuyerEligibility.createMany({
      data: buyerTypes.map((buyerType) => ({ productId, buyerType })),
      skipDuplicates: true,
    });
  }
}

async function setVariantChannels(tx: any, variantId: string, channels: ShopAuthorityChannel[]) {
  await tx.shopVariantChannel.deleteMany({ where: { variantId } });
  if (channels.length) {
    await tx.shopVariantChannel.createMany({
      data: channels.map((channel) => ({ variantId, channel })),
      skipDuplicates: true,
    });
  }
}

async function setVariantBuyers(tx: any, variantId: string, buyerTypes: ShopAuthorityBuyerType[]) {
  await tx.shopVariantBuyerEligibility.deleteMany({ where: { variantId } });
  if (buyerTypes.length) {
    await tx.shopVariantBuyerEligibility.createMany({
      data: buyerTypes.map((buyerType) => ({ variantId, buyerType })),
      skipDuplicates: true,
    });
  }
}

function price(base?: number | null, sale?: number | null) {
  const saleValue = Number(sale ?? 0);
  if (saleValue > 0) return saleValue;
  return Math.max(0, Number(base ?? 0));
}

export async function GET(req: NextRequest) {
  const denied = requireAdminKey(req);
  if (denied) return denied;

  try {
    const includeInactive = new URL(req.url).searchParams.get('includeInactive') !== '0';
    const products = await prisma.shopProduct.findMany({
      where: includeInactive ? {} : { active: true },
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

    const items = products.map((product: any) => {
      const images = (product.images || []).filter(Boolean);
      const fallback = product.fallbackImage || images[0] || FALLBACK_IMAGE;
      return {
        ...product,
        images,
        fallbackImage: product.fallbackImage || '',
        priceZar: price(product.unitAmountZar, product.saleAmountZar),
        channels: (product.channels || []).map((row: any) => row.channel),
        buyerTypes: (product.buyerEligibility || []).map((row: any) => row.buyerType),
        published: Boolean(
          product.active &&
            product.channels?.length &&
            product.buyerEligibility?.length,
        ),
        displayImage: fallback,
        variants: (product.variants || []).map((variant: any) => ({
          ...variant,
          priceZar: price(variant.unitAmountZar, variant.saleUnitAmountZar),
          channels: (variant.channels || []).map((row: any) => row.channel),
          buyerTypes: (variant.buyerEligibility || []).map((row: any) => row.buyerType),
          inheritsProductPublication:
            !variant.channels?.length && !variant.buyerEligibility?.length,
        })),
      };
    });

    return json({
      ok: true,
      channels: SHOP_CHANNELS,
      buyerTypes: SHOP_BUYER_TYPES,
      publicationSemantics: {
        productNoChannels: 'UNPUBLISHED',
        productNoBuyerTypes: 'INELIGIBLE',
        variantNoOverrides: 'INHERIT_PRODUCT',
      },
      items,
    });
  } catch (error: any) {
    console.error('[shop settings] GET failed', error);
    return json({ ok: false, error: error?.message || 'shop_settings_list_failed' }, 500);
  }
}

export async function POST(req: NextRequest) {
  const denied = requireAdminKey(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind || '').trim().toLowerCase();

    if (kind === 'product') {
      const name = String(body.name || '').trim();
      const slug = cleanSlug(body.slug || name);
      if (!name || !slug) return json({ ok: false, error: 'product_name_and_slug_required' }, 400);

      const active = body.active === undefined ? false : Boolean(body.active);
      const channels = normalizeChannels(body.channels);
      const buyerTypes = normalizeShopBuyerTypes(body.buyerTypes);
      const errors = publicationError({ active, channels, buyerTypes });
      if (errors) return json({ ok: false, error: 'invalid_shop_publication', details: errors }, 400);

      const product = await prisma.$transaction(async (tx: any) => {
        const created = await tx.shopProduct.create({
          data: {
            slug,
            name,
            description: String(body.description || '').trim() || null,
            type: String(body.type || 'merch').trim() || 'merch',
            tags: toStringArray(body.tags),
            images: toStringArray(body.images),
            fallbackImage: String(body.fallbackImage || '').trim() || null,
            active,
            unitAmountZar:
              body.unitAmountZar === null || body.unitAmountZar === undefined
                ? null
                : Math.max(0, toInt(body.unitAmountZar)),
            saleAmountZar:
              body.saleAmountZar === null || body.saleAmountZar === undefined
                ? null
                : Math.max(0, toInt(body.saleAmountZar)),
            allowBackorder: Boolean(body.allowBackorder),
            maxQtyPerOrder: Math.min(99, Math.max(1, toInt(body.maxQtyPerOrder, 99))),
            meta:
              body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta)
                ? body.meta
                : null,
          },
        });
        await setProductChannels(tx, created.id, channels);
        await setProductBuyers(tx, created.id, buyerTypes);
        return created;
      });

      return json({ ok: true, product }, 201);
    }

    if (kind === 'variant') {
      const productId = String(body.productId || '').trim();
      const sku = String(body.sku || '').trim();
      const label = String(body.label || '').trim();
      if (!productId || !sku || !label) {
        return json({ ok: false, error: 'productId_sku_label_required' }, 400);
      }

      const active = body.active === undefined ? true : Boolean(body.active);
      const channels = normalizeChannels(body.channels);
      const buyerTypes = normalizeShopBuyerTypes(body.buyerTypes);
      const errors = publicationError({
        active,
        channels,
        buyerTypes,
        allowInheritance: true,
      });
      if (errors) return json({ ok: false, error: 'invalid_variant_publication', details: errors }, 400);

      const stockQty =
        body.stockQty === null || body.stockQty === undefined
          ? null
          : Math.max(0, toInt(body.stockQty));

      const variant = await prisma.$transaction(async (tx: any) => {
        const created = await tx.shopVariant.create({
          data: {
            productId,
            sku,
            label,
            active,
            unitAmountZar: Math.max(0, toInt(body.unitAmountZar)),
            saleUnitAmountZar:
              body.saleUnitAmountZar === null || body.saleUnitAmountZar === undefined
                ? null
                : Math.max(0, toInt(body.saleUnitAmountZar)),
            imageUrl: String(body.imageUrl || '').trim() || null,
            inStock: body.inStock === undefined ? true : Boolean(body.inStock),
            stockQty,
            allowBackorder:
              body.allowBackorder === null || body.allowBackorder === undefined
                ? null
                : Boolean(body.allowBackorder),
            meta:
              body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta)
                ? body.meta
                : null,
          },
        });
        await setVariantChannels(tx, created.id, channels);
        await setVariantBuyers(tx, created.id, buyerTypes);
        if (stockQty !== null && stockQty !== 0) {
          await tx.shopInventoryMovement.create({
            data: {
              variantId: created.id,
              delta: stockQty,
              reason: 'initial_stock',
              note: `commerce_studio:create_variant:${created.id}`,
            },
          });
        }
        return created;
      });

      return json({ ok: true, variant }, 201);
    }

    return json({ ok: false, error: 'unsupported_shop_create_kind' }, 400);
  } catch (error: any) {
    console.error('[shop settings] POST failed', error);
    const message = String(error?.message || '');
    if (message.includes('Unique constraint')) {
      return json({ ok: false, error: 'shop_product_or_sku_already_exists' }, 409);
    }
    return json({ ok: false, error: message || 'shop_settings_create_failed' }, 500);
  }
}

export async function PATCH(req: NextRequest) {
  const denied = requireAdminKey(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind || '').trim().toLowerCase();

    if (kind === 'product') {
      const id = String(body.id || '').trim();
      if (!id) return json({ ok: false, error: 'product_id_required' }, 400);

      const existing = await prisma.shopProduct.findUnique({
        where: { id },
        include: { channels: true, buyerEligibility: true },
      });
      if (!existing) return json({ ok: false, error: 'product_not_found' }, 404);

      const active = body.active === undefined ? existing.active : Boolean(body.active);
      const channels =
        body.channels === undefined
          ? existing.channels.map((row: any) => row.channel)
          : normalizeChannels(body.channels);
      const buyerTypes =
        body.buyerTypes === undefined
          ? existing.buyerEligibility.map((row: any) => row.buyerType)
          : normalizeShopBuyerTypes(body.buyerTypes);
      const errors = publicationError({ active, channels, buyerTypes });
      if (errors) return json({ ok: false, error: 'invalid_shop_publication', details: errors }, 400);

      const product = await prisma.$transaction(async (tx: any) => {
        const updated = await tx.shopProduct.update({
          where: { id },
          data: {
            ...(body.slug !== undefined ? { slug: cleanSlug(body.slug) } : {}),
            ...(body.name !== undefined ? { name: String(body.name || '').trim() } : {}),
            ...(body.description !== undefined
              ? { description: String(body.description || '').trim() || null }
              : {}),
            ...(body.type !== undefined ? { type: String(body.type || 'merch').trim() } : {}),
            ...(body.tags !== undefined ? { tags: toStringArray(body.tags) } : {}),
            ...(body.images !== undefined ? { images: toStringArray(body.images) } : {}),
            ...(body.fallbackImage !== undefined
              ? { fallbackImage: String(body.fallbackImage || '').trim() || null }
              : {}),
            active,
            ...(body.unitAmountZar !== undefined
              ? {
                  unitAmountZar:
                    body.unitAmountZar === null
                      ? null
                      : Math.max(0, toInt(body.unitAmountZar)),
                }
              : {}),
            ...(body.saleAmountZar !== undefined
              ? {
                  saleAmountZar:
                    body.saleAmountZar === null
                      ? null
                      : Math.max(0, toInt(body.saleAmountZar)),
                }
              : {}),
            ...(body.allowBackorder !== undefined
              ? { allowBackorder: Boolean(body.allowBackorder) }
              : {}),
            ...(body.maxQtyPerOrder !== undefined
              ? {
                  maxQtyPerOrder: Math.min(
                    99,
                    Math.max(1, toInt(body.maxQtyPerOrder, 99)),
                  ),
                }
              : {}),
          },
        });
        if (body.channels !== undefined) await setProductChannels(tx, id, channels);
        if (body.buyerTypes !== undefined) await setProductBuyers(tx, id, buyerTypes);
        return updated;
      });

      return json({ ok: true, product });
    }

    if (kind === 'variant') {
      const id = String(body.id || '').trim();
      if (!id) return json({ ok: false, error: 'variant_id_required' }, 400);

      const existing = await prisma.shopVariant.findUnique({
        where: { id },
        include: { channels: true, buyerEligibility: true },
      });
      if (!existing) return json({ ok: false, error: 'variant_not_found' }, 404);

      const active = body.active === undefined ? existing.active : Boolean(body.active);
      const channels =
        body.channels === undefined
          ? existing.channels.map((row: any) => row.channel)
          : normalizeChannels(body.channels);
      const buyerTypes =
        body.buyerTypes === undefined
          ? existing.buyerEligibility.map((row: any) => row.buyerType)
          : normalizeShopBuyerTypes(body.buyerTypes);
      const errors = publicationError({
        active,
        channels,
        buyerTypes,
        allowInheritance: true,
      });
      if (errors) return json({ ok: false, error: 'invalid_variant_publication', details: errors }, 400);

      const variant = await prisma.$transaction(async (tx: any) => {
        const updated = await tx.shopVariant.update({
          where: { id },
          data: {
            ...(body.sku !== undefined ? { sku: String(body.sku || '').trim() } : {}),
            ...(body.label !== undefined ? { label: String(body.label || '').trim() } : {}),
            active,
            ...(body.unitAmountZar !== undefined
              ? { unitAmountZar: Math.max(0, toInt(body.unitAmountZar)) }
              : {}),
            ...(body.saleUnitAmountZar !== undefined
              ? {
                  saleUnitAmountZar:
                    body.saleUnitAmountZar === null
                      ? null
                      : Math.max(0, toInt(body.saleUnitAmountZar)),
                }
              : {}),
            ...(body.imageUrl !== undefined
              ? { imageUrl: String(body.imageUrl || '').trim() || null }
              : {}),
            ...(body.inStock !== undefined ? { inStock: Boolean(body.inStock) } : {}),
            ...(body.allowBackorder !== undefined
              ? {
                  allowBackorder:
                    body.allowBackorder === null ? null : Boolean(body.allowBackorder),
                }
              : {}),
          },
        });
        if (body.channels !== undefined) await setVariantChannels(tx, id, channels);
        if (body.buyerTypes !== undefined) await setVariantBuyers(tx, id, buyerTypes);
        return updated;
      });

      return json({ ok: true, variant });
    }

    if (kind === 'variant_stock_adjust') {
      const variantId = String(body.variantId || body.id || '').trim();
      if (!variantId) return json({ ok: false, error: 'variant_id_required' }, 400);
      const mode = String(body.mode || 'delta').trim().toLowerCase();

      const result = await prisma.$transaction(async (tx: any) => {
        const variant = await tx.shopVariant.findUnique({
          where: { id: variantId },
          include: { product: true },
        });
        if (!variant) throw new Error('variant_not_found');
        if (variant.stockQty === null) throw new Error('variant_stock_not_tracked');

        const current = Math.max(0, Number(variant.stockQty || 0));
        const next =
          mode === 'set'
            ? Math.max(0, toInt(body.value, current))
            : Math.max(0, current + toInt(body.delta, 0));
        const delta = next - current;
        if (!delta) return { variant, movement: null };

        const allowBackorder = variant.allowBackorder ?? variant.product.allowBackorder;
        const updated = await tx.shopVariant.update({
          where: { id: variantId },
          data: {
            stockQty: next,
            inStock: allowBackorder ? variant.inStock : next > 0,
          },
        });
        const movement = await tx.shopInventoryMovement.create({
          data: {
            variantId,
            delta,
            reason: String(body.reason || 'admin_adjust').trim(),
            note: String(body.note || '').trim() || null,
          },
        });
        return { variant: updated, movement };
      });

      return json({ ok: true, ...result });
    }

    return json({ ok: false, error: 'unsupported_shop_update_kind' }, 400);
  } catch (error: any) {
    const message = String(error?.message || '');
    if (message === 'variant_not_found') return json({ ok: false, error: message }, 404);
    if (message === 'variant_stock_not_tracked') return json({ ok: false, error: message }, 409);
    console.error('[shop settings] PATCH failed', error);
    return json({ ok: false, error: message || 'shop_settings_update_failed' }, 500);
  }
}

export async function DELETE(req: NextRequest) {
  const denied = requireAdminKey(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind || '').trim().toLowerCase();
    const id = String(body.id || '').trim();
    if (!id) return json({ ok: false, error: 'id_required' }, 400);

    if (kind === 'variant') {
      await prisma.shopVariant.delete({ where: { id } });
      return json({ ok: true });
    }
    if (kind === 'product') {
      const orderItem = await prisma.shopOrderItem.findFirst({
        where: { productId: id },
        select: { id: true },
      });
      if (orderItem) {
        return json({
          ok: false,
          error: 'product_has_order_history_deactivate_instead',
        }, 409);
      }
      await prisma.shopProduct.delete({ where: { id } });
      return json({ ok: true });
    }

    return json({ ok: false, error: 'unsupported_shop_delete_kind' }, 400);
  } catch (error: any) {
    console.error('[shop settings] DELETE failed', error);
    return json({ ok: false, error: error?.message || 'shop_settings_delete_failed' }, 500);
  }
}
