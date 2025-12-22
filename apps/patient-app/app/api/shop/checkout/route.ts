// apps/patient-app/app/api/shop/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { holdWallet, walletSummary, creditWallet } from '@/lib/wallet.server';
import { planMeta } from '@/lib/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ==============================
   UID
============================== */
function getUidFromReq(req: NextRequest) {
  const h = req.headers.get('x-uid');
  if (h) return String(h).trim();
  if (process.env.NODE_ENV !== 'production') return 'demo-patient';
  return '';
}

/* ==============================
   Promo Lucky Draw (IoMT)
============================== */
type RewardPlan = 'premium' | 'family';
type PromoReward = {
  code: 'PREM30' | 'PREM90' | 'FAM30' | 'FAM90';
  plan: RewardPlan;
  days: 30 | 90;
  label: string;
};

const PROMO_KIND = 'iomt_lucky_draw_v1';

function b64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function signToken(payload: any) {
  const secret =
    process.env.AMBULANT_PROMO_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.JWT_SECRET ||
    'dev-only-secret-change-me';

  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}

function getAllLineItems(body: any): any[] {
  const items: any[] = [];
  const pushArr = (x: any) => {
    if (Array.isArray(x)) items.push(...x);
  };
  pushArr(body?.items);
  pushArr(body?.lineItems);
  pushArr(body?.cart?.items);
  pushArr(body?.cart?.lineItems);
  pushArr(body?.order?.items);
  pushArr(body?.order?.lineItems);
  pushArr(body?.products);
  pushArr(body?.basket?.items);
  if (Array.isArray(body)) pushArr(body);
  return items.filter(Boolean);
}

function isIomtItem(item: any) {
  const hay = [
    item?.name,
    item?.title,
    item?.label,
    item?.sku,
    item?.productId,
    item?.category,
    item?.kind,
    ...(Array.isArray(item?.tags) ? item.tags : []),
  ]
    .filter(Boolean)
    .map((x) => String(x).toLowerCase())
    .join(' ');

  const keywords = [
    'iomt',
    'wearable',
    'nexring',
    'health monitor',
    'duecare',
    'digital stethoscope',
    'stethoscope',
    'otoscope',
    'hd otoscope',
    'smart ring',
    'vitals',
    'remote monitoring',
  ];

  return keywords.some((k) => hay.includes(k));
}

function isEligibleForPromo(body: any) {
  const items = getAllLineItems(body);
  if (!items.length) return false;
  return items.some(isIomtItem);
}

function randomFloat01() {
  try {
    const n = crypto.randomInt(0, 1_000_000);
    return n / 1_000_000;
  } catch {
    return Math.random();
  }
}

function pickPromoReward(): PromoReward | null {
  const r = randomFloat01();
  if (r < 0.02) return { code: 'FAM90', plan: 'family', days: 90, label: 'Family — 3 months (gift)' };
  if (r < 0.06) return { code: 'PREM90', plan: 'premium', days: 90, label: 'Premium — 3 months (gift)' };
  if (r < 0.14) return { code: 'FAM30', plan: 'family', days: 30, label: 'Family — 1 month (gift)' };
  if (r < 0.26) return { code: 'PREM30', plan: 'premium', days: 30, label: 'Premium — 1 month (gift)' };
  return null;
}

function rewardValueZar(reward: PromoReward) {
  const monthly = planMeta(reward.plan).priceMonthlyZar || 0;
  const months = reward.days === 90 ? 3 : 1;
  return monthly * months;
}

function randTx() {
  return crypto.randomBytes(12).toString('hex');
}

function clampInt(n: any, def = 0) {
  const x = Math.trunc(Number(n));
  return Number.isFinite(x) ? x : def;
}

/* ==============================
   POST
============================== */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const uid = getUidFromReq(req);

  const payMethod = String(body?.paymentMethod || body?.payMethod || '').toLowerCase();
  const useWallet = payMethod === 'wallet' || Boolean(body?.useWallet);

  // Promo decision (server-side)
  const eligible = isEligibleForPromo(body);
  const reward = eligible ? pickPromoReward() : null;
  const promoToken = reward
    ? signToken({
        kind: PROMO_KIND,
        code: reward.code,
        plan: reward.plan,
        days: reward.days,
        issuedAtISO: new Date().toISOString(),
      })
    : null;

  // ============================
  // Wallet checkout (local)
  // ============================
  if (useWallet) {
    if (!uid) return NextResponse.json({ ok: false, error: 'Missing x-uid.' }, { status: 401 });

    const items = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) return NextResponse.json({ ok: false, error: 'No items.' }, { status: 400 });

    const shippingZar = Math.max(0, clampInt(body?.shippingZar, 0));
    const discountZar = Math.max(0, clampInt(body?.discountZar, 0));

    let subtotalZar = 0;
    const cleanItems = items.map((it: any) => {
      const quantity = Math.max(1, clampInt(it?.quantity, 1));
      const unitAmountZar = Math.max(0, clampInt(it?.unitAmountZar, 0));
      subtotalZar += unitAmountZar * quantity;

      return {
        productId: String(it?.productId || 'unknown'),
        variantId: it?.variantId ? String(it.variantId) : null,
        sku: it?.sku ? String(it.sku) : null,
        name: String(it?.name || 'Item'),
        unitAmountZar,
        quantity,
      };
    });

    const totalZar = Math.max(0, subtotalZar + shippingZar - discountZar);
    if (totalZar <= 0) return NextResponse.json({ ok: false, error: 'Invalid total.' }, { status: 400 });

    const sessionId = randTx();

    const hold = await holdWallet({
      userId: uid,
      amountZar: totalZar,
      scope: 'SHOP',
      txRef: `shop:${sessionId}`,
      refType: 'shopOrder',
      refId: sessionId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    }).catch(() => null);

    if (!hold) {
      const w = await walletSummary(uid);
      return NextResponse.json(
        {
          ok: false,
          error: 'Insufficient wallet credit.',
          wallet: { availableZar: w.availableZar, balanceZar: w.balanceZar, heldZar: w.heldZar },
        },
        { status: 400 }
      );
    }

    const order = await prisma.shopOrder.create({
      data: {
        status: 'PENDING',
        channel: 'PATIENT',
        currency: 'ZAR',
        subtotalZar,
        shippingZar,
        discountZar,
        totalZar,
        promoCode: body?.promoCode ? String(body.promoCode) : null,
        customerEmail: body?.customerEmail ? String(body.customerEmail) : null,
        shippingAddress: body?.shippingAddress ?? null,
        provider: 'wallet',
        sessionId,
        providerMeta: {
          holdId: hold.id,
          uid,
          promo: reward ? { kind: PROMO_KIND, reward, token: promoToken } : { kind: PROMO_KIND, reward: null },
        },
        orgId: 'org-default',
        items: {
          create: cleanItems.map((it: any) => ({
            productId: it.productId,
            variantId: it.variantId,
            sku: it.sku,
            name: it.name,
            unitAmountZar: it.unitAmountZar,
            quantity: it.quantity,
            orgId: 'org-default',
          })),
        },
      },
      include: { items: true },
    });

    return NextResponse.json({
      ok: true,
      mode: 'wallet',
      orderId: order.id,
      sessionId,
      totalZar,
      confirmUrl: `/api/shop/confirm?sessionId=${encodeURIComponent(sessionId)}`,
      promo: {
        kind: PROMO_KIND,
        eligible,
        reward: reward ? { ...reward, token: promoToken } : null,
      },
    });
  }

  // ============================
  // Card / upstream checkout (proxy)
  // ============================
  const { channel: _ch, promoReward: _pr, promoToken: _pt, promoKind: _pk, ...rest } = body || {};
  const payload: any = {
    ...rest,
    channel: 'patient',
    ...(reward
      ? { promoKind: PROMO_KIND, promoReward: reward, promoToken }
      : { promoKind: PROMO_KIND }),
  };

  const res = await fetch(`${apigwBase()}/api/shop/checkout`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(uid ? { 'x-uid': uid } : {}),
    },
    body: JSON.stringify(payload),
  });

  const js = await res.json().catch(() => ({} as any));

  return NextResponse.json(
    {
      ...js,
      promo: {
        kind: PROMO_KIND,
        eligible,
        reward: reward ? { ...reward, token: promoToken } : null,
      },
    },
    { status: res.status }
  );
}
