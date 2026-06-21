// apps/clinician-app/app/api/patient/profile/route.ts
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
    if (!uid) return json({ ok: false, error: 'missing_clinician_identity' }, 401);

    const url = new URL(req.url);
    const qs = new URLSearchParams();

    const patientId = url.searchParams.get('patientId') || '';
    const userId = url.searchParams.get('userId') || '';

    if (patientId) qs.set('patientId', patientId);
    if (userId) qs.set('userId', userId);

    if (!patientId && !userId) {
      return json({ ok: false, error: 'patientId_or_userId_required' }, 400);
    }

    const clinicianId = String(auth.clinicianId || uid).trim();

    const res = await fetch(GW + '/api/patients/profile?' + qs.toString(), {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'x-uid': uid,
        'x-clinician-id': clinicianId,
        'x-role': auth.role,
      },
    });

    const body = await res.json().catch(() => ({}));
    return json(body, res.status);
  } catch (err: any) {
    console.error('[clinician-app] patient profile proxy failed', err);
    return json({ ok: false, error: err?.message || 'patient_profile_failed' }, 500);
  }
}
