// apps/clinician-app/app/api/availability/[clinicianId]/route.ts
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
  return String(auth?.clinicianId || auth?.clinician?.id || auth?.clinician?.userId || auth?.session?.email || auth?.session?.sub || '').trim();
}

export async function GET(req: NextRequest, ctx: { params: { clinicianId: string } }) {
  try {
    if (!GW) return json({ ok: false, error: 'missing_gateway_origin' }, 500);

    let clinicianId = decodeURIComponent(String(ctx.params.clinicianId || '')).trim();
    const headers: Record<string, string> = {};

    if (!clinicianId || clinicianId === 'me' || clinicianId === 'clinician-local-001') {
      const auth = await requireClinicianAuth(req, { allowAdmin: true, allowAdminStaff: true });
      if (!auth.ok) return authErrorResponse(auth);
      clinicianId = auth.clinicianId;
      headers['x-uid'] = clinicianUid(auth);
      headers['x-clinician-id'] = auth.clinicianId;
      headers['x-role'] = auth.role;
    }

    const url = new URL(req.url);
    const res = await fetch(`${GW}/api/clinicians/${encodeURIComponent(clinicianId)}/availability?${url.searchParams.toString()}`, {
      cache: 'no-store',
      headers,
    });

    const body = await res.json().catch(() => ({}));
    return json(body, res.status);
  } catch (err: any) {
    console.error('[clinician-app] availability proxy failed', err);
    return json({ ok: false, error: err?.message || 'gateway_failed' }, 500);
  }
}
