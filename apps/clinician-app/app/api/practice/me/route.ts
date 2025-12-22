// apps/clinician-app/app/api/practice/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const APIGW =
  process.env.APIGW_BASE ??
  process.env.NEXT_PUBLIC_APIGW_BASE ??
  'http://localhost:3010';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = cookies();

    // This is the same anon UID concept you use on the client;
    // swap to your real auth user id if you have it.
    const uid =
      cookieStore.get('ambulant_uid')?.value ??
      cookieStore.get('user_id')?.value ??
      '';

    const url = new URL('/api/practice/me', APIGW);

    const upstream = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-uid': uid,
        'x-role': 'clinician',
      },
      cache: 'no-store',
    });

    const body = await upstream.json().catch(() => ({}));

    return NextResponse.json(body, { status: upstream.status });
  } catch (err: any) {
    console.error('[clinician-app] /api/practice/me proxy error', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Proxy failed' },
      { status: 500 },
    );
  }
}
