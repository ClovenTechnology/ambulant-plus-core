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

  const uid = req.headers.get('x-uid') || '';
  const role = req.headers.get('x-role') || '';
  const joinToken = req.headers.get('x-join-token') || '';

  let bodyText = '';
  try {
    bodyText = await req.text();
  } catch {
    bodyText = '';
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
