import { NextRequest, NextResponse } from 'next/server';
import {
  authErrorResponse,
  ensureClinicianSelfOrPrivileged,
  requireClinicianAuth,
} from '@/src/lib/clinician-auth';

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

function missingGatewayResponse() {
  return json({ ok: false, error: 'api_gateway_url_missing' }, 500);
}

function isSimulationAppointment(item: any) {
  return [item?.id, item?.encounterId, item?.patientId]
    .filter(Boolean)
    .some((v) => String(v).startsWith('sim-'));
}

function asList(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.appointments)) return payload.appointments;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export async function GET(req: NextRequest) {
  const gateway = gatewayBase();
  if (!gateway) return missingGatewayResponse();

  const auth = await requireClinicianAuth(req, {
    allowAdmin: true,
    allowAdminStaff: true,
  });

  if (!auth.ok) return authErrorResponse(auth);

  try {
    const urlIn = new URL(req.url);
    const requestedClinicianId = String(urlIn.searchParams.get('clinicianId') || '').trim();

    const denied = ensureClinicianSelfOrPrivileged(auth, requestedClinicianId);
    if (denied) return authErrorResponse(denied);

    const clinicianId =
      auth.role === 'clinician'
        ? auth.clinicianId
        : requestedClinicianId || auth.clinicianId;

    if (!clinicianId) {
      return json({ ok: false, error: 'missing_clinician_identity' }, 401);
    }

    const upstream = new URL('/api/appointments', gateway);

    urlIn.searchParams.forEach((value, key) => {
      if (key !== 'clinicianId' && key !== 'clinician') {
        upstream.searchParams.append(key, value);
      }
    });

    upstream.searchParams.set('clinicianId', clinicianId);
    upstream.searchParams.set('excludeSimulation', '1');

    const r = await fetch(upstream.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-role': auth.role,
        'x-uid': auth.clinicianId,
        'x-clinician-id': auth.clinicianId,
      },
      cache: 'no-store',
    });

    const payload = await r.json().catch(() => ({}));
    const appointments = asList(payload).filter((item) => !isSimulationAppointment(item));

    if (!r.ok) {
      return json(
        {
          ok: false,
          error: payload?.error || 'appointments_upstream_failed',
          appointments,
        },
        r.status,
      );
    }

    return json({
      ok: true,
      appointments,
      items: appointments,
      total: appointments.length,
    });
  } catch (e: any) {
    return json(
      {
        ok: false,
        error: 'appointments_upstream_failed',
        detail: String(e?.message || e),
      },
      502,
    );
  }
}
