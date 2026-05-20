// apps/patient-app/app/api/reminder-push/subscribe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { API } from '@/src/lib/config';

type RawPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

function gatewayBase() {
  return String(API || '').replace(/\/+$/, '');
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();

  for (const key of [
    'authorization',
    'cookie',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-patient-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
    'x-user-id',
    'x-uid',
    'x-role',
    'x-correlation-id',
    'x-request-id',
  ]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('accept', 'application/json');
  headers.set('content-type', 'application/json');

  return headers;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const subscription = body?.subscription as RawPushSubscription | undefined;

    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json(
        { ok: false, error: 'invalid_push_subscription' },
        { status: 400 },
      );
    }

    const base = gatewayBase();
    if (!base) {
      return NextResponse.json(
        {
          ok: false,
          error: 'api_gateway_base_required',
          message: 'Reminder push subscriptions require a configured API gateway and durable subscription store.',
        },
        { status: 503 },
      );
    }

    const userAgent = req.headers.get('user-agent') ?? null;
    const upstream = new URL(`${base}/api/reminder-push/subscribe`);

    const res = await fetch(upstream.toString(), {
      method: 'POST',
      cache: 'no-store',
      headers: forwardHeaders(req),
      body: JSON.stringify({ ...body, subscription, userAgent }),
    });

    const text = await res.text().catch(() => '');
    const data = text ? (() => { try { return JSON.parse(text); } catch { return { raw: text }; } })() : null;

    return NextResponse.json(
      data && typeof data === 'object' ? { ok: res.ok, ...data } : { ok: res.ok, data },
      { status: res.status },
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'reminder_push_subscribe_failed' },
      { status: 502 },
    );
  }
}
