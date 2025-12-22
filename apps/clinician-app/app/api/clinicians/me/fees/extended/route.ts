// apps/clinician-app/app/api/clinicians/me/fees/extended/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GW =
  process.env.APIGW_BASE?.replace(/\/+$/, '') ||
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN?.replace(/\/+$/, '') ||
  process.env.NEXT_PUBLIC_GATEWAY_BASE?.replace(/\/+$/, '') ||
  '';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

// GET → proxy to gateway /api/clinicians/me/fees/extended
export async function GET(_req: NextRequest) {
  if (!GW) {
    return json(
      { ok: false, error: 'missing_gateway_origin' },
      500,
    );
  }
  try {
    const res = await fetch(
      `${GW}/api/clinicians/me/fees/extended`,
      {
        cache: 'no-store',
        headers: {
          // dev stub identity – swap with real auth later
          'x-uid': 'clinician-local-001',
          'x-role': 'clinician',
        },
      },
    );

    const body = await res.json().catch(() => ({} as any));
    return json(body, res.status);
  } catch (err: any) {
    console.error(
      '[clinician-app] fees/extended GET proxy error',
      err,
    );
    return json(
      { ok: false, error: err?.message || 'gateway_failed' },
      500,
    );
  }
}

// PUT → proxy to gateway /api/clinicians/me/fees/extended
export async function PUT(req: NextRequest) {
  if (!GW) {
    return json(
      { ok: false, error: 'missing_gateway_origin' },
      500,
    );
  }
  try {
    const payload = await req.json().catch(() => ({} as any));

    const res = await fetch(
      `${GW}/api/clinicians/me/fees/extended`,
      {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-uid': 'clinician-local-001',
          'x-role': 'clinician',
        },
        body: JSON.stringify(payload),
      },
    );

    const body = await res.json().catch(() => ({} as any));
    return json(body, res.status);
  } catch (err: any) {
    console.error(
      '[clinician-app] fees/extended PUT proxy error',
      err,
    );
    return json(
      { ok: false, error: err?.message || 'gateway_failed' },
      500,
    );
  }
}
