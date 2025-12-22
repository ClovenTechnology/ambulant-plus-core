// apps/api-gateway/app/api/settings/shop/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import * as nodeCrypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Channel = 'PATIENT' | 'CLINICIAN' | 'MEDREACH' | 'CAREPORT';

const CHANNELS: Channel[] = ['PATIENT', 'CLINICIAN', 'MEDREACH', 'CAREPORT'];
const FALLBACK_IMAGE = '/images/shop/_placeholder.png';

function isChannel(x: any): x is Channel {
  return typeof x === 'string' && CHANNELS.includes(x as any);
}

function toBool(v: any, def = false) {
  return typeof v === 'boolean' ? v : def;
}

function toInt(v: any, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : def;
}

function toStr(v: any, def = '') {
  return typeof v === 'string' ? v : def;
}

function cleanSlug(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function cleanStringArray(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x || '').trim()).filter(Boolean);
}

function cleanImages(v: any): string[] {
  const arr = cleanStringArray(v);
  // ensure unique
  return Array.from(new Set(arr));
}

function nowId(prefix: string) {
  const h = nodeCrypto.randomBytes(6).toString('hex');
  return `${prefix}-${h}`;
}

/**
 * NOTE: This route assumes the following prisma models exist (you already use them):
 * - shopProduct
 * - shopVariant
 * - shopProductChannel  (productId, channel)
 * - shopVariantChannel  (variantId, channel)
 * - shopInventoryMovement (variantId, delta, reason, note)
 *
 * If your join-table model names differ, rename prisma.* calls accordingly.
 */

async function setProductChannels(tx: any, productId: string, channels: Channel[] | null) {
  // If channels null => leave unchanged
  if (channels == null) return;

  await tx.shopProductChannel.deleteMany({ where: { productId } }).catch(() => {});
  if (channels.length === 0) return; // empty => visible to all (because your /api/shop treats no rows as allow-all)

  await tx.shopProductChannel.createMany({
    data: channels.map((c) => ({ productId, channel: c })),
    skipDuplicates: true,
  }).catch(() => {});
}

async function setVariantChannels(tx: any, variantId: string, channels: Channel[] | null) {
  if (channels == null) return;

  await tx.shopVariantChannel.deleteMany({ where: { variantId } }).catch(() => {});
  if (channels.length === 0) return;

  await tx.shopVariantChannel.createMany({
    data: channels.map((c) => ({ variantId, channel: c })),
    skipDuplicates: true,
  }).catch(() => {});
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
  const includeInactive = url.searchParams.get('includeInactive') === '1';

  const products = await prisma.shopProduct.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { updatedAt: 'desc' },
    include: {
      channels: true,
      variants: {
        include: { channels: true },
        orderBy: { label: 'asc' },
      },
    },
  });

  const items = products.map((p: any) => {
    const imgs = (p.images || []).filter(Boolean);
    const imageUrl = p.fallbackImage || imgs[0] || FALLBACK_IMAGE;

    const basePrice = pickPrice(p.unitAmountZar, p.saleAmountZar);

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description || '',
      type: p.type || 'merch',
      collection: p.collection || null, // optional (MERCH/DUECARE/etc)
      tags: p.tags || [],
      images: imgs.length ? imgs : [imageUrl],
      fallbackImage: p.fallbackImage || '',
      active: !!p.active,
      allowBackorder: !!p.allowBackorder,
      maxQtyPerOrder: p.maxQtyPerOrder ?? null,
      unitAmountZar: p.unitAmountZar ?? 0,
      saleAmountZar: p.saleAmountZar ?? null,
      priceZar: basePrice,
      channels: (p.channels || []).map((c: any) => c.channel),
      updatedAt: p.updatedAt,
      variants: (p.variants || []).map((v: any) => {
        const allowBackorder = v.allowBackorder ?? p.allowBackorder;

        const inStockFlag = v.inStock !== false;
        const qtyKnown = typeof v.stockQty === 'number';
        const qtyOk = !qtyKnown || (v.stockQty as number) > 0;

        return {
          id: v.id,
          productId: v.productId,
          sku: v.sku || '',
          label: v.label || '',
          active: !!v.active,
          imageUrl: v.imageUrl || '',
          unitAmountZar: v.unitAmountZar ?? 0,
          saleUnitAmountZar: v.saleUnitAmountZar ?? null,
          priceZar: pickPrice(v.unitAmountZar, v.saleUnitAmountZar),
          inStock: (inStockFlag && qtyOk) || allowBackorder,
          stockQty: v.stockQty ?? null,
          allowBackorder: !!allowBackorder,
          channels: (v.channels || []).map((c: any) => c.channel),
          updatedAt: v.updatedAt,
        };
      }),
    };
  });

  return NextResponse.json({ ok: true, channels: CHANNELS, items });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const kind = String(body.kind || '');

  // ---- Create Product ----
  if (kind === 'product') {
    const name = toStr(body.name).trim();
    if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });

    const slug = cleanSlug(toStr(body.slug || name));
    if (!slug) return NextResponse.json({ error: 'Bad slug' }, { status: 400 });

    const channels = (Array.isArray(body.channels) ? body.channels : [])
      .filter(isChannel) as Channel[];

    const data: any = {
      id: body.id ? String(body.id) : nowId('sp'),
      slug,
      name,
      description: toStr(body.description, ''),
      type: toStr(body.type, 'merch'),
      collection: body.collection ?? undefined, // optional field in schema
      tags: cleanStringArray(body.tags),
      images: cleanImages(body.images),
      fallbackImage: toStr(body.fallbackImage, ''),
      active: toBool(body.active, true),
      allowBackorder: toBool(body.allowBackorder, false),
      maxQtyPerOrder: body.maxQtyPerOrder == null ? null : toInt(body.maxQtyPerOrder, 5),
      unitAmountZar: toInt(body.unitAmountZar, 0),
      saleAmountZar: body.saleAmountZar == null ? null : toInt(body.saleAmountZar, 0),
      currency: 'ZAR', // optional if you store it
    };

    const out = await prisma.$transaction(async (tx) => {
      const created = await tx.shopProduct.create({ data });
      await setProductChannels(tx, created.id, channels);
      return created;
    });

    return NextResponse.json({ ok: true, product: out });
  }

  // ---- Create Variant ----
  if (kind === 'variant') {
    const productId = String(body.productId || '');
    if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 });

    const sku = toStr(body.sku).trim();
    const label = toStr(body.label).trim();
    if (!sku || !label) return NextResponse.json({ error: 'Missing sku/label' }, { status: 400 });

    const channels = (Array.isArray(body.channels) ? body.channels : [])
      .filter(isChannel) as Channel[];

    const unitAmountZar = toInt(body.unitAmountZar, 0);

    const data: any = {
      id: body.id ? String(body.id) : nowId('sv'),
      productId,
      sku,
      label,
      active: toBool(body.active, true),
      imageUrl: toStr(body.imageUrl, ''),
      unitAmountZar,
      saleUnitAmountZar: body.saleUnitAmountZar == null ? null : toInt(body.saleUnitAmountZar, 0),
      inStock: toBool(body.inStock, true),
      stockQty: body.stockQty == null ? null : toInt(body.stockQty, 0),
      allowBackorder: body.allowBackorder == null ? null : toBool(body.allowBackorder, false),
      currency: 'ZAR', // optional if you store it
    };

    const out = await prisma.$transaction(async (tx) => {
      const created = await tx.shopVariant.create({ data });
      await setVariantChannels(tx, created.id, channels);

      // If stock is set on creation, record movement as "seed"/"init"
      if (data.stockQty != null) {
        await tx.shopInventoryMovement.create({
          data: {
            variantId: created.id,
            delta: data.stockQty,
            reason: 'init',
            note: `create_variant:${created.id}`,
          },
        }).catch(() => {});
      }

      return created;
    });

    return NextResponse.json({ ok: true, variant: out });
  }

  return NextResponse.json({ error: 'Unsupported kind' }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const kind = String(body.kind || '');

  // ---- Update Product ----
  if (kind === 'product') {
    const id = String(body.id || '');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const channels = body.channels == null
      ? null
      : (Array.isArray(body.channels) ? body.channels : []).filter(isChannel) as Channel[];

    const data: any = {
      slug: body.slug != null ? cleanSlug(String(body.slug)) : undefined,
      name: body.name != null ? String(body.name) : undefined,
      description: body.description != null ? String(body.description) : undefined,
      type: body.type != null ? String(body.type) : undefined,
      collection: body.collection !== undefined ? body.collection : undefined,
      tags: body.tags != null ? cleanStringArray(body.tags) : undefined,
      images: body.images != null ? cleanImages(body.images) : undefined,
      fallbackImage: body.fallbackImage != null ? String(body.fallbackImage) : undefined,
      active: body.active != null ? !!body.active : undefined,
      allowBackorder: body.allowBackorder != null ? !!body.allowBackorder : undefined,
      maxQtyPerOrder: body.maxQtyPerOrder !== undefined
        ? (body.maxQtyPerOrder == null ? null : toInt(body.maxQtyPerOrder, 5))
        : undefined,
      unitAmountZar: body.unitAmountZar != null ? toInt(body.unitAmountZar, 0) : undefined,
      saleAmountZar: body.saleAmountZar !== undefined
        ? (body.saleAmountZar == null ? null : toInt(body.saleAmountZar, 0))
        : undefined,
    };

    const out = await prisma.$transaction(async (tx) => {
      const updated = await tx.shopProduct.update({ where: { id }, data });
      await setProductChannels(tx, id, channels);
      return updated;
    });

    return NextResponse.json({ ok: true, product: out });
  }

  // ---- Update Variant ----
  if (kind === 'variant') {
    const id = String(body.id || '');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const channels = body.channels == null
      ? null
      : (Array.isArray(body.channels) ? body.channels : []).filter(isChannel) as Channel[];

    const data: any = {
      sku: body.sku != null ? String(body.sku) : undefined,
      label: body.label != null ? String(body.label) : undefined,
      active: body.active != null ? !!body.active : undefined,
      imageUrl: body.imageUrl != null ? String(body.imageUrl) : undefined,
      unitAmountZar: body.unitAmountZar != null ? toInt(body.unitAmountZar, 0) : undefined,
      saleUnitAmountZar: body.saleUnitAmountZar !== undefined
        ? (body.saleUnitAmountZar == null ? null : toInt(body.saleUnitAmountZar, 0))
        : undefined,
      inStock: body.inStock != null ? !!body.inStock : undefined,
      allowBackorder: body.allowBackorder !== undefined
        ? (body.allowBackorder == null ? null : !!body.allowBackorder)
        : undefined,
      // stockQty handled via stock_adjust to keep movements
    };

    const out = await prisma.$transaction(async (tx) => {
      const updated = await tx.shopVariant.update({ where: { id }, data });
      await setVariantChannels(tx, id, channels);
      return updated;
    });

    return NextResponse.json({ ok: true, variant: out });
  }

  // ---- Stock adjust (keeps inventory movements consistent) ----
  if (kind === 'variant_stock_adjust') {
    const variantId = String(body.variantId || body.id || '');
    if (!variantId) return NextResponse.json({ error: 'Missing variantId' }, { status: 400 });

    const mode = String(body.mode || 'set'); // 'set' | 'delta'
    const reason = toStr(body.reason, 'admin_adjust');
    const note = body.note != null ? String(body.note) : '';

    return NextResponse.json(
      await prisma.$transaction(async (tx) => {
        const v = await tx.shopVariant.findUnique({ where: { id: variantId }, include: { product: true } });
        if (!v) return { ok: false, error: 'variant_not_found' };

        const current = v.stockQty == null ? null : Math.max(0, Number(v.stockQty));
        const allowBackorder = (v.allowBackorder ?? v.product?.allowBackorder) ? true : false;

        if (current == null) {
          // not tracked
          return { ok: true, info: 'stock_untracked' };
        }

        let delta = 0;
        if (mode === 'delta') {
          delta = toInt(body.delta, 0);
        } else {
          const next = Math.max(0, toInt(body.value, current));
          delta = next - current;
        }

        const nextQty = Math.max(0, current + delta);

        await tx.shopVariant.update({
          where: { id: variantId },
          data: {
            stockQty: nextQty,
            inStock: allowBackorder ? v.inStock : nextQty > 0,
          },
        });

        if (delta !== 0) {
          await tx.shopInventoryMovement.create({
            data: { variantId, delta, reason, note },
          }).catch(() => {});
        }

        return { ok: true, variantId, from: current, to: nextQty, delta };
      }),
      { status: 200 }
    );
  }

  return NextResponse.json({ error: 'Unsupported kind' }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const kind = String(body.kind || '');

  if (kind === 'variant') {
    const id = String(body.id || '');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      await tx.shopVariantChannel.deleteMany({ where: { variantId: id } }).catch(() => {});
      await tx.shopInventoryMovement.deleteMany({ where: { variantId: id } }).catch(() => {});
      await tx.shopVariant.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  }

  if (kind === 'product') {
    const id = String(body.id || '');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      const variants = await tx.shopVariant.findMany({ where: { productId: id }, select: { id: true } });

      for (const v of variants) {
        await tx.shopVariantChannel.deleteMany({ where: { variantId: v.id } }).catch(() => {});
        await tx.shopInventoryMovement.deleteMany({ where: { variantId: v.id } }).catch(() => {});
      }

      await tx.shopVariant.deleteMany({ where: { productId: id } }).catch(() => {});
      await tx.shopProductChannel.deleteMany({ where: { productId: id } }).catch(() => {});
      await tx.shopProduct.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unsupported kind' }, { status: 400 });
}
