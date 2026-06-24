// apps/patient-app/app/api/appointments/preflight/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANONICAL_API_GATEWAY = 'https://api-gateway.ambulantplus.co.za';

function trimSlash(s: string) {
  return String(s || '').replace(/\/+$/, '');
}

function gatewayBase(): string {
  return trimSlash(
    process.env.APIGW_BASE ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      process.env.API_GATEWAY_BASE_URL ||
      process.env.API_GATEWAY_URL ||
      process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
      CANONICAL_API_GATEWAY,
  );
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function pickUserPayload(payload: any) {
  return payload?.user && typeof payload.user === 'object' ? payload.user : payload;
}

async function readPatientSession(req: NextRequest) {
  const authUrl = new URL('/api/auth/me', req.url);

  const res = await fetch(authUrl.toString(), {
    method: 'GET',
    headers: {
      cookie: req.headers.get('cookie') || '',
      authorization: req.headers.get('authorization') || '',
      accept: 'application/json',
    },
    cache: 'no-store',
  }).catch(() => null);

  if (!res || !res.ok) return null;

  const json = await res.json().catch(() => null);
  if (!json || json.ok === false) return null;

  const user = pickUserPayload(json);
  const actorType = clean(json.actorType || user.actorType || user.actor_type, 80).toUpperCase();
  if (actorType && actorType !== 'PATIENT') return null;

  const uid = clean(json.uid || json.userId || json.id || user.uid || user.userId || user.id || user.sub, 160);
  const patientId = clean(
    json.actorRefId ||
      json.actor_ref_id ||
      json.patientId ||
      json.patient_id ||
      user.actorRefId ||
      user.actor_ref_id ||
      user.patientId ||
      user.patient_id,
    160,
  );

  if (!uid || !patientId) return null;

  return {
    uid,
    patientId,
    orgId: clean(json.orgId || json.org_id || user.orgId || user.org_id, 120),
  };
}

function forwardAuthHeaders(req: NextRequest, identity: { uid: string; patientId: string; orgId: string }) {
  const headers = new Headers();

  ['cookie', 'authorization', 'x-ambulant-identity', 'x-request-id', 'x-correlation-id'].forEach((k) => {
    const v = req.headers.get(k);
    if (v) headers.set(k, v);
  });

  headers.set('accept', 'application/json');
  headers.set('content-type', 'application/json');
  headers.set('x-role', 'patient');
  headers.set('x-ambulant-role', 'patient');
  headers.set('x-uid', identity.uid);
  headers.set('x-user-id', identity.uid);
  headers.set('x-ambulant-user-id', identity.uid);
  headers.set('x-actor-ref-id', identity.patientId);
  headers.set('x-patient-id', identity.patientId);
  headers.set('x-current-patient-id', identity.patientId);

  if (identity.orgId) {
    headers.set('x-org-id', identity.orgId);
    headers.set('x-ambulant-org-id', identity.orgId);
  }

  return headers;
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: NextRequest) {
  try {
    const identity = await readPatientSession(req);

    if (!identity) {
      return NextResponse.json(
        { ok: false, error: 'patient_session_required' },
        { status: 401, headers: { 'cache-control': 'no-store' } },
      );
    }

    const body = await req.json().catch(() => ({} as any));

    const clinicianId = cleanString(body?.clinicianId || body?.clinician_id);
    const startsAt = cleanString(body?.startsAt || body?.starts_at);
    const endsAt = cleanString(body?.endsAt || body?.ends_at);

    if (!clinicianId || !startsAt || !endsAt) {
      return NextResponse.json(
        { ok: false, error: 'clinicianId_startsAt_endsAt_required' },
        { status: 400, headers: { 'cache-control': 'no-store' } },
      );
    }

    const isFamily = body?.person?.mode === 'FAMILY';
    const subjectPatientId = isFamily
      ? cleanString(body?.person?.subjectPatientId || body?.subjectPatientId)
      : identity.patientId;

    const gwPayload = {
      clinician_id: clinicianId,
      starts_at: startsAt,
      ends_at: endsAt,
      mode: body?.mode || 'book',
      room_id: body?.roomId || body?.room_id || undefined,
      kind: body?.kind || undefined,
      visit_mode: body?.visitMode || body?.visit_mode || undefined,
      payment_method: body?.paymentMethod || body?.payment_method || undefined,

      patient_id: identity.patientId,
      host_user_id: identity.uid,
      subject_patient_id: subjectPatientId,

      country: body?.country || undefined,
      subject_country_same: body?.subjectCountrySame,
      subject_country: body?.subjectCountry || undefined,

      client_id: body?.clientId || body?.client_id || undefined,
    };

    const res = await fetch(`${gatewayBase()}/api/appointments/preflight`, {
      method: 'POST',
      headers: forwardAuthHeaders(req, identity),
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
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
}
