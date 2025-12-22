// apps/clinician-app/app/api/clinicians/me/admin-staff/[id]/route.ts
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

// DELETE /api/clinicians/me/admin-staff/[id] -> gateway proxy
export async function DELETE(
  _req: NextRequest,
  ctx: { params: { id: string } },
) {
  if (!GW) return missingGateway();

  const id = ctx.params.id;

  try {
    const res = await fetch(
      `${GW}/api/clinicians/me/admin-staff/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: {
          ...clinicianHeaders(),
        },
      },
    );

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
      '[clinician-app] admin-staff DELETE proxy error',
      err,
    );
    return json(
      { ok: false, error: err?.message || 'gateway_unreachable' },
      502,
    );
  }
}
