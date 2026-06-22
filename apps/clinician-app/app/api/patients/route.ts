// apps/clinician-app/app/api/patients/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  authErrorResponse,
  requireClinicianAuth,
} from '@/src/lib/clinician-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function gatewayBase() {
  return (
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    process.env.APIGW_BASE ||
    ''
  ).replace(/\/+$/, '');
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function GET(req: NextRequest) {
  const gateway = gatewayBase();

  if (!gateway) {
    return json({ ok: false, error: 'api_gateway_url_missing', items: [] }, 500);
  }

  const auth = await requireClinicianAuth(req, {
    allowAdmin: true,
    allowAdminStaff: true,
  });

  if (!auth.ok) return authErrorResponse(auth);

  try {
    const incoming = new URL(req.url);
    const upstream = new URL('/api/patients', gateway);

    incoming.searchParams.forEach((value, key) => {
      upstream.searchParams.set(key, value);
    });

    if (auth.role === 'clinician' && auth.clinicianId) {
      upstream.searchParams.set('clinicianId', auth.clinicianId);
    }

    const r = await fetch(upstream.toString(), {
      headers: {
        accept: 'application/json',
        'x-role': auth.role,
        'x-uid': auth.clinicianId || '',
        'x-clinician-id': auth.clinicianId || '',
      },
      cache: 'no-store',
    });

    const payload = await r.json().catch(() => ({}));

    return json(payload, r.status);
  } catch (e: any) {
    return json(
      { ok: false, error: e?.message || 'patients_proxy_failed', items: [] },
      502,
    );
  }
}
