// apps/clinician-app/app/api/rtc/token/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function trimSlash(s: string) {
  return String(s || '').replace(/\/+$/, '');
}

function pickBase() {
  return (
    process.env.APIGW_BASE_URL ||
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    ''
  ).trim();
}

function safeJson(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

function forwardHeaders(req: NextRequest) {
  const h = new Headers();

  h.set('content-type', 'application/json');

  const uid =
    req.headers.get('x-uid') ||
    req.nextUrl.searchParams.get('uid') ||
    req.nextUrl.searchParams.get('identity') ||
    '';

  const role =
    req.headers.get('x-role') ||
    req.nextUrl.searchParams.get('role') ||
    'clinician';

  const joinToken =
    req.headers.get('x-join-token') ||
    req.nextUrl.searchParams.get('joinToken') ||
    req.nextUrl.searchParams.get('jt') ||
    '';

  if (uid) h.set('x-uid', uid);
  if (role) h.set('x-role', role);
  if (joinToken) h.set('x-join-token', joinToken);

  const cookie = req.headers.get('cookie');
  if (cookie) h.set('cookie', cookie);

  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (auth) h.set('authorization', auth);

  return h;
}

function bodyFromQuery(req: NextRequest) {
  const roomId =
    req.nextUrl.searchParams.get('roomId') ||
    req.nextUrl.searchParams.get('room') ||
    '';

  const uid =
    req.nextUrl.searchParams.get('uid') ||
    req.nextUrl.searchParams.get('identity') ||
    req.nextUrl.searchParams.get('user') ||
    '';

  const role = req.nextUrl.searchParams.get('role') || 'clinician';

  return {
    roomId,
    room: roomId,
    uid,
    identity: uid,
    user: uid,
    role,
    visitId: req.nextUrl.searchParams.get('visitId') || undefined,
    trainingSlotId: req.nextUrl.searchParams.get('trainingSlotId') || undefined,
  };
}

async function proxyToGateway(req: NextRequest, bodyText: string) {
  const base = pickBase();

  if (!base) {
    return safeJson(503, {
      ok: false,
      error: 'Video room service is not configured yet. Please contact Ambulant+ support.',
    });
  }

  const upstream = await fetch(`${trimSlash(base)}/api/rtc/token`, {
    method: 'POST',
    headers: forwardHeaders(req),
    body: bodyText || '{}',
    cache: 'no-store',
  });

  const text = await upstream.text().catch(() => '');

  return new NextResponse(text || JSON.stringify({ ok: upstream.ok }), {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text().catch(() => '{}');
    return proxyToGateway(req, bodyText || '{}');
  } catch (err) {
    console.error('[clinician-app][rtc/token][POST] failed', err);
    return safeJson(502, {
      ok: false,
      error: 'Unable to prepare the video room right now. Please try again shortly.',
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    return proxyToGateway(req, JSON.stringify(bodyFromQuery(req)));
  } catch (err) {
    console.error('[clinician-app][rtc/token][GET] failed', err);
    return safeJson(502, {
      ok: false,
      error: 'Unable to prepare the video room right now. Please try again shortly.',
    });
  }
}
