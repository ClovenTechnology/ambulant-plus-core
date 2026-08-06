// apps/patient-app/app/api/appointments/route.ts
import {
  NextRequest,
  NextResponse,
} from 'next/server';
import {
  patientGatewayHeaders,
  readPatientGatewayIdentity,
  resolveGatewayIdempotencyKey,
} from '@/src/lib/gateway-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function trimSlash(value: string) {
  return String(value || '').replace(/\/+$/, '');
}

function gatewayBase() {
  const configured =
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    '';

  const base = trimSlash(configured);
  if (!base) throw new Error('APIGW_BASE_required');
  return base;
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

async function readPayload(res: Response) {
  const text = await res.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function normaliseStatus(value: unknown) {
  const raw = String(value || '').trim();
  const lower = raw.toLowerCase();

  if (['scheduled', 'confirmed', 'booked', 'pending_payment', 'pending payment'].includes(lower)) {
    return lower === 'pending payment' ? 'pending_payment' : raw || 'Scheduled';
  }

  if (['completed', 'complete', 'done', 'closed'].includes(lower)) return 'Completed';
  if (['cancelled', 'canceled'].includes(lower)) return 'Cancelled';

  return raw || 'Scheduled';
}

function normaliseAppointment(input: any) {
  if (!input || typeof input !== 'object') return null;

  const id = String(input.id ?? input.appointmentId ?? input.appointment_id ?? '').trim();
  if (!id) return null;

  const clinician =
    input.clinician && typeof input.clinician === 'object'
      ? input.clinician
      : input.provider && typeof input.provider === 'object'
        ? input.provider
        : null;

  const startsAt =
    input.startsAt ??
    input.starts_at ??
    input.start ??
    input.startTime ??
    input.start_time ??
    input.when ??
    null;

  const endsAt =
    input.endsAt ??
    input.ends_at ??
    input.end ??
    input.endTime ??
    input.end_time ??
    null;

  return {
    ...input,
    id,
    clinicianId: String(input.clinicianId ?? input.clinician_id ?? clinician?.id ?? '').trim(),
    clinicianName:
      input.clinicianName ??
      input.clinician_name ??
      clinician?.displayName ??
      clinician?.name ??
      null,
    startsAt,
    endsAt,
    status: normaliseStatus(input.status),
    reason: input.reason ?? input.title ?? input.notes ?? null,
    location: input.location ?? input.visitMode ?? input.visit_mode ?? null,
    roomId: input.roomId ?? input.room_id ?? input.meta?.roomId ?? null,
    patientJoinUrl: input.patientJoinUrl ?? input.patient_join_url ?? input.meta?.patientJoinUrl ?? null,
    clinicianJoinUrl: input.clinicianJoinUrl ?? input.clinician_join_url ?? input.meta?.clinicianJoinUrl ?? null,
    patientParticipantId: input.patientParticipantId ?? input.patient_participant_id ?? input.meta?.patientParticipantId ?? null,
    clinicianParticipantId: input.clinicianParticipantId ?? input.clinician_participant_id ?? input.meta?.clinicianParticipantId ?? null,
    clinicianSpecialty: input.clinicianSpecialty ?? input.clinician_specialty ?? input.meta?.clinicianSpecialty ?? null,
    clinicianAvatarUrl: input.clinicianAvatarUrl ?? input.clinician_avatar_url ?? input.meta?.clinicianAvatarUrl ?? null,
    clinicianLocation: input.clinicianLocation ?? input.clinician_location ?? input.meta?.clinicianLocation ?? null,
    patientName: input.patientName ?? input.patient_name ?? input.patientDisplayName ?? input.meta?.patientDisplayName ?? null,
    patientAvatarUrl: input.patientAvatarUrl ?? input.patient_avatar_url ?? input.meta?.patientAvatarUrl ?? null,
    patientId: input.patientId ?? input.patient_id ?? null,
    subjectPatientId: input.subjectPatientId ?? input.subject_patient_id ?? null,
    hostUserId: input.hostUserId ?? input.host_user_id ?? null,
    familyRelationshipId: input.familyRelationshipId ?? input.family_relationship_id ?? null,
    paymentMethod: input.paymentMethod ?? input.payment_method ?? null,
    paymentStatus: input.paymentStatus ?? input.payment_status ?? input.payment?.status ?? null,
    paymentProvider: input.paymentProvider ?? input.payment_provider ?? input.payment?.provider ?? null,
    paymentRef: input.paymentRef ?? input.payment_ref ?? input.payment?.ref ?? null,
    priceCents:
      typeof input.priceCents === 'number'
        ? input.priceCents
        : typeof input.price_cents === 'number'
          ? input.price_cents
          : typeof input.amountMinor === 'number'
            ? input.amountMinor
            : typeof input.amount_minor === 'number'
              ? input.amount_minor
              : null,
    currency: input.currency ?? input.payment?.currency ?? 'ZAR',
  };
}

function normaliseAppointments(payload: any) {
  const raw =
    Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.appointments)
        ? payload.appointments
        : Array.isArray(payload?.data?.appointments)
          ? payload.data.appointments
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.items)
              ? payload.items
              : Array.isArray(payload?.results)
                ? payload.results
                : [];

  return raw.map(normaliseAppointment).filter(Boolean);
}

function appendIncomingQuery(req: NextRequest, upstream: URL) {
  const incoming = new URL(req.url);

  incoming.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });
}

export async function GET(req: NextRequest) {
  try {
    const identity =
      await readPatientGatewayIdentity(req);

    if (!identity) {
      return noStore(
        {
          ok: false,
          error: 'patient_session_required',
          appointments: [],
        },
        401,
      );
    }

    const upstream = new URL(
      '/api/appointments',
      gatewayBase(),
    );
    appendIncomingQuery(req, upstream);

    const response = await fetch(
      upstream.toString(),
      {
        method: 'GET',
        headers: patientGatewayHeaders({
          req,
          identity,
          includeJson: false,
        }),
        cache: 'no-store',
      },
    );
    const payload = await readPayload(response);

    if (
      !response.ok ||
      (
        payload &&
        typeof payload === 'object' &&
        payload.ok === false
      )
    ) {
      const message =
        typeof payload === 'object' && payload
          ? payload.error ||
            payload.message ||
            `appointments_gateway_http_${response.status}`
          : `appointments_gateway_http_${response.status}`;

      return noStore(
        {
          ok: false,
          error: message,
          appointments: [],
        },
        response.status,
      );
    }

    const appointments =
      normaliseAppointments(payload);

    return noStore({
      ok: true,
      appointments,
      items: appointments,
      total: appointments.length,
      raw: payload,
    });
  } catch (error: any) {
    const message =
      error?.message ||
      'appointments_gateway_failed';

    return noStore(
      {
        ok: false,
        error: message,
        appointments: [],
      },
      message ===
      'internal_identity_secret_unavailable'
        ? 503
        : 502,
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const identity =
      await readPatientGatewayIdentity(req);

    if (!identity) {
      return noStore(
        {
          ok: false,
          error: 'patient_session_required',
        },
        401,
      );
    }

    const body =
      await req.json().catch(() => ({} as any));
    const idempotencyKey =
      resolveGatewayIdempotencyKey(
        req,
        body.idempotencyKey ||
          body.idempotency_key,
      );
    const payload: any = {
      ...body,
      patientId: identity.patientId,
      patient_id: identity.patientId,
      hostUserId: identity.uid,
      host_user_id: identity.uid,
    };

    for (const key of [
      'id',
      'appointmentId',
      'appointment_id',
      'encounterId',
      'encounter_id',
      'roomId',
      'room_id',
      'orgId',
      'org_id',
      'paymentStatus',
      'payment_status',
      'paymentProvider',
      'payment_provider',
      'paymentRef',
      'payment_ref',
    ]) {
      delete payload[key];
    }

    const response = await fetch(
      new URL(
        '/api/appointments',
        gatewayBase(),
      ).toString(),
      {
        method: 'POST',
        headers: patientGatewayHeaders({
          req,
          identity,
          includeJson: true,
          idempotencyKey,
        }),
        body: JSON.stringify(payload),
        cache: 'no-store',
      },
    );
    const responsePayload =
      await readPayload(response);

    if (
      !response.ok ||
      (
        responsePayload &&
        typeof responsePayload === 'object' &&
        responsePayload.ok === false
      )
    ) {
      const message =
        typeof responsePayload === 'object' &&
        responsePayload
          ? responsePayload.error ||
            responsePayload.message ||
            `appointments_gateway_http_${response.status}`
          : `appointments_gateway_http_${response.status}`;

      return noStore(
        {
          ok: false,
          error: message,
          details: responsePayload,
        },
        response.status,
      );
    }

    return noStore(
      responsePayload ?? { ok: true },
      response.status,
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
