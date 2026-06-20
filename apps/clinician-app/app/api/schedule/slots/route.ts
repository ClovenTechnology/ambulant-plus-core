// apps/clinician-app/app/api/schedule/slots/route.ts
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

function hhmm(value: any) {
  const raw = typeof value === 'string' ? value : String(value?.start || value || '');
  if (!raw) return '';
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 5);
  return d.toISOString().slice(11, 16);
}

function clinicianUid(auth: any) {
  return String(auth?.clinicianId || auth?.clinician?.id || auth?.clinician?.userId || auth?.session?.email || auth?.session?.sub || '').trim();
}

export async function GET(req: NextRequest) {
  try {
    if (!GW) return json({ ok: false, error: 'missing_gateway_origin' }, 500);

    const q = req.nextUrl.searchParams;
    const date = q.get('date') || q.get('start') || new Date().toISOString().slice(0, 10);
    let clinicianId = q.get('clinicianId') || q.get('clinician_id') || 'me';
    const headers: Record<string, string> = {};

    if (clinicianId === 'me') {
      const auth = await requireClinicianAuth(req, { allowAdmin: true, allowAdminStaff: true });
      if (!auth.ok) return authErrorResponse(auth);
      clinicianId = auth.clinicianId;
      headers['x-uid'] = clinicianUid(auth);
      headers['x-clinician-id'] = auth.clinicianId;
      headers['x-role'] = auth.role;
    }

    const gwQ = new URLSearchParams({ start: date, days: '1', clinicianId });
    const res = await fetch(`${GW}/api/schedule/slots?${gwQ.toString()}`, {
      cache: 'no-store',
      headers,
    });

    const body = await res.json().catch(() => ({} as any));
    const raw = body.slots?.[date] || [];
    const slots = Array.isArray(raw) ? raw.map(hhmm).filter(Boolean) : [];

    return json({ ok: res.ok, date, slots, source: 'clinician_app_proxy' }, res.status);
  } catch (err: any) {
    console.error('[clinician-app] slots proxy failed', err);
    return json({ ok: false, error: err?.message || 'gateway_failed' }, 500);
  }
}
