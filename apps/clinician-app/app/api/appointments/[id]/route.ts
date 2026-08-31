// apps/clinician-app/app/api/appointments/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authErrorResponse, requireClinicianAuth, type ResolvedClinicianAuth } from '@/src/lib/clinician-auth';
import { createTrustedClinicianIdentityHeader } from '@/src/lib/clinician-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function gatewayBase() {
  return (
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    ''
  ).replace(/\/+$/, '');
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function trustedGatewayHeaders(req: NextRequest, trustedIdentity: string, includeJson = false) {
  const headers = new Headers({
    accept: 'application/json',
    'x-ambulant-identity': trustedIdentity,
  });

  if (includeJson) headers.set('content-type', 'application/json');

  const authorization = req.headers.get('authorization');
  const requestId = req.headers.get('x-request-id');
  const correlationId = req.headers.get('x-correlation-id');
  if (authorization) headers.set('authorization', authorization);
  if (requestId) headers.set('x-request-id', requestId);
  if (correlationId) headers.set('x-correlation-id', correlationId);

  return headers;
}

function appointmentFromPayload(payload: any) {
  return payload?.appointment && typeof payload.appointment === 'object'
    ? payload.appointment
    : payload;
}

function clinicianOwnsAppointment(auth: ResolvedClinicianAuth, payload: any) {
  if (auth.role === 'admin' || auth.role === 'admin_staff') return true;
  if (auth.role !== 'clinician') return false;

  const appointment = appointmentFromPayload(payload);
  const appointmentClinicianId = clean(
    appointment?.clinicianId ||
      appointment?.clinician_id ||
      appointment?.clinician?.id,
  );

  return Boolean(appointmentClinicianId && appointmentClinicianId === auth.clinicianId);
}

async function resolveIdentity(req: NextRequest) {
  const auth = await requireClinicianAuth(req, {
    allowAdmin: true,
    allowAdminStaff: true,
  });
  if (!auth.ok) return { response: authErrorResponse(auth) } as const;

  let trustedIdentity: string;
  try {
    trustedIdentity = createTrustedClinicianIdentityHeader(req);
  } catch (error: any) {
    return {
      response: json(
        { ok: false, error: String(error?.message || 'identity_bridge_failed') },
        Number(error?.status || 500),
      ),
    } as const;
  }

  return { auth, trustedIdentity } as const;
}

async function loadAppointment(
  req: NextRequest,
  id: string,
  auth: ResolvedClinicianAuth,
  trustedIdentity: string,
) {
  const gw = gatewayBase();
  if (!gw) return { response: json({ ok: false, error: 'api_gateway_url_missing' }, 500) } as const;

  const upstream = new URL('/api/appointments/' + encodeURIComponent(id), gw);
  const res = await fetch(upstream.toString(), {
    method: 'GET',
    headers: trustedGatewayHeaders(req, trustedIdentity),
    cache: 'no-store',
  });

  const text = await res.text();
  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  if (!res.ok) {
    return {
      response: new NextResponse(text || JSON.stringify({ ok: false, error: 'appointment_upstream_failed' }), {
        status: res.status,
        headers: {
          'content-type': res.headers.get('content-type') || 'application/json',
          'cache-control': 'no-store',
        },
      }),
    } as const;
  }

  if (!clinicianOwnsAppointment(auth, payload)) {
    return { response: json({ ok: false, error: 'appointment_access_denied' }, 403) } as const;
  }

  return { payload, text, upstream } as const;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = clean(params.id);
  if (!id) return json({ ok: false, error: 'appointment_id_required' }, 400);

  const identity = await resolveIdentity(req);
  if ('response' in identity) return identity.response;

  try {
    const loaded = await loadAppointment(req, id, identity.auth, identity.trustedIdentity);
    if ('response' in loaded) return loaded.response;

    return new NextResponse(loaded.text || JSON.stringify(loaded.payload), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (error: any) {
    return json(
      { ok: false, error: error?.message || 'appointment_detail_proxy_failed' },
      502,
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = clean(params.id);
  if (!id) return json({ ok: false, error: 'appointment_id_required' }, 400);

  const identity = await resolveIdentity(req);
  if ('response' in identity) return identity.response;

  try {
    const loaded = await loadAppointment(req, id, identity.auth, identity.trustedIdentity);
    if ('response' in loaded) return loaded.response;

    const body = await req.text();
    if (!body.trim()) return json({ ok: false, error: 'invalid_json_body' }, 400);

    const res = await fetch(loaded.upstream.toString(), {
      method: 'PUT',
      headers: trustedGatewayHeaders(req, identity.trustedIdentity, true),
      body,
      cache: 'no-store',
    });

    const text = await res.text();
    return new NextResponse(text || JSON.stringify({ ok: res.ok }), {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (error: any) {
    return json(
      { ok: false, error: error?.message || 'appointment_update_proxy_failed' },
      502,
    );
  }
}
