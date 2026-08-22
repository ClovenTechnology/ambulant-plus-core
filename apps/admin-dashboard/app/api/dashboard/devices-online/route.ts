import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';
import { requireAdminApiSession } from '@/app/api/_adminApiSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiSession(
    req,
    [
      'devices:read',
      'devices:manage',
      'tech:read',
      'tech:manage',
      'tech',
    ],
  );

  if (!auth.ok) return auth.response;

  const rawWindow = Number(req.nextUrl.searchParams.get('window') || '300');
  const windowSeconds = Number.isFinite(rawWindow)
    ? Math.max(30, Math.min(24 * 60 * 60, Math.trunc(rawWindow)))
    : 300;

  const target = new URL('/api/devices/online', apigwBase());
  target.searchParams.set('window', String(windowSeconds));

  try {
    const upstream = await fetch(
      target,
      {
        method: 'GET',
        headers: auth.gatewayHeaders,
        cache: 'no-store',
      },
    );

    const body = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: body?.error || 'devices_online_upstream_failed',
        },
        {
          status: upstream.status,
          headers: {
            'cache-control': 'no-store',
          },
        },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        count: Number.isFinite(Number(body?.count))
          ? Number(body.count)
          : 0,
        windowSeconds,
        since: body?.since || null,
      },
      {
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  }
  catch {
    return NextResponse.json(
      {
        ok: false,
        error: 'devices_online_upstream_unavailable',
      },
      {
        status: 503,
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  }
}
