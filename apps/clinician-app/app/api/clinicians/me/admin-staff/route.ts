// apps/clinician-app/app/api/clinicians/me/admin-staff/route.ts
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

// GET /api/clinicians/me/admin-staff  -> proxy to gateway
export async function GET(_req: NextRequest) {
  if (!GW) return missingGateway();

  try {
    const res = await fetch(`${GW}/api/clinicians/me/admin-staff`, {
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
      '[clinician-app] admin-staff GET proxy error',
      err,
    );
    return json(
      { ok: false, error: err?.message || 'gateway_unreachable' },
      502,
    );
  }
}

// POST /api/clinicians/me/admin-staff  -> proxy to gateway
export async function POST(req: NextRequest) {
  if (!GW) return missingGateway();

  try {
    const body = await req.json().catch(() => ({} as any));

    const res = await fetch(`${GW}/api/clinicians/me/admin-staff`, {
      method: 'POST',
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
      '[clinician-app] admin-staff POST proxy error',
      err,
    );
    return json(
      { ok: false, error: err?.message || 'gateway_unreachable' },
      502,
    );
  }
}
