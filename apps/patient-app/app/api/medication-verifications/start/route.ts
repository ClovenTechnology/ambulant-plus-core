// apps/patient-app/app/api/medication-verifications/start/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function forwardHeaders(req: NextRequest) {
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
    'x-uid',
    'x-role',
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
  if (!headers.has('x-role')) headers.set('x-role', 'patient');

  return headers;
}

async function readPayload(res: Response) {
  const text = await res.text().catch(() => '');
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function createClientGuidedSession(body: any, reason: string) {
  const reminderId = String(body?.reminderId || '').trim();
  const medicationId = String(body?.medicationId || '').trim();

  if (!reminderId) {
    return noStore(
      {
        ok: false,
        error: 'reminder_id_required',
        message: 'A reminderId is required before camera verification can start.',
      },
      400,
    );
  }

  const sessionSeed = `${reminderId}:${medicationId || 'medication'}:${Date.now()}`;
  const sessionId = `client-guided-${Buffer.from(sessionSeed).toString('base64url').slice(0, 36)}`;

  return noStore(
    {
      ok: true,
      sessionId,
      mode: 'CLIENT_GUIDED_CAMERA_SEQUENCE',
      gatewaySession: false,
      fallbackReason: reason,
      message:
        'Gateway verification session endpoint is not available; continuing with client-guided camera capture and reminder confirmation fallback.',
    },
    200,
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  try {
    const base = apigwBase();

    if (!base) {
      return createClientGuidedSession(body, 'api_gateway_base_required');
    }

    const upstream = new URL(`${base.replace(/\/+$/, '')}/api/medication-verifications/start`);

    const res = await fetch(upstream.toString(), {
      method: 'POST',
      cache: 'no-store',
      headers: forwardHeaders(req),
      body: JSON.stringify(body ?? {}),
    });

    const payload = await readPayload(res);

    if (res.ok && payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const sessionId = String((payload as any).sessionId || (payload as any).id || '').trim();
      if (sessionId) {
        return noStore({ ok: true, ...payload, sessionId, gatewaySession: true }, res.status);
      }
    }

    if ([404, 405, 501].includes(res.status)) {
      return createClientGuidedSession(body, `gateway_endpoint_${res.status}`);
    }

    return noStore(
      {
        ok: false,
        error:
          payload && typeof payload === 'object' && !Array.isArray(payload)
            ? (payload as any).error || (payload as any).message || `medication_verification_start_http_${res.status}`
            : `medication_verification_start_http_${res.status}`,
        upstreamStatus: res.status,
        upstream: payload,
      },
      res.status,
    );
  } catch (err: any) {
    return createClientGuidedSession(body, err?.message || 'medication_verification_start_proxy_failed');
  }
}
