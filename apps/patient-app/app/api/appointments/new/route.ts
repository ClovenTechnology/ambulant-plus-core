// apps/patient-app/app/api/appointments/new/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PaymentMethod = 'card' | 'medical_aid' | 'voucher';

function trimSlash(value: string) {
  return String(value || '').replace(/\/+$/, '');
}

function gatewayBase() {
  return trimSlash(
    process.env.APIGW_BASE ||
      process.env.API_GATEWAY_BASE_URL ||
      process.env.API_GATEWAY_URL ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
      'https://ambulant-plus-core-api-gateway-kdon.vercel.app',
  );
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function isIsoDate(value: unknown) {
  const ms = Date.parse(String(value || ''));
  return Number.isFinite(ms);
}

function safeSlug(value: unknown, fallback = 'booking') {
  return String(value ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || fallback;
}

function makeRoomId(clinicianId: string, startsAt: string) {
  const stamp = Date.parse(startsAt);
  const when = Number.isFinite(stamp) ? String(stamp) : String(Date.now());
  const rand =
    globalThis.crypto?.randomUUID?.().slice(0, 8) ||
    Math.random().toString(36).slice(2, 10);

  return `room-${safeSlug(clinicianId, 'clinician')}-${when}-${rand}`;
}

function normalizePaymentMethod(value: unknown): PaymentMethod {
  const v = String(value || 'card').trim().toLowerCase();
  if (v === 'medical_aid' || v === 'voucher' || v === 'card') return v as PaymentMethod;
  return 'card';
}

function readUid(req: NextRequest, body: any) {
  return clean(
    req.headers.get('x-uid') ||
      req.headers.get('x-user-id') ||
      req.headers.get('x-ambulant-user-id') ||
      body?.hostUserId ||
      body?.host_user_id ||
      body?.patientId ||
      body?.patient_id ||
      '',
  );
}

function forwardHeaders(req: NextRequest, uid: string) {
  const headers = new Headers();

  for (const key of [
    'authorization',
    'cookie',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
    'x-user-id',
    'x-uid',
    'x-org',
    'x-org-id',
    'x-role',
    'x-email',
    'x-name',
    'x-display-name',
    'x-correlation-id',
    'x-request-id',
    'idempotency-key',
    'x-idempotency-key',
  ]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('accept', 'application/json');
  headers.set('content-type', 'application/json');
  headers.set('x-role', 'patient');
  headers.set('x-uid', uid);

  if (!headers.get('x-org-id') && !headers.get('x-ambulant-org-id')) {
    headers.set('x-org-id', process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || 'org-default');
  }

  return headers;
}

async function readPayload(res: Response) {
  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function POST(req: NextRequest) {
  const base = gatewayBase();

  if (!base) {
    return noStore({ ok: false, error: 'api_gateway_base_not_configured' }, 503);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return noStore({ ok: false, error: 'invalid_json_body' }, 400);
  }

  const clinicianId = clean(body.clinicianId || body.clinician_id);
  const startsAt = clean(body.startsAt || body.starts_at);
  const endsAt = clean(body.endsAt || body.ends_at);
  const uid = readUid(req, body);

  if (!clinicianId || !startsAt || !endsAt) {
    return noStore(
      { ok: false, error: 'clinicianId_startsAt_endsAt_required' },
      400,
    );
  }

  if (!isIsoDate(startsAt) || !isIsoDate(endsAt) || Date.parse(endsAt) <= Date.parse(startsAt)) {
    return noStore({ ok: false, error: 'invalid_time_range' }, 400);
  }

  if (!uid) {
    return noStore({ ok: false, error: 'patient_identity_required' }, 401);
  }

  const roomId = clean(body.roomId || body.room_id) || makeRoomId(clinicianId, startsAt);
  const paymentMethod = normalizePaymentMethod(body.paymentMethod || body.payment_method);
  const patientId = clean(body.patientId || body.patient_id || uid);
  const hostUserId = clean(body.hostUserId || body.host_user_id || uid);

  const isFamily = body?.person?.mode === 'FAMILY';

  const payload: any = {
    ...body,

    clinicianId,
    clinician_id: clinicianId,

    patientId,
    patient_id: patientId,
    subjectPatientId: isFamily
      ? clean(body?.person?.subjectPatientId || body.subjectPatientId || body.subject_patient_id)
      : clean(body.subjectPatientId || body.subject_patient_id || patientId),
    subject_patient_id: isFamily
      ? clean(body?.person?.subjectPatientId || body.subjectPatientId || body.subject_patient_id)
      : clean(body.subjectPatientId || body.subject_patient_id || patientId),

    familyRelationshipId: isFamily
      ? clean(body?.person?.relationshipId || body.familyRelationshipId || body.family_relationship_id)
      : clean(body.familyRelationshipId || body.family_relationship_id),
    family_relationship_id: isFamily
      ? clean(body?.person?.relationshipId || body.familyRelationshipId || body.family_relationship_id)
      : clean(body.familyRelationshipId || body.family_relationship_id),

    hostUserId,
    host_user_id: hostUserId,

    startsAt,
    starts_at: startsAt,
    endsAt,
    ends_at: endsAt,

    roomId,
    room_id: roomId,

    paymentMethod,
    payment_method: paymentMethod,

    patientEmail: body.patientEmail || body.patient_email || null,
    patient_email: body.patientEmail || body.patient_email || null,

    callbackUrl: body.callbackUrl || body.callback_url || null,
    callback_url: body.callbackUrl || body.callback_url || null,

    reason: clean(body.reason || body.title || body.notes) || 'Televisit consultation',
    kind: body.kind || 'standard',
    visitMode: body.visitMode || body.visit_mode || 'televisit',
    visit_mode: body.visitMode || body.visit_mode || 'televisit',

    source: body.source || 'patient-app-calendar',
  };

  try {
    const upstream = new URL('/api/appointments', base);

    const res = await fetch(upstream.toString(), {
      method: 'POST',
      headers: forwardHeaders(req, uid),
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const data: any = await readPayload(res);

    if (!res.ok || data?.ok === false) {
      return noStore(
        {
          ok: false,
          error: data?.error || data?.message || `appointments_gateway_http_${res.status}`,
          details: data,
        },
        res.status,
      );
    }

    const appointment = data?.appointment || data || {};
    const appointmentId =
      data?.appointmentId ||
      data?.appointment_id ||
      appointment?.id ||
      appointment?.appointmentId ||
      '';

    const encounterId =
      data?.encounterId ||
      data?.encounter_id ||
      appointment?.encounterId ||
      '';

    const paymentRef =
      data?.paymentRef ||
      data?.payment_ref ||
      data?.providerRef ||
      data?.payment?.providerRef ||
      data?.payment?.provider_ref ||
      appointment?.paymentRef ||
      '';

    const redirectUrl =
      data?.redirectUrl ||
      data?.redirect_url ||
      data?.payment?.redirectUrl ||
      data?.payment?.redirect_url ||
      '';

    return noStore(
      {
        ok: true,
        ...data,
        appointment,
        appointmentId,
        appointment_id: appointmentId,
        encounterId,
        encounter_id: encounterId,
        roomId: data?.roomId || appointment?.roomId || roomId,
        paymentMethod,
        paymentRef,
        payment_ref: paymentRef,
        redirectUrl,
        redirect_url: redirectUrl,
      },
      res.status === 201 ? 201 : 200,
    );
  } catch (error: any) {
    return noStore(
      {
        ok: false,
        error: error?.message || 'appointments_gateway_failed',
      },
      502,
    );
  }
}
