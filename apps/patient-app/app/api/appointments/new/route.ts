// apps/patient-app/app/api/appointments/new/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  type PatientGatewayIdentity,
  patientGatewayHeaders,
  readPatientGatewayIdentity,
  resolveGatewayIdempotencyKey,
} from '@/src/lib/gateway-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PaymentMethod = 'card' | 'medical_aid' | 'voucher';

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

async function readPatientProfileContact(
  req: NextRequest,
  identity: PatientGatewayIdentity,
): Promise<{ email: string; name: string }> {
  const profileUrl = new URL('/api/profile', req.url);

  const res = await fetch(profileUrl.toString(), {
    method: 'GET',
    headers: patientGatewayHeaders({
      req,
      identity,
      includeJson: false,
    }),
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

function pickAmountMinor(data: any, appointment: any) {
  const candidates = [
    data?.patientCopayMinor,
    data?.patient_payable_minor,
    data?.totalMinor,
    data?.total_minor,
    data?.amountCents,
    data?.amount_cents,
    data?.amountMinor,
    data?.amount_minor,
    data?.priceCents,
    data?.price_cents,
    appointment?.patientCopayMinor,
    appointment?.patient_payable_minor,
    appointment?.totalMinor,
    appointment?.total_minor,
    appointment?.amountCents,
    appointment?.amount_cents,
    appointment?.amountMinor,
    appointment?.amount_minor,
    appointment?.priceCents,
    appointment?.price_cents,
  ];

  for (const value of candidates) {
    const amount = Number(value);
    if (Number.isFinite(amount) && amount >= 0) {
      return Math.round(amount);
    }
  }

  return 0;
}

function pickCurrency(data: any, appointment: any) {
  return (
    clean(
      data?.currency ||
        appointment?.currency,
      3,
    ).toUpperCase() || 'ZAR'
  );
}

export async function POST(req: NextRequest) {
  const base = gatewayBase();

  if (!base) {
    return noStore({ ok: false, error: 'api_gateway_base_not_configured' }, 503);
  }

  const identity = await readPatientGatewayIdentity(req);

  if (!identity) {
    return noStore({ ok: false, error: 'patient_session_required' }, 401);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return noStore({ ok: false, error: 'invalid_json_body' }, 400);
  }

  const idempotencyKey =
    resolveGatewayIdempotencyKey(
      req,
      body.idempotencyKey ||
        body.idempotency_key,
    );

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

  const subjectPatientId = isFamily
    ? clean(
        body?.person?.subjectPatientId ||
          body.subjectPatientId ||
          body.subject_patient_id,
      )
    : patientId;
  const familyRelationshipId = isFamily
    ? clean(
        body?.person?.relationshipId ||
          body.familyRelationshipId ||
          body.family_relationship_id,
      )
    : clean(
        body.familyRelationshipId ||
          body.family_relationship_id,
      );

  const payload: any = {
    clinicianId,
    clinician_id: clinicianId,
    patientId,
    patient_id: patientId,
    subjectPatientId:
      subjectPatientId || patientId,
    subject_patient_id:
      subjectPatientId || patientId,
    familyRelationshipId:
      familyRelationshipId || null,
    family_relationship_id:
      familyRelationshipId || null,
    hostUserId,
    host_user_id: hostUserId,
    startsAt,
    starts_at: startsAt,
    endsAt,
    ends_at: endsAt,
    paymentMethod,
    payment_method: paymentMethod,
    patientEmail: patientEmail || null,
    patient_email: patientEmail || null,
    patientName: patientName || null,
    patient_name: patientName || null,
    reason:
      clean(
        body.reason ||
          body.title ||
          body.notes,
      ) || 'Televisit consultation',
    kind: body.kind || 'standard',
    visitMode:
      body.visitMode ||
      body.visit_mode ||
      'televisit',
    visit_mode:
      body.visitMode ||
      body.visit_mode ||
      'televisit',
    caseId:
      body.caseId ||
      body.case_id ||
      null,
    case_id:
      body.caseId ||
      body.case_id ||
      null,
    careRecipients:
      Array.isArray(body.careRecipients)
        ? body.careRecipients
        : Array.isArray(body.care_recipients)
          ? body.care_recipients
          : undefined,
    care_recipients:
      Array.isArray(body.careRecipients)
        ? body.careRecipients
        : Array.isArray(body.care_recipients)
          ? body.care_recipients
          : undefined,
    priceLock:
      body.priceLock ||
      body.price_lock ||
      null,
    price_lock:
      body.priceLock ||
      body.price_lock ||
      null,
    source: 'patient-app-calendar',
  };

  try {
    const appointmentRes = await fetch(new URL('/api/appointments', base).toString(), {
      method: 'POST',
      headers: patientGatewayHeaders({
        req,
        identity,
        includeJson: true,
        idempotencyKey,
      }),
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

    const amountCents = pickAmountMinor(data, appointment);
    const currency = pickCurrency(data, appointment);

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
        headers: patientGatewayHeaders({
          req,
          identity,
          includeJson: true,
          idempotencyKey,
        }),
        body: JSON.stringify({
          action: 'initialize',
          appointmentId,
          paymentMethod: 'CARD',
          email: patientEmail,
          callbackUrl:
            body.callbackUrl ||
            body.callback_url ||
            null,
          meta: {
            source:
              'patient-app-appointments-new',
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
    const message =
      error?.message ||
      'appointments_gateway_failed';

    return noStore(
      {
        ok: false,
        error: message,
      },
      message ===
      'internal_identity_secret_unavailable'
        ? 503
        : 502,
    );
  }
}
