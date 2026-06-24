// apps/patient-app/app/api/appointments/new/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PaymentMethod = 'card' | 'medical_aid' | 'voucher';

type PatientSessionIdentity = {
  uid: string;
  patientId: string;
  orgId: string;
  email: string;
  name: string;
};

const CANONICAL_API_GATEWAY = 'https://api-gateway.ambulantplus.co.za';

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
      CANONICAL_API_GATEWAY,
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

function normalizeEmail(value: unknown) {
  const email = clean(value, 240).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function isIsoDate(value: unknown) {
  const ms = Date.parse(String(value || ''));
  return Number.isFinite(ms);
}

function safeSlug(value: unknown, fallback = 'booking') {
  return (
    String(value ?? fallback)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || fallback
  );
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

function pickUserPayload(payload: any) {
  return payload?.user && typeof payload.user === 'object' ? payload.user : payload;
}

async function readPatientSession(req: NextRequest): Promise<PatientSessionIdentity | null> {
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

  const uid = clean(
    json.uid ||
      json.userId ||
      json.id ||
      user.uid ||
      user.userId ||
      user.id ||
      user.sub,
    160,
  );

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
    email: clean(json.email || user.email || user.contactEmail, 240),
    name: clean(json.name || json.displayName || user.name || user.displayName, 240),
  };
}

function forwardHeaders(req: NextRequest, identity: PatientSessionIdentity, includeJson = true) {
  const headers = new Headers();

  for (const key of [
    'authorization',
    'cookie',
    'x-ambulant-identity',
    'x-correlation-id',
    'x-request-id',
    'idempotency-key',
    'x-idempotency-key',
  ]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('accept', 'application/json');
  if (includeJson) headers.set('content-type', 'application/json');

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

  if (identity.email) headers.set('x-email', identity.email);
  if (identity.name) {
    headers.set('x-name', identity.name);
    headers.set('x-display-name', identity.name);
  }

  return headers;
}

async function readPatientProfileContact(
  req: NextRequest,
  identity: PatientSessionIdentity,
): Promise<{ email: string; name: string }> {
  const profileUrl = new URL('/api/profile', req.url);

  const res = await fetch(profileUrl.toString(), {
    method: 'GET',
    headers: forwardHeaders(req, identity, false),
    cache: 'no-store',
  }).catch(() => null);

  if (!res || !res.ok) {
    return { email: '', name: '' };
  }

  const json: any = await res.json().catch(() => null);
  if (!json || json.ok === false) {
    return { email: '', name: '' };
  }

  const profile =
    json.profile && typeof json.profile === 'object'
      ? json.profile
      : json.patient && typeof json.patient === 'object'
        ? json.patient
        : json;

  const patient =
    profile.patient && typeof profile.patient === 'object'
      ? profile.patient
      : {};

  return {
    email: normalizeEmail(
      profile.email ||
        profile.contactEmail ||
        profile.patientEmail ||
        profile.patient_email ||
        json.email ||
        json.contactEmail ||
        patient.email ||
        patient.contactEmail,
    ),
    name: clean(
      profile.name ||
        profile.displayName ||
        profile.fullName ||
        json.name ||
        json.displayName ||
        patient.name ||
        patient.displayName,
      240,
    ),
  };
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

function pickAmountMinor(data: any, appointment: any, body: any) {
  const candidates = [
    body?.amountCents,
    body?.amount_cents,
    body?.amountMinor,
    body?.amount_minor,
    body?.patientPayableMinor,
    body?.patient_payable_minor,
    body?.reimbursementIntent?.patientPayableMinor,
    body?.reimbursementIntent?.patient_payable_minor,
    body?.priceLock?.amountCents,
    body?.priceLock?.amount_cents,
    body?.priceLock?.patientPayableMinor,
    data?.amountCents,
    data?.amount_cents,
    data?.amountMinor,
    data?.amount_minor,
    data?.priceCents,
    data?.price_cents,
    appointment?.amountCents,
    appointment?.amount_cents,
    appointment?.amountMinor,
    appointment?.amount_minor,
    appointment?.priceCents,
    appointment?.price_cents,
  ];

  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return Math.round(n);
  }

  return 0;
}

function pickCurrency(data: any, appointment: any, body: any) {
  return clean(
    body?.currency ||
      body?.reimbursementIntent?.currency ||
      body?.priceLock?.currency ||
      data?.currency ||
      appointment?.currency,
    3,
  ).toUpperCase() || 'ZAR';
}

export async function POST(req: NextRequest) {
  const base = gatewayBase();

  if (!base) {
    return noStore({ ok: false, error: 'api_gateway_base_not_configured' }, 503);
  }

  const identity = await readPatientSession(req);

  if (!identity) {
    return noStore({ ok: false, error: 'patient_session_required' }, 401);
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

  if (!clinicianId || !startsAt || !endsAt) {
    return noStore(
      { ok: false, error: 'clinicianId_startsAt_endsAt_required' },
      400,
    );
  }

  if (!isIsoDate(startsAt) || !isIsoDate(endsAt) || Date.parse(endsAt) <= Date.parse(startsAt)) {
    return noStore({ ok: false, error: 'invalid_time_range' }, 400);
  }

  const roomId = clean(body.roomId || body.room_id) || makeRoomId(clinicianId, startsAt);
  const paymentMethod = normalizePaymentMethod(body.paymentMethod || body.payment_method);

  const patientId = identity.patientId;
  const hostUserId = identity.uid;

  const profileContact =
    !normalizeEmail(identity.email) || !identity.name
      ? await readPatientProfileContact(req, identity)
      : { email: '', name: '' };

  const patientEmail = normalizeEmail(
    body.patientEmail ||
      body.patient_email ||
      identity.email ||
      profileContact.email,
  );

  const patientName = clean(
    body.patientName ||
      body.patient_name ||
      identity.name ||
      profileContact.name,
    240,
  );

  const isFamily = body?.person?.mode === 'FAMILY';

  const payload: any = {
    ...body,

    clinicianId,
    clinician_id: clinicianId,

    patientId,
    patient_id: patientId,

    subjectPatientId: isFamily
      ? clean(body?.person?.subjectPatientId || body.subjectPatientId || body.subject_patient_id)
      : patientId,
    subject_patient_id: isFamily
      ? clean(body?.person?.subjectPatientId || body.subjectPatientId || body.subject_patient_id)
      : patientId,

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

    patientEmail: patientEmail || null,
    patient_email: patientEmail || null,
    patientName: patientName || null,
    patient_name: patientName || null,

    callbackUrl: body.callbackUrl || body.callback_url || null,
    callback_url: body.callbackUrl || body.callback_url || null,

    reason: clean(body.reason || body.title || body.notes) || 'Televisit consultation',
    kind: body.kind || 'standard',
    visitMode: body.visitMode || body.visit_mode || 'televisit',
    visit_mode: body.visitMode || body.visit_mode || 'televisit',

    source: body.source || 'patient-app-calendar',
  };

  try {
    const appointmentRes = await fetch(new URL('/api/appointments', base).toString(), {
      method: 'POST',
      headers: forwardHeaders(req, identity, true),
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const data: any = await readPayload(appointmentRes);

    if (!appointmentRes.ok || data?.ok === false) {
      return noStore(
        {
          ok: false,
          error: data?.error || data?.message || `appointments_gateway_http_${appointmentRes.status}`,
          details: data,
        },
        appointmentRes.status,
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

    const caseId =
      data?.caseId ||
      data?.case_id ||
      appointment?.caseId ||
      appointment?.case_id ||
      '';

    const amountCents = pickAmountMinor(data, appointment, body);
    const currency = pickCurrency(data, appointment, body);

    let payment: any = null;
    let paymentRef =
      data?.paymentRef ||
      data?.payment_ref ||
      data?.providerRef ||
      data?.payment?.providerRef ||
      data?.payment?.provider_ref ||
      appointment?.paymentRef ||
      '';

    let redirectUrl =
      data?.redirectUrl ||
      data?.redirect_url ||
      data?.payment?.redirectUrl ||
      data?.payment?.redirect_url ||
      '';

    const shouldStartCardCheckout =
      paymentMethod === 'card' &&
      amountCents > 0 &&
      appointmentId &&
      !redirectUrl;

    if (shouldStartCardCheckout) {
      if (!patientEmail) {
        return noStore(
          {
            ok: false,
            error: 'patient_email_required_for_card_checkout',
            appointmentId,
            appointment_id: appointmentId,
          },
          400,
        );
      }

      const paymentRes = await fetch(new URL('/api/payments', base).toString(), {
        method: 'POST',
        headers: forwardHeaders(req, identity, true),
        body: JSON.stringify({
          action: 'initialize',
          appointmentId,
          encounterId: encounterId || null,
          caseId: caseId || null,
          amountCents,
          currency,
          paymentMethod: 'CARD',
          email: patientEmail,
          callbackUrl: payload.callbackUrl || null,
          patientId,
          clinicianId,
          meta: {
            source: 'patient-app-appointments-new',
            priceLock: body.priceLock || body.price_lock || null,
            reimbursementIntent: body.reimbursementIntent || null,
          },
        }),
        cache: 'no-store',
      });

      payment = await readPayload(paymentRes);

      if (!paymentRes.ok || payment?.ok === false) {
        return noStore(
          {
            ok: false,
            error: payment?.error || payment?.message || `payment_gateway_http_${paymentRes.status}`,
            appointmentId,
            appointment_id: appointmentId,
            details: payment,
          },
          paymentRes.status,
        );
      }

      paymentRef =
        payment?.providerRef ||
        payment?.provider_ref ||
        payment?.payment?.providerRef ||
        payment?.payment?.provider_ref ||
        payment?.payment?.id ||
        paymentRef ||
        '';

      redirectUrl =
        payment?.redirectUrl ||
        payment?.redirect_url ||
        payment?.payment?.redirectUrl ||
        payment?.payment?.redirect_url ||
        redirectUrl ||
        '';

      if (!redirectUrl) {
        return noStore(
          {
            ok: false,
            error: 'card_checkout_redirect_missing',
            appointmentId,
            appointment_id: appointmentId,
            paymentRef,
            payment,
          },
          502,
        );
      }
    }

    return noStore(
      {
        ok: true,
        ...data,
        appointment,
        appointmentId,
        appointment_id: appointmentId,
        encounterId,
        encounter_id: encounterId,
        caseId,
        case_id: caseId,
        roomId: data?.roomId || appointment?.roomId || roomId,
        paymentMethod,
        payment,
        paymentRef,
        payment_ref: paymentRef,
        redirectUrl,
        redirect_url: redirectUrl,
      },
      appointmentRes.status === 201 ? 201 : 200,
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
