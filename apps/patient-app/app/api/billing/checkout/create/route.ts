// file: apps/patient-app/app/api/billing/checkout/create/route.ts
import { NextRequest, NextResponse } from 'next/server';

type PremiumOffer = 'bundle_40_free_year' | 'annual_premium_raffle';
type Provider = 'payfast' | 'stripe' | 'eft';

type Address = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function safeInternalPath(p: unknown, fallback = '/'): string {
  if (typeof p !== 'string' || !p) return fallback;
  if (p.startsWith('/') && !p.startsWith('//')) return p;
  return fallback;
}

function getUUID() {
  // works in Node + Edge runtimes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `ord_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function parseIntEnv(name: string, fallback: number) {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as any;
  if (!body) return jsonError('Invalid JSON payload');

  const offer = String(body?.offer || '') as PremiumOffer;
  const provider = String(body?.provider || '') as Provider;
  const next = safeInternalPath(body?.next, '/');
  const address = body?.address as Address | null;

  if (offer !== 'bundle_40_free_year' && offer !== 'annual_premium_raffle') {
    return jsonError('Invalid offer');
  }
  if (provider !== 'payfast' && provider !== 'stripe' && provider !== 'eft') {
    return jsonError('Invalid payment provider');
  }

  const requiresShipping = offer === 'bundle_40_free_year';

  if (requiresShipping) {
    const a = address;
    if (!a) return jsonError('Delivery address required for bundle');
    if (!String(a.fullName || '').trim()) return jsonError('Delivery full name is required');
    if (!String(a.phone || '').trim()) return jsonError('Phone number is required');
    if (!String(a.line1 || '').trim()) return jsonError('Address line 1 is required');
    if (!String(a.city || '').trim()) return jsonError('City is required');
    if (!String(a.province || '').trim()) return jsonError('Province is required');
    if (!String(a.postalCode || '').trim()) return jsonError('Postal code is required');
    if (!String(a.country || '').trim()) return jsonError('Country is required');
  }

  // --- Pricing (override via env later) ---
  // Set these if you want real pricing without editing code:
  // CHECKOUT_CURRENCY=ZAR
  // PREMIUM_ANNUAL_PRICE_CENTS=149900
  // BUNDLE_ORIGINAL_PRICE_CENTS=3999900
  const currency = process.env.CHECKOUT_CURRENCY || 'ZAR';
  const annualCents = parseIntEnv('PREMIUM_ANNUAL_PRICE_CENTS', 1499_00);
  const bundleOriginalCents = parseIntEnv('BUNDLE_ORIGINAL_PRICE_CENTS', 39999_00);
  const bundleDiscountedCents = Math.round(bundleOriginalCents * 0.6); // 40% off

  const amountCents = offer === 'bundle_40_free_year' ? bundleDiscountedCents : annualCents;

  const orderId = getUUID();

  // --- Hosted checkout wiring (optional) ---
  // If you set one of these envs to a full https URL, we’ll redirect to it.
  // PAYFAST_HOSTED_CHECKOUT_URL="https://payfast.example/checkout"
  // STRIPE_HOSTED_CHECKOUT_URL="https://stripe.example/checkout"
  // EFT_HOSTED_CHECKOUT_URL="https://yourbankflow.example/eft"
  const hostedBase =
    provider === 'payfast'
      ? process.env.PAYFAST_HOSTED_CHECKOUT_URL
      : provider === 'stripe'
        ? process.env.STRIPE_HOSTED_CHECKOUT_URL
        : process.env.EFT_HOSTED_CHECKOUT_URL;

  let payUrl = '';
  if (hostedBase && /^https?:\/\//i.test(hostedBase)) {
    // Append identifiers so hosted provider can call you back with orderId
    const u = new URL(hostedBase);
    u.searchParams.set('orderId', orderId);
    u.searchParams.set('offer', offer);
    u.searchParams.set('amountCents', String(amountCents));
    u.searchParams.set('currency', currency);
    u.searchParams.set('next', next);
    payUrl = u.toString();
  } else {
    // Internal pay step (dev-ready + works now)
    payUrl = `/billing/checkout/pay?orderId=${encodeURIComponent(orderId)}`;
  }

  return NextResponse.json(
    {
      ok: true,
      orderId,
      offer,
      provider,
      currency,
      amountCents,
      requiresShipping,
      next,
      payUrl,
    },
    { status: 200 },
  );
}
