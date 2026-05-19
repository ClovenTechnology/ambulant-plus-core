import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function trimSlash(s: string) {
  return String(s || '').replace(/\/+$/, '');
}

function gatewayBase(): string {
  return trimSlash(
    process.env.APIGW_BASE ??
      process.env.NEXT_PUBLIC_APIGW_BASE ??
      'http://localhost:3010',
  );
}

function forwardAuthHeaders(req: NextRequest) {
  const headers = new Headers();

  ['cookie', 'authorization', 'x-ambulant-identity', 'x-uid', 'x-org-id'].forEach((k) => {
    const v = req.headers.get(k);
    if (v) headers.set(k, v);
  });

  headers.set('accept', 'application/json');
  headers.set('content-type', 'application/json');
  headers.set('x-role', 'patient');

  return headers;
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const clinicianId = cleanString(body?.clinicianId || body?.clinician_id);
    const startsAt = cleanString(body?.startsAt || body?.starts_at);
    const endsAt = cleanString(body?.endsAt || body?.ends_at);

    if (!clinicianId || !startsAt || !endsAt) {
      return NextResponse.json(
        { ok: false, error: 'clinicianId_startsAt_endsAt_required' },
        { status: 400 },
      );
    }

    const isFamily = body?.person?.mode === 'FAMILY';

    const gwPayload = {
      clinician_id: clinicianId,
      starts_at: startsAt,
      ends_at: endsAt,
      mode: body?.mode || 'book',
      room_id: body?.roomId || body?.room_id || undefined,
      kind: body?.kind || undefined,
      visit_mode: body?.visitMode || body?.visit_mode || undefined,
      payment_method: body?.paymentMethod || body?.payment_method || undefined,

      subject_patient_id: isFamily
        ? cleanString(body?.person?.subjectPatientId || body?.subjectPatientId)
        : undefined,

      host_user_id: cleanString(req.headers.get('x-uid')) || undefined,

      country: body?.country || undefined,
      subject_country_same: body?.subjectCountrySame,
      subject_country: body?.subjectCountry || undefined,

      client_id: body?.clientId || body?.client_id || undefined,
    };

    const res = await fetch(`${gatewayBase()}/api/appointments/preflight`, {
      method: 'POST',
      headers: forwardAuthHeaders(req),
      body: JSON.stringify(gwPayload),
      cache: 'no-store',
    });

    const text = await res.text();

    return new NextResponse(text, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') ?? 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'appointment_preflight_proxy_failed' },
      { status: 502 },
    );
  }
}