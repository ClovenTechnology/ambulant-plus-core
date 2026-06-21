// apps/clinician-app/src/lib/consultation-session-proxy.ts
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

export async function proxyConsultationSession(
  req: NextRequest,
  gatewayPath: string,
  method: 'GET' | 'POST' = 'GET',
) {
  if (!GW) {
    return json({ ok: false, error: 'missing_gateway_origin' }, 500);
  }

  const auth = await requireClinicianAuth(req, {
    allowAdmin: true,
    allowAdminStaff: true,
  });

  if (!auth.ok) return authErrorResponse(auth);

  const uid = clinicianUid(auth);
  if (!uid) {
    return json({ ok: false, error: 'missing_clinician_identity' }, 401);
  }

  const clinicianId = String(auth.clinicianId || uid).trim();

  const init: RequestInit = {
    method,
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      'x-uid': uid,
      'x-clinician-id': clinicianId,
      'x-role': auth.role,
    },
  };

  if (method === 'POST') {
    (init.headers as any)['content-type'] = 'application/json';
    init.body = JSON.stringify(await req.json().catch(() => ({})));
  }

  const res = await fetch(GW + gatewayPath, init);
  const body = await res.json().catch(() => ({}));

  return json(body, res.status);
}
