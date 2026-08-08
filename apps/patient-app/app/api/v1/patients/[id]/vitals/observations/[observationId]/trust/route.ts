// apps/patient-app/app/api/v1/patients/[id]/vitals/observations/[observationId]/trust/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function trimSlash(value: string) {
  return String(value || '').replace(/\/+$/, '');
}

function gatewayBase(): string {
  const configured =
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    process.env.APIGW_ORIGIN ||
    process.env.API_GATEWAY_ORIGIN ||
    '';

  const base = trimSlash(configured);
  if (!base) throw new Error('APIGW_BASE_required');
  return base;
}

function json(body: unknown, status = 200) {
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
    'x-ambulant-patient-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
    'x-user-id',
    'x-patient-id',
    'x-uid',
    'x-role',
    'x-correlation-id',
    'x-request-id',
  ]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('accept', 'application/json');
  if (!headers.has('x-role')) headers.set('x-role', 'patient');
  if (includeJson) headers.set('content-type', 'application/json');

  return headers;
}

async function readPayload(res: Response) {
  const text = await res.text().catch(() => '');
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

type RouteParams = {
  id: string;
  observationId: string;
};

function upstream(patientId: string, observationId: string) {
  return (
    gatewayBase() +
    '/api/v1/patients/' +
    encodeURIComponent(patientId) +
    '/vitals/observations/' +
    encodeURIComponent(observationId) +
    '/trust'
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: RouteParams },
) {
  const patientId = String(params?.id || '').trim();
  const observationId = String(params?.observationId || '').trim();

  if (!patientId || !observationId) {
    return json({ ok: false, error: 'patient_and_observation_required' }, 400);
  }

  try {
    const res = await fetch(upstream(patientId, observationId), {
      method: 'GET',
      cache: 'no-store',
      headers: forwardHeaders(req),
    });

    const data = await readPayload(res);
    return json(data ?? { ok: res.ok }, res.status);
  } catch (error: any) {
    return json(
      {
        ok: false,
        error: 'vital_trust_gateway_request_failed',
        message: error?.message || 'Unable to load measurement trust state.',
      },
      502,
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: RouteParams },
) {
  const patientId = String(params?.id || '').trim();
  const observationId = String(params?.observationId || '').trim();

  if (!patientId || !observationId) {
    return json({ ok: false, error: 'patient_and_observation_required' }, 400);
  }

  const incoming = await req.json().catch(() => null);
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return json({ ok: false, error: 'invalid_json_body' }, 400);
  }

  const body = incoming as Record<string, unknown>;
  const action = String(body.action || '').trim().toLowerCase();
  const reasonCode = String(body.reasonCode || '').trim().toUpperCase();
  const reasonText = String(body.reasonText || '').trim().slice(0, 500);

  try {
    const res = await fetch(upstream(patientId, observationId), {
      method: 'PATCH',
      cache: 'no-store',
      headers: forwardHeaders(req, true),
      body: JSON.stringify({
        action,
        reasonCode: reasonCode || undefined,
        reasonText: reasonText || undefined,
      }),
    });

    const data = await readPayload(res);
    return json(data ?? { ok: res.ok }, res.status);
  } catch (error: any) {
    return json(
      {
        ok: false,
        error: 'vital_trust_gateway_request_failed',
        message: error?.message || 'Unable to update measurement trust state.',
      },
      502,
    );
  }
}
