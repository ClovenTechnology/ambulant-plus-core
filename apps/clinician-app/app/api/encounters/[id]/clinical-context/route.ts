import { NextRequest, NextResponse } from 'next/server';
import {
  authErrorResponse,
  requireClinicianAuth,
} from '@/src/lib/clinician-auth';
import {
  createTrustedClinicianIdentityHeader,
} from '@/src/lib/clinician-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANONICAL_API_GATEWAY = 'https://api-gateway.ambulantplus.co.za';

function gatewayBase() {
  return String(
    process.env.APIGW_BASE ||
      process.env.API_GATEWAY_URL ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
      CANONICAL_API_GATEWAY,
  )
    .trim()
    .replace(/\/+$/, '');
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireClinicianAuth(req, {
    allowAdmin: true,
    allowAdminStaff: true,
  });
  if (!auth.ok) return authErrorResponse(auth);

  const encounterId = clean(params.id, 120);
  if (!encounterId) {
    return NextResponse.json(
      { ok: false, error: 'encounter_id_required' },
      { status: 400, headers: { 'cache-control': 'no-store' } },
    );
  }

  let trustedIdentity: string;
  try {
    trustedIdentity = createTrustedClinicianIdentityHeader(req);
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: clean(error?.message, 500) || 'identity_bridge_failed' },
      {
        status: Number(error?.status || 500),
        headers: { 'cache-control': 'no-store' },
      },
    );
  }

  const target = new URL(
    `/api/encounters/${encodeURIComponent(encounterId)}/clinical-context`,
    gatewayBase(),
  );

  for (const key of ['appointmentId', 'roomId']) {
    const value = req.nextUrl.searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  }

  try {
    const upstream = await fetch(target, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-ambulant-identity': trustedIdentity,
        ...(req.headers.get('x-request-id')
          ? { 'x-request-id': String(req.headers.get('x-request-id')) }
          : {}),
        ...(req.headers.get('x-correlation-id')
          ? { 'x-correlation-id': String(req.headers.get('x-correlation-id')) }
          : {}),
      },
      cache: 'no-store',
    });

    const payload = await upstream.json().catch(() => ({
      ok: false,
      error: `clinical_context_upstream_${upstream.status}`,
    }));

    return NextResponse.json(payload, {
      status: upstream.status,
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: 'clinical_context_gateway_unreachable',
        message: clean(error?.message, 500),
      },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
}
