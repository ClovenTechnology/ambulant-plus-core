// apps/admin-dashboard/app/api/admin/clinicians/disable/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const id = body?.id;
    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'id required' },
        { status: 400 },
      );
    }

    const gatewayBase =
      process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ??
      process.env.APIGW_BASE ??
      process.env.NEXT_PUBLIC_GATEWAY_BASE ??
      ((process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') ? 'https://api-gateway.ambulantplus.co.za' : 'http://localhost:3010');

    const url = `${gatewayBase}/api/clinicians`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-admin-key': process.env.ADMIN_API_KEY ?? '',
      },
      body: JSON.stringify({ id, status: 'disabled',
      disabled: true,
      archived: false,
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      return new NextResponse(text, { status: res.status });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('admin/clinicians/disable error', err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    );
  }
}
