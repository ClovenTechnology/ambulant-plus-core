// apps/clinician-app/app/api/clinicians/me/admin-staff/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authErrorResponse, requireClinicianAuth } from '@/src/lib/clinician-auth';
import { createTrustedClinicianIdentityHeader } from '@/src/lib/clinician-session';

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


// DELETE /api/clinicians/me/admin-staff/[id] -> gateway proxy
export async function DELETE(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  if (!GW) return missingGateway();
  const auth = await requireClinicianAuth(req, { allowAdmin: true, allowAdminStaff: true });
  if (!auth.ok) return authErrorResponse(auth);

  const id = ctx.params.id;

  try {
    const res = await fetch(
      `${GW}/api/clinicians/me/admin-staff/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: {
          'x-ambulant-identity': createTrustedClinicianIdentityHeader(req),
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
