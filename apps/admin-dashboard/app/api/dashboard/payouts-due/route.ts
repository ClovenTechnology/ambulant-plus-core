import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';
import { requireAdminApiSession } from '@/app/api/_adminApiSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cents(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(0, Math.trunc(number))
    : 0;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiSession(
    req,
    [
      'finance:read',
      'finance:manage',
      'finance',
    ],
  );

  if (!auth.ok) return auth.response;

  const target = new URL('/api/finance/payouts', apigwBase());
  target.searchParams.set('status', 'pending');
  target.searchParams.set('limit', '200');

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

    if (!upstream.ok || body?.ok === false) {
      return NextResponse.json(
        {
          ok: false,
          error: body?.error || 'payouts_upstream_failed',
        },
        {
          status: upstream.status || 502,
          headers: {
            'cache-control': 'no-store',
          },
        },
      );
    }

    const items = Array.isArray(body?.items)
      ? body.items
      : [];

    return NextResponse.json(
      {
        ok: true,
        count: items.length,
        totalCents: items.reduce(
          (sum: number, item: any) =>
            sum + cents(item?.amountCents),
          0,
        ),
        currency: 'ZAR',
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
        error: 'payouts_upstream_unavailable',
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
