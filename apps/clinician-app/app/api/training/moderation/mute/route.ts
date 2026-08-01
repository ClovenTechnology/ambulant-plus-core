import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function base() {
  return String(
    process.env.APIGW_BASE_URL ||
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_URL ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
    process.env.GATEWAY_URL ||
    '',
  ).trim().replace(/\/+$/, '');
}

function joinTokenFromReferer(request: NextRequest) {
  try {
    const referer = request.headers.get('referer') || '';
    if (!referer) return '';
    const url = new URL(referer);
    return url.searchParams.get('joinToken') || url.searchParams.get('jt') || '';
  } catch {
    return '';
  }
}

export async function POST(request: NextRequest) {
  const gateway = base();
  if (!gateway) {
    return NextResponse.json({ ok: false, error: 'api_gateway_not_configured' }, { status: 500 });
  }

  const bodyText = await request.text();
  let body: any = {};
  try {
    body = JSON.parse(bodyText || '{}');
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const token = String(
    request.headers.get('x-join-token') ||
    body.moderatorToken ||
    body.joinToken ||
    joinTokenFromReferer(request) ||
    '',
  ).trim();

  if (!token) {
    return NextResponse.json({ ok: false, error: 'training_admission_required' }, { status: 401 });
  }

  const response = await fetch(`${gateway}/api/rtc/training/moderation/mute`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-join-token': token,
    },
    body: JSON.stringify({ ...body, moderatorToken: undefined, joinToken: undefined }),
    cache: 'no-store',
  });

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/json',
      'cache-control': 'no-store',
    },
  });
}