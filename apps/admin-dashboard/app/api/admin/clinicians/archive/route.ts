// apps/admin-dashboard/app/api/admin/clinicians/archive/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';
import { gatewayProxyHeaders } from '@/src/lib/gateway-proxy';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const id = body?.id;

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: 'id required',
        },
        {
          status: 400,
        },
      );
    }

    const base = apigwBase();

    if (!base) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing API gateway base',
        },
        {
          status: 500,
        },
      );
    }

    const res = await fetch(
      `${base}/api/clinicians`,
      {
        method: 'DELETE',
        cache: 'no-store',
        headers: gatewayProxyHeaders(req),
        body: JSON.stringify({
          id,
        }),
      },
    );

    const text = await res.text();

    if (!res.ok) {
      return new NextResponse(
        text,
        {
          status: res.status,
        },
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (err: any) {
    console.error(
      'admin/clinicians/archive error',
      err,
    );

    return NextResponse.json(
      {
        ok: false,
        error: String(err),
      },
      {
        status: 500,
      },
    );
  }
}