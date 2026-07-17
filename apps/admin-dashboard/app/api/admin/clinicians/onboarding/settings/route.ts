import { NextRequest, NextResponse } from 'next/server';
import { requireAdminCaller } from '../_helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function gatewayBase() {
  const raw =
    process.env.APIGW_BASE ||
    process.env.APIGW_BASE_URL ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    '';

  const gateway = raw.trim().replace(/\/+$/, '');
  if (!gateway) {
    throw new Error('gateway_base_not_configured');
  }

  return gateway;
}

function buildForwardHeaders(req: NextRequest, hasBody = false) {
  const headers = new Headers();

  headers.set('accept', 'application/json');

  if (hasBody) {
    headers.set('content-type', 'application/json');
  }

  const cookie = req.headers.get('cookie');
  if (cookie) {
    headers.set('cookie', cookie);
  }

  const authorization = req.headers.get('authorization');
  if (authorization) {
    headers.set('authorization', authorization);
  }

  const adminKey = process.env.ADMIN_API_KEY?.trim();
  if (adminKey) {
    headers.set('x-admin-key', adminKey);
  }

  return headers;
}

async function proxyJson(req: NextRequest, method: 'GET' | 'PATCH') {
  const caller =
    await requireAdminCaller(req);

  if (!caller.ok) {
    return caller.response;
  }

  const url = `${gatewayBase()}/api/admin/clinicians/onboarding/settings`;

  const body =
    method === 'PATCH'
      ? JSON.stringify(await req.json().catch(() => ({})))
      : undefined;

  const res = await fetch(url, {
    method,
    headers: buildForwardHeaders(req, method === 'PATCH'),
    body,
    cache: 'no-store',
  });

  const text = await res.text();
  const contentType = res.headers.get('content-type') || 'application/json';

  return new NextResponse(text, {
    status: res.status,
    headers: {
      'content-type': contentType,
      'cache-control': 'no-store',
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    return await proxyJson(req, 'GET');
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'onboarding_settings_proxy_get_failed',
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    return await proxyJson(req, 'PATCH');
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'onboarding_settings_proxy_patch_failed',
      },
      { status: 500 },
    );
  }
}
