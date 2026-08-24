// apps/api-gateway/app/api/shop/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import {
  buyerUidFromHeaders,
  eligibilityAllows,
  normalizeShopChannel,
  publicationAllows,
  resolveBuyerTypes,
} from '@/src/lib/shop-authority';

export const runtime = 'nodejs';

function normalizedChannel(value: unknown) {
  return normalizeShopChannel(value || 'PATIENT');
}

function pickPrice(base?: number | null, sale?: number | null) {
  const s = Number(sale ?? 0);
  if (Number.isFinite(s) && s > 0) return s;
  const b = Number(base ?? 0);
  if (Number.isFinite(b) && b > 0) return b;
  return 0;
}

function safeInt(n: any, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.floor(v) : fallback;
}

function safeStr(v: any) {
  return (typeof v === 'string' ? v : '').trim();
}

function getBuyerUid(req: NextRequest, body: any) {
  const h = safeStr(req.headers.get('x-uid'));
  if (h) return h;

  const b = safeStr(body?.buyerUid);
  if (b) return b;

  const m1 = safeStr(body?.metadata?.buyerUid);
  if (m1) return m1;

  const m2 = safeStr(body?.metadata?.uid);
  if (m2) return m2;

  return '';
}

async function paystackInitialize(args: {
  reference: string;
  email: string;
  amountZar: number; // rands
  callbackUrl: string;
  metadata?: any;
}) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error('Missing PAYSTACK_SECRET_KEY');

  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      reference: args.reference,
      email: args.email,
      amount: Math.max(1, Math.round(args.amountZar)) * 100, // ZAR -> cents
      currency: 'ZAR',
      callback_url: args.callbackUrl,
      metadata: args.metadata ?? {},
    }),
  });

  const js = await res.json().catch(() => ({}));
  if (!res.ok || !js?.status || !js?.data?.authorization_url) {
    throw new Error(js?.message || 'Paystack initialize failed');
  }

  return {
    authorizationUrl: js.data.authorization_url as string,
    reference: js.data.reference as string,
    accessCode: js.data.access_code as string,
    raw: js,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const channel = normalizedChannel(body.channel);
    if (!channel) {
      return NextResponse.json({ ok: false, error: 'Invalid shop channel' }, { status: 400 });
    }

    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return NextResponse.json({ ok: false, error: 'No items' }, { status: 400 });

    const successUrl = safeStr(body.successUrl);
    const cancelUrl = safeStr(body.cancelUrl);
    if (!successUrl || !cancelUrl) {
      return NextResponse.json({ ok: false, error: 'Missing successUrl / cancelUrl' }, { status: 400 });
    }

    // ✅ buyer-scoped order history guarantee
    const trustedBuyerUid = buyerUidFromHeaders(req.headers);
    const buyerUid =
      trustedBuyerUid || (channel === 'PATIENT' ? getBuyerUid(req, body) : '');
    if (!buyerUid) {
      return NextResponse.json(
        {
          ok: false,
          error: channel === 'PATIENT'
            ? 'Missing buyer identity.'
            : 'Trusted forwarded buyer identity is required for this shop channel.',
        },
        { status: 400 }
      );
    }

    const buyerTypes = await resolveBuyerTypes(prisma as any, channel, buyerUid);
    if (channel !== 'PATIENT' && !buyerTypes.length) {
      return NextResponse.json(
        { ok: false, error: 'Buyer is not eligible for this partner shop', channel },
        { status: 403 },
      );
    }

    // Paystack needs an email
    const customerEmail =
      safeStr(body.customerEmail || body.metadata?.customerEmail) || 'shop@ambulantplus.co.za';

    // Re-price + validate server-side
    const resolved: Array<{
      productId: string;
      variantId: string | null;
      sku: string | null;
      name: string;
      unitAmountZar: number;
      quantity: number;
    }> = [];

    for (const it of items) {
      const productId = safeStr(it.productId);
      const variantId = it.variantId ? String(it.variantId) : null;
      const quantity = Math.max(1, safeInt(it.quantity, 1));

      if (!productId) return NextResponse.json({ ok: false, error: 'Invalid productId' }, { status: 400 });

      const product = await prisma.shopProduct.findUnique({
        where: { id: productId },
        include: {
          channels: true,
          buyerEligibility: true,
          variants: { include: { channels: true, buyerEligibility: true } },
        },
      });
      if (!product || !product.active) {
        return NextResponse.json({ ok: false, error: `Product not found/disabled: ${productId}` }, { status: 404 });
      }

      if (!publicationAllows(product.channels as any, channel)) {
        return NextResponse.json(
          { ok: false, error: 'Product is not published to this channel' },
          { status: 403 },
        );
      }
      if (!eligibilityAllows((product as any).buyerEligibility, buyerTypes)) {
        return NextResponse.json(
          { ok: false, error: 'Buyer is not eligible for this product' },
          { status: 403 },
        );
      }
      if (quantity > Number(product.maxQtyPerOrder || 99)) {
        return NextResponse.json(
          { ok: false, error: 'Quantity exceeds product maximum per order' },
          { status: 400 },
        );
      }

      let unitAmountZar = 0;
      let sku: string | null = null;
      let chosenVariantId: string | null = null;

      if (variantId) {
        const v = product.variants.find((x) => x.id === variantId);
        if (!v || !v.active) return NextResponse.json({ ok: false, error: 'Variant not found/disabled' }, { status: 404 });

        const variantChannels = v.channels?.length ? v.channels : product.channels;
        const variantBuyers = (v as any).buyerEligibility?.length
          ? (v as any).buyerEligibility
          : (product as any).buyerEligibility;
        if (!publicationAllows(variantChannels as any, channel)) {
          return NextResponse.json(
            { ok: false, error: 'Variant is not published to this channel' },
            { status: 403 },
          );
        }
        if (!eligibilityAllows(variantBuyers, buyerTypes)) {
          return NextResponse.json(
            { ok: false, error: 'Buyer is not eligible for this variant' },
            { status: 403 },
          );
        }

        unitAmountZar = pickPrice(v.unitAmountZar, v.saleUnitAmountZar);
        sku = v.sku;
        chosenVariantId = v.id;

        // Inventory check (tracked stock)
        const allowBackorder = v.allowBackorder ?? product.allowBackorder;
        if ((v.inStock === false) && !allowBackorder) {
          return NextResponse.json({ ok: false, error: 'Variant out of stock' }, { status: 409 });
        }
        if (typeof v.stockQty === 'number' && v.stockQty < quantity && !allowBackorder) {
          return NextResponse.json({ ok: false, error: 'Insufficient stock' }, { status: 409 });
        }
      } else {
        // No variant selected: use product base price (only safe if product doesn't have variants)
        if (product.variants.some((x) => x.active)) {
          return NextResponse.json({ ok: false, error: 'Variant required for this product' }, { status: 400 });
        }
        unitAmountZar = pickPrice(product.unitAmountZar, product.saleAmountZar);
        if (!unitAmountZar) return NextResponse.json({ ok: false, error: 'Invalid product price' }, { status: 400 });
      }

      resolved.push({
        productId: product.id,
        variantId: chosenVariantId,
        sku,
        name: product.name,
        unitAmountZar,
        quantity,
      });
    }

    const subtotalZar = resolved.reduce((sum, x) => sum + x.unitAmountZar * x.quantity, 0);
    const shippingZar = 0; // hook here later
    const discountZar = 0; // promos later
    const totalZar = Math.max(1, subtotalZar + shippingZar - discountZar);

    // ✅ Create a DB order first, use it as Paystack reference
    // ✅ Persist buyerUid into providerMeta immediately (the whole point)
    const order = await prisma.shopOrder.create({
      data: {
        status: 'PENDING',
        channel,
        currency: 'ZAR',
        subtotalZar,
        shippingZar,
        discountZar,
        totalZar,
        customerEmail,
        provider: 'paystack',
        providerMeta: {
          buyerUid, // ✅ GUARANTEE
          cancelUrl,
          successUrl,
          channel,
          metadata: body.metadata ?? {},
        },
        items: {
          create: resolved.map((x) => ({
            productId: x.productId,
            variantId: x.variantId,
            sku: x.sku,
            name: x.name,
            unitAmountZar: x.unitAmountZar,
            quantity: x.quantity,
          })),
        },
      },
      include: { items: true },
    });

    // Initialize Paystack
    const reference = order.id; // deterministic, easy lookup
    const init = await paystackInitialize({
      reference,
      email: customerEmail,
      amountZar: totalZar,
      callbackUrl: successUrl,
      metadata: {
        orderId: order.id,
        buyerUid, // ✅ ALSO in provider metadata
        channel,
        cancelUrl,
        successUrl,
        ...((body.metadata ?? {}) as any),
      },
    });

    // Store reference as sessionId + access code
    await prisma.shopOrder.update({
      where: { id: order.id },
      data: {
        sessionId: init.reference,
        providerMeta: {
          ...(order.providerMeta as any),
          paystackAccessCode: init.accessCode,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      checkoutUrl: init.authorizationUrl,
      reference: init.reference,
      currency: 'ZAR',
      totalZar,
    });
  } catch (err: any) {
    console.error('[shop/checkout] error', err);
    return NextResponse.json({ ok: false, error: err?.message || 'Checkout failed' }, { status: 500 });
  }
}