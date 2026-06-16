// apps/patient-app/app/api/rtc/token/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function trimSlash(s: string) {
  return s.replace(/\/+$/, '');
}

function pickBase() {
  return (
    process.env.APIGW_BASE_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    ''
  ).trim();
}

export async function POST(req: NextRequest) {
  const base = pickBase();
  if (!base) {
    return NextResponse.json(
      { ok: false, error: 'Missing APIGW_BASE_URL (or NEXT_PUBLIC_APIGW_BASE)' },
      { status: 500 },
    );
  }

  const url = `${trimSlash(base)}/api/rtc/token`;

  let bodyText = '';
  try {
    bodyText = await req.text();
  } catch {
    bodyText = '';
  }

  let body: any = {};
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    body = {};
  }

  const refererJoinToken = (() => {
    try {
      const ref = req.headers.get('referer') || '';
      if (!ref) return '';
      const url = new URL(ref);
      return url.searchParams.get('joinToken') || url.searchParams.get('jt') || '';
    } catch {
      return '';
    }
  })();

  const uid =
    req.headers.get('x-uid') ||
    req.nextUrl.searchParams.get('uid') ||
    req.nextUrl.searchParams.get('identity') ||
    String(body?.uid || body?.identity || body?.user || body?.participantId || '').trim();

  const role =
    req.headers.get('x-role') ||
    req.nextUrl.searchParams.get('role') ||
    String(body?.role || body?.participantRole || 'patient').trim() ||
    'patient';

  const joinToken =
    req.headers.get('x-join-token') ||
    req.nextUrl.searchParams.get('joinToken') ||
    req.nextUrl.searchParams.get('jt') ||
    String(body?.joinToken || body?.jt || body?.ticket?.token || '').trim() ||
    refererJoinToken ||
    '';

  if (joinToken && body && typeof body === 'object' && !Array.isArray(body) && !body.joinToken) {
    bodyText = JSON.stringify({ ...body, joinToken });
  }

  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-uid': uid,
      'x-role': role,
      'x-join-token': joinToken,
    },
    body: bodyText || '{}',
    cache: 'no-store',
  });

  const text = await upstream.text().catch(() => '');
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function GET() {
  return NextResponse.json({ ok: false, error: 'Method not allowed. Use POST.' }, { status: 405 });
}
