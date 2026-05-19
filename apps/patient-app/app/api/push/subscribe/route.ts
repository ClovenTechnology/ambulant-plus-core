// apps/patient-app/app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Production-safe push subscription route.
 *
 * The previous implementation stored subscriptions in process memory and exported
 * helper functions from a route file. That is not production-safe and can break
 * Next App Router type validation.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const endpoint = String(body?.subscription?.endpoint || '').trim();

  if (!endpoint) {
    return NextResponse.json(
      { ok: false, error: 'bad_subscription' },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: 'push_subscription_store_not_configured',
      message:
        'Push subscriptions are disabled until a durable notification-token store is connected.',
    },
    { status: 503 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      ok: false,
      error: 'push_subscription_store_not_configured',
    },
    { status: 503 },
  );
}