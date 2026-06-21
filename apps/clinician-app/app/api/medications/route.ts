// apps/clinician-app/app/api/medications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authErrorResponse, requireClinicianAuth } from '@/src/lib/clinician-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GW =
  process.env.API_GATEWAY_URL?.replace(/\/+$/, '') ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL?.replace(/\/+$/, '') ||
  process.env.APIGW_BASE?.replace(/\/+$/, '') ||
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN?.replace(/\/+$/, '') ||
  '';

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function clinicianUid(auth: any) {
  return String(
    auth?.clinicianId ||
      auth?.clinician?.id ||
      auth?.clinician?.userId ||
      auth?.session?.email ||
      auth?.session?.sub ||
      '',
  ).trim();
}

export async function GET(req: NextRequest) {
  try {
    if (!GW) return json({ ok: false, error: 'missing_gateway_origin' }, 500);

    const auth = await requireClinicianAuth(req, {
      allowAdmin: true,
      allowAdminStaff: true,
    });

    if (!auth.ok) return authErrorResponse(auth);

    const uid = clinicianUid(auth);
    const clinicianId = String(auth.clinicianId || uid).trim();

    const url = new URL(req.url);
    const res = await fetch(GW + '/api/medications?' + url.searchParams.toString(), {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'x-uid': uid,
        'x-clinician-id': clinicianId,
        'x-role': auth.role,
      },
    });

    const body = await res.json().catch(() => []);
    return json(body, res.status);
  } catch (err: any) {
    console.error('[clinician-app] medications proxy failed', err);
    return json({ ok: false, error: err?.message || 'medications_failed' }, 500);
  }
}
