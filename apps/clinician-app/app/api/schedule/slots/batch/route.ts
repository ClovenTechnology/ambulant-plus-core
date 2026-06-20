// apps/clinician-app/app/api/schedule/slots/batch/route.ts
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

async function resolveClinician(req: NextRequest, rawClinicianId: string) {
  if (rawClinicianId && rawClinicianId !== 'me') {
    return { clinicianId: rawClinicianId, headers: {} as Record<string, string>, error: null as any };
  }

  const auth = await requireClinicianAuth(req, { allowAdmin: true, allowAdminStaff: true });
  if (!auth.ok) return { clinicianId: '', headers: {}, error: authErrorResponse(auth) };

  return {
    clinicianId: auth.clinicianId,
    headers: {
      'x-uid': clinicianUid(auth),
      'x-role': auth.role,
    },
    error: null,
  };
}

export async function GET(req: NextRequest) {
  try {
    if (!GW) return json({ ok: false, error: 'missing_gateway_origin' }, 500);

    const q = req.nextUrl.searchParams;
    const start = q.get('start') || new Date().toISOString().slice(0, 10);
    const days = String(Math.max(1, Math.min(62, Number(q.get('days') || '7'))));
    const rawClinicianId = q.get('clinicianId') || q.get('clinician_id') || 'me';

    const resolved = await resolveClinician(req, rawClinicianId);
    if (resolved.error) return resolved.error;

    const gwQ = new URLSearchParams({
      start,
      days,
      clinicianId: resolved.clinicianId,
    });

    const res = await fetch(`${GW}/api/schedule/slots?${gwQ.toString()}`, {
      cache: 'no-store',
      headers: resolved.headers,
    });

    const body = await res.json().catch(() => ({} as any));

    const record = body.slots && typeof body.slots === 'object' && !Array.isArray(body.slots)
      ? body.slots
      : {};

    const items = Object.keys(record).map((date) => ({
      date,
      slots: Array.isArray(record[date]) ? record[date].map(hhmm).filter(Boolean) : [],
    }));

    return json({
      ok: res.ok,
      start,
      items,
      slots: record,
      source: 'clinician_app_proxy',
    }, res.status);
  } catch (err: any) {
    console.error('[clinician-app] slots batch proxy failed', err);
    return json({ ok: false, error: err?.message || 'gateway_failed' }, 500);
  }
}
