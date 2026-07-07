// apps/patient-app/app/api/appointments/route.ts
import crypto from 'node:crypto';
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
    '';

  const base = trimSlash(configured);
  if (!base) throw new Error('APIGW_BASE_required');
  return base;
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}


const SESSION_COOKIE_CANDIDATES = [
  '__Host-ambulant_session',
  'ambulant_session',
  'ambulant.session',
  'auth_session',
  'session',
  'token',
];

function cookieValue(req: NextRequest, name: string) {
  const raw = req.headers.get('cookie') || '';
  const parts = raw.split(';').map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;

    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();

    if (key === name) return decodeURIComponent(value);
  }

  return '';
}

function sessionTokenFromRequest(req: NextRequest) {
  for (const name of SESSION_COOKIE_CANDIDATES) {
    const token = cookieValue(req, name);
    if (token) return token;
  }

  return '';
}

function b64urlToBuffer(value: string) {
  const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
  const b64 = (value + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

function safeJsonParse(buf: Buffer) {
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    return null;
  }
}

function timingSafeEqualText(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);

  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function verifyPatientSessionToken(token: string) {
  const secret = process.env.AUTH_SESSION_SECRET || process.env.NEXTAUTH_SECRET || '';
  if (!secret) return null;

  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;

    const [h, p, sig] = parts;
    const expected = crypto.createHmac('sha256', secret).update(h + '.' + p).digest('base64url');

    if (!timingSafeEqualText(sig, expected)) return null;

    const payload = safeJsonParse(b64urlToBuffer(p));
    if (!payload) return null;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp <= now) return null;

    const role = String(payload.role || payload.actorRole || payload.actorType || payload.actor_type || '').toLowerCase();
    if (role && role !== 'patient' && role !== 'pat') return null;

    return payload;
  } catch {
    return null;
  }
}

function patientSessionIdentity(req: NextRequest) {
  const token = sessionTokenFromRequest(req);
  const payload = token ? verifyPatientSessionToken(token) : null;

  if (!payload) {
    return {
      token: '',
      uid: '',
      actorRefId: '',
      orgId: process.env.DEFAULT_ORG_ID || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || 'org-default',
    };
  }

  return {
    token,
    uid: String(payload.sub || payload.uid || payload.userId || payload.user_id || '').trim(),
    actorRefId: String(payload.actorRefId || payload.actor_ref_id || payload.patientId || payload.patient_id || '').trim(),
    orgId: String(payload.orgId || payload.org_id || payload.tenantId || payload.tenant_id || '').trim(),
  };
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

  const session = patientSessionIdentity(req);

  if (session.token && !headers.get('authorization')) {
    headers.set('authorization', 'Bearer ' + session.token);
  }

  if (session.uid && !headers.get('x-uid')) {
    headers.set('x-uid', session.uid);
  }

  if (session.uid && !headers.get('x-ambulant-user-id')) {
    headers.set('x-ambulant-user-id', session.uid);
  }

  if (session.actorRefId) {
    headers.set('x-actor-ref-id', session.actorRefId);
    headers.set('x-patient-id', session.actorRefId);
  }

  if (session.orgId && !headers.get('x-org-id')) {
    headers.set('x-org-id', session.orgId);
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

    const session = patientSessionIdentity(req);

    if (!upstream.searchParams.get('patientId') && !upstream.searchParams.get('subjectPatientId')) {
      const patientId = session.actorRefId || session.uid;
      if (patientId) upstream.searchParams.set('patientId', patientId);
    }

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
      items: appointments,
      total: appointments.length,
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
