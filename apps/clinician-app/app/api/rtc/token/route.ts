import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function trimSlash(s: string) {
  return String(s || '').replace(/\/+$/, '');
}

function envFirst(names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return '';
}

function pickBase() {
  return (
    process.env.APIGW_BASE_URL ||
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_URL ||
    process.env.API_GATEWAY_BASE_URL ||
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

function normaliseWsUrl(value: string) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (v.startsWith('wss://') || v.startsWith('ws://')) return v;
  if (v.startsWith('https://')) return `wss://${v.slice('https://'.length)}`;
  if (v.startsWith('http://')) return `ws://${v.slice('http://'.length)}`;
  return v;
}

function isTrainingRoom(body: any) {
  const roomId = String(body?.roomId || body?.room || '').trim();
  const uid = String(body?.uid || body?.identity || body?.user || '').trim();

  return (
    roomId.startsWith('training-') &&
    (uid.startsWith('training-clinician-') || uid.startsWith('training-room-'))
  );
}

async function mintTrainingToken(body: any) {
  const roomId = String(body?.roomId || body?.room || '').trim();
  const uid = String(body?.uid || body?.identity || body?.user || '').trim();
  const role = String(body?.role || 'clinician').trim() || 'clinician';

  if (!roomId || !uid) {
    return safeJson(400, {
      ok: false,
      error: 'training_room_or_uid_missing',
    });
  }

  const livekitKey = envFirst(['LIVEKIT_API_KEY', 'LK_API_KEY']);
  const livekitSecret = envFirst(['LIVEKIT_API_SECRET', 'LK_API_SECRET']);
  const livekitUrl = normaliseWsUrl(
    envFirst([
      'LIVEKIT_WS_URL',
      'LIVEKIT_URL',
      'NEXT_PUBLIC_LIVEKIT_WS_URL',
      'NEXT_PUBLIC_LIVEKIT_URL',
      'LK_WS_URL',
      'LK_URL',
    ]),
  );

  if (!livekitKey || !livekitSecret || !livekitUrl) {
    return safeJson(500, {
      ok: false,
      error: 'server_misconfig_missing_livekit_credentials',
      message: 'Missing LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL/LIVEKIT_WS_URL on clinician-app.',
    });
  }

  const { AccessToken } = await import('livekit-server-sdk');

  const at = new AccessToken(livekitKey, livekitSecret, {
    identity: uid,
    name: uid,
  });

  at.addGrant({
    room: roomId,
    roomJoin: true,
    canPublish: role !== 'observer',
    canPublishData: role !== 'observer',
    canSubscribe: true,
  });

  const token = await at.toJwt();

  return safeJson(200, {
    ok: true,
    provider: 'livekit',
    mode: 'training_room_direct',
    wsUrl: livekitUrl,
    token,
    roomId,
    identity: uid,
    role,
  });
}

async function proxyToGateway(req: NextRequest, bodyText: string, body: any) {
  const joinToken =
    req.headers.get('x-join-token') ||
    req.nextUrl.searchParams.get('joinToken') ||
    req.nextUrl.searchParams.get('jt') ||
    '';

  if (!joinToken && isTrainingRoom(body)) {
    return mintTrainingToken(body);
  }

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
    const body = JSON.parse(bodyText || '{}');
    return proxyToGateway(req, bodyText || '{}', body);
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
    const body = bodyFromQuery(req);
    return proxyToGateway(req, JSON.stringify(body), body);
  } catch (err) {
    console.error('[clinician-app][rtc/token][GET] failed', err);
    return safeJson(502, {
      ok: false,
      error: 'Unable to prepare the video room right now. Please try again shortly.',
    });
  }
}

