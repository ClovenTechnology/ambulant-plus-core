// file: apps/patient-app/app/api/auth/premium-signup/route.ts
import { NextRequest, NextResponse } from 'next/server';

type PremiumOffer = 'bundle_40_free_year' | 'annual_premium_raffle';

type SignupResponse = {
  ok?: boolean;
  token?: string;
  profile?: any;
  error?: string;
  message?: string;
  redirectTo?: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function safeInternalPath(p: unknown, fallback = '/'): string {
  if (typeof p !== 'string' || !p) return fallback;
  if (p.startsWith('/') && !p.startsWith('//')) return p;
  return fallback;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as any;
  if (!body) return jsonError('Invalid JSON payload');

  const name = String(body?.name || '').trim().replace(/\s+/g, ' ');
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  const offer = String(body?.offer || '') as PremiumOffer;

  const redirectTo = safeInternalPath(body?.redirectTo, '/');
  const marketingOk = Boolean(body?.marketingOk);

  if (!name) return jsonError('Full name is required');
  if (!email) return jsonError('Email is required');
  if (!password) return jsonError('Password is required');
  if (password.length < 8) return jsonError('Password must be at least 8 characters');

  if (offer !== 'bundle_40_free_year' && offer !== 'annual_premium_raffle') {
    return jsonError('Invalid offer selection');
  }

  // 1) Create account by delegating to the existing signup endpoint
  //    (keeps your auth logic in ONE place).
  const signupUrl = new URL('/api/auth/signup', req.url);

  const signupRes = await fetch(signupUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });

  const signupData = (await signupRes.json().catch(() => ({} as SignupResponse))) as SignupResponse;

  if (!signupRes.ok || signupData?.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        error: signupData?.error || signupData?.message || 'Sign up failed',
      },
      { status: signupRes.status || 400 },
    );
  }

  // 2) Optional: return a checkout URL if you have payment links wired.
  //    You can set either server-only or NEXT_PUBLIC vars.
  //
  // Recommended env vars:
  // - PREMIUM_CHECKOUT_BUNDLE_URL="https://pay.example.com/checkout/bundle"
  // - PREMIUM_CHECKOUT_ANNUAL_URL="https://pay.example.com/checkout/annual"
  //
  // This handler will append offer/email/next as query params if URL is parseable.
  const bundleBase =
    process.env.PREMIUM_CHECKOUT_BUNDLE_URL || process.env.NEXT_PUBLIC_PREMIUM_CHECKOUT_BUNDLE_URL || '';
  const annualBase =
    process.env.PREMIUM_CHECKOUT_ANNUAL_URL || process.env.NEXT_PUBLIC_PREMIUM_CHECKOUT_ANNUAL_URL || '';

  const base = offer === 'bundle_40_free_year' ? bundleBase : annualBase;

  let checkoutUrl = '';
  if (base) {
    try {
      const u = new URL(base);
      u.searchParams.set('offer', offer);
      u.searchParams.set('email', email);
      u.searchParams.set('next', redirectTo);
      u.searchParams.set('marketingOk', marketingOk ? '1' : '0');
      checkoutUrl = u.toString();
    } catch {
      // If it's not a valid absolute URL, treat it as a raw string (could be a relative path you handle later)
      checkoutUrl = base;
    }
  }

  // 3) Return everything your client expects + premium metadata
  return NextResponse.json(
    {
      ...signupData,
      ok: true,
      offer,
      checkoutUrl: checkoutUrl || undefined,

      // If no checkout is configured, fall back to normal redirect.
      redirectTo: signupData?.redirectTo ? safeInternalPath(signupData.redirectTo, redirectTo) : redirectTo,
      premiumIntent: {
        offer,
        marketingOk,
        createdAt: new Date().toISOString(),
      },
    },
    { status: 200 },
  );
}
