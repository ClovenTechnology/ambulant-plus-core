import { NextRequest, NextResponse } from 'next/server';

const APIGW =
  process.env.APIGW_BASE ||
  process.env.APIGW_BASE_URL ||
  process.env.API_GATEWAY_BASE_URL ||
  process.env.API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_APIGW_BASE ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  'http://localhost:3010';

function gatewayBase() {
  return APIGW.replace(/\/+$/, '');
}

function recordingAdminKey() {
  return (
    process.env.TRAINING_RECORDING_ADMIN_KEY ||
    process.env.ADMIN_API_KEY ||
    ''
  ).trim();
}

async function readJsonSafe(res: Response) {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { ok: false, error: text || res.statusText };
  }
}

async function requireAdminSession(req: NextRequest) {
  const upstream = await fetch(`${gatewayBase()}/api/auth/me`, {
    method: 'GET',
    headers: {
      cookie: req.headers.get('cookie') || '',
      'x-admin-origin': req.nextUrl.origin,
    },
    cache: 'no-store',
  });

  if (!upstream.ok) {
    return false;
  }

  const data = await readJsonSafe(upstream);
  return data?.authenticated === true;
}

export async function proxyRecordingRequest(
  req: NextRequest,
  upstreamPath: string,
  method: 'GET' | 'POST',
) {
  try {
    const authenticated = await requireAdminSession(req);

    if (!authenticated) {
      return NextResponse.json(
        {
          ok: false,
          error: 'admin_session_required',
          message: 'Please sign in to the Admin Dashboard before controlling recordings.',
        },
        { status: 401, headers: { 'cache-control': 'no-store' } },
      );
    }

    const key = recordingAdminKey();

    if (!key) {
      return NextResponse.json(
        {
          ok: false,
          error: 'missing_training_recording_admin_key',
          message: 'TRAINING_RECORDING_ADMIN_KEY is missing on the Admin Dashboard project.',
        },
        { status: 500, headers: { 'cache-control': 'no-store' } },
      );
    }

    const upstreamUrl = new URL(`${gatewayBase()}${upstreamPath}`);

    if (method === 'GET') {
      req.nextUrl.searchParams.forEach((value, name) => {
        upstreamUrl.searchParams.set(name, value);
      });
    }

    const body = method === 'POST' ? await req.text() : undefined;

    const upstream = await fetch(upstreamUrl.toString(), {
      method,
      headers: {
        accept: 'application/json',
        'content-type': req.headers.get('content-type') || 'application/json',
        'x-admin-key': key,
      },
      body,
      cache: 'no-store',
    });

    const data = await readJsonSafe(upstream);

    return NextResponse.json(data, {
      status: upstream.status,
      headers: { 'cache-control': 'no-store' },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: 'recording_proxy_failed',
        message: String(err?.message || err || 'recording_proxy_failed'),
      },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    );
  }
}
