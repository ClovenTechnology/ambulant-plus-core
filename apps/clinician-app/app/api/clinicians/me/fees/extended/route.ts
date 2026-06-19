// apps/clinician-app/app/api/clinicians/me/fees/extended/route.ts
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
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

function clinicianUid(auth: any) {
  return String(auth?.clinician?.userId || auth?.session?.email || auth?.session?.sub || auth?.clinicianId || '').trim();
}

async function proxy(req: NextRequest, method: 'GET' | 'PUT') {
  if (!GW) return json({ ok: false, error: 'missing_gateway_origin' }, 500);

  const auth = await requireClinicianAuth(req, { allowAdmin: true, allowAdminStaff: true });
  if (!auth.ok) return authErrorResponse(auth);

  const uid = clinicianUid(auth);
  if (!uid) return json({ ok: false, error: 'missing_clinician_identity' }, 401);

  const init: RequestInit = {
    method,
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      'x-uid': uid,
      'x-role': auth.role,
    },
  };

  if (method === 'PUT') {
    (init.headers as any)['content-type'] = 'application/json';
    init.body = JSON.stringify(await req.json().catch(() => ({})));
  }

  const res = await fetch(`${GW}/api/clinicians/me/fees/extended`, init);
  const body = await res.json().catch(() => ({}));
  return json(body, res.status);
}

export async function GET(req: NextRequest) {
  try {
    return await proxy(req, 'GET');
  } catch (err: any) {
    console.error('[clinician-app] fees/extended proxy failed', err);
    return json({ ok: false, error: err?.message || 'gateway_failed' }, 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    return await proxy(req, 'PUT');
  } catch (err: any) {
    console.error('[clinician-app] fees/extended save proxy failed', err);
    return json({ ok: false, error: err?.message || 'gateway_failed' }, 500);
  }
}
