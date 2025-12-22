// apps/clinician-app/app/api/clinicians/me/payout-settings/route.ts
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

function missingGateway() {
  return json(
    { ok: false, error: 'missing_gateway_origin' },
    500,
  );
}

// Dev stub identity – replace with real auth later
function clinicianHeaders() {
  return {
    'x-uid': 'clinician-local-001',
    'x-role': 'clinician',
  };
}

export async function GET(_req: NextRequest) {
  if (!GW) return missingGateway();

  try {
    const res = await fetch(`${GW}/api/clinicians/me/payout-settings`, {
      method: 'GET',
      headers: {
        ...clinicianHeaders(),
      },
      cache: 'no-store',
    });

    const js = await res.json().catch(() => null);
    if (!js) {
      return json(
        { ok: false, error: 'invalid_gateway_response' },
        502,
      );
    }

    return json(js, res.status);
  } catch (err: any) {
    console.error(
      '[clinician-app] payout-settings GET proxy error',
      err,
    );
    return json(
      { ok: false, error: err?.message || 'gateway_unreachable' },
      502,
    );
  }
}

export async function PUT(req: NextRequest) {
  if (!GW) return missingGateway();

  try {
    const body = await req.json().catch(() => ({} as any));

    const res = await fetch(`${GW}/api/clinicians/me/payout-settings`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        ...clinicianHeaders(),
      },
      body: JSON.stringify(body),
    });

    const js = await res.json().catch(() => null);
    if (!js) {
      return json(
        { ok: false, error: 'invalid_gateway_response' },
        502,
      );
    }

    return json(js, res.status);
  } catch (err: any) {
    console.error(
      '[clinician-app] payout-settings PUT proxy error',
      err,
    );
    return json(
      { ok: false, error: err?.message || 'gateway_unreachable' },
      502,
    );
  }
}
