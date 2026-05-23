// apps/patient-app/app/api/appointments/route.ts
import { NextRequest, NextResponse } from 'next/server';

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
    'https://ambulant-plus-core-api-gateway-kdon.vercel.app';

  return trimSlash(configured);
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function forwardHeaders(req: NextRequest, includeJson = false) {
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

  if (includeJson) {
    headers.set('content-type', 'application/json');
  }

  if (!headers.get('x-role') && !headers.get('x-ambulant-role')) {
    headers.set('x-role', 'patient');
  }

  return headers;
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
    roomId: input.roomId ?? input.room_id ?? null,
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
  const base = gatewayBase();

  if (!base) {
    return noStore(
      {
        ok: false,
        error: 'api_gateway_base_not_configured',
        appointments: [],
      },
      503,
    );
  }

  try {
    const upstream = new URL('/api/appointments', base);
    appendIncomingQuery(req, upstream);

    const res = await fetch(upstream.toString(), {
      method: 'GET',
      headers: forwardHeaders(req),
      cache: 'no-store',
    });

    const payload = await readPayload(res);

    if (!res.ok || (payload && typeof payload === 'object' && payload.ok === false)) {
      const message =
        typeof payload === 'object' && payload
          ? payload.error || payload.message || `appointments_gateway_http_${res.status}`
          : `appointments_gateway_http_${res.status}`;

      return noStore(
        {
          ok: false,
          error: message,
          appointments: [],
        },
        res.status,
      );
    }

    const appointments = normaliseAppointments(payload);

    return noStore({
      ok: true,
      appointments,
      raw: payload,
    });
  } catch (error: any) {
    return noStore(
      {
        ok: false,
        error: error?.message || 'appointments_gateway_failed',
        appointments: [],
      },
      502,
    );
  }
}

export async function POST(req: NextRequest) {
  const base = gatewayBase();

  if (!base) {
    return noStore(
      {
        ok: false,
        error: 'api_gateway_base_not_configured',
      },
      503,
    );
  }

  try {
    const body = await req.json().catch(() => ({} as any));

    const upstream = new URL('/api/appointments', base);

    const res = await fetch(upstream.toString(), {
      method: 'POST',
      headers: forwardHeaders(req, true),
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const payload = await readPayload(res);

    if (!res.ok || (payload && typeof payload === 'object' && payload.ok === false)) {
      const message =
        typeof payload === 'object' && payload
          ? payload.error || payload.message || `appointments_gateway_http_${res.status}`
          : `appointments_gateway_http_${res.status}`;

      return noStore(
        {
          ok: false,
          error: message,
        },
        res.status,
      );
    }

    return noStore(payload ?? { ok: true }, res.status);
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
