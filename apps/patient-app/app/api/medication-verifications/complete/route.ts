// apps/patient-app/app/api/medication-verifications/complete/route.ts
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

async function fetchJson(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const payload = await readPayload(res);
  return { res, payload };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const reminderId = String(body?.reminderId || '').trim();
  const medicationId = String(body?.medicationId || '').trim() || null;
  const takenAt = String(body?.takenAt || new Date().toISOString());
  const base = apigwBase();

  if (!reminderId) {
    return noStore({ ok: false, error: 'reminder_id_required' }, 400);
  }

  if (!base) {
    return noStore(
      {
        ok: false,
        error: 'api_gateway_base_required',
        message: 'Cannot complete medication verification because the API gateway is not configured.',
      },
      503,
    );
  }

  const root = base.replace(/\/+$/, '');
  const headers = forwardHeaders(req);

  try {
    const complete = await fetchJson(`${root}/api/medication-verifications/complete`, {
      method: 'POST',
      cache: 'no-store',
      headers,
      body: JSON.stringify(body ?? {}),
    });

    if (complete.res.ok) {
      if (complete.payload && typeof complete.payload === 'object' && !Array.isArray(complete.payload)) {
        return noStore({ ok: true, ...complete.payload }, complete.res.status);
      }
      return noStore({ ok: true, data: complete.payload }, complete.res.status);
    }

    if (![404, 405, 501].includes(complete.res.status)) {
      return noStore(
        {
          ok: false,
          error:
            complete.payload && typeof complete.payload === 'object' && !Array.isArray(complete.payload)
              ? (complete.payload as any).error || (complete.payload as any).message || `medication_verification_complete_http_${complete.res.status}`
              : `medication_verification_complete_http_${complete.res.status}`,
          upstreamStatus: complete.res.status,
          upstream: complete.payload,
        },
        complete.res.status,
      );
    }

    const confirmPayload = {
      action: 'confirm',
      id: reminderId,
      ids: [reminderId],
      reminderId,
      reminderIds: [reminderId],
      medicationId,
      takenAt,
      verifiedAt: takenAt,
      takenSource: 'CAMERA_GUIDED_CLIENT',
      verificationStatus: 'CLIENT_GUIDED_RECORDED',
      verificationMode: 'CAMERA_SEQUENCE',
      proofManifest: body?.proofManifest ?? null,
      stepTrace: body?.stepTrace ?? null,
      meta: {
        ...(body?.meta && typeof body.meta === 'object' ? body.meta : {}),
        verificationFallback: true,
        verificationFallbackReason: `gateway_complete_${complete.res.status}`,
      },
    };

    const confirmAttempts = [
      { url: `${root}/api/reminders`, method: 'POST' },
      { url: `${root}/api/reminders/confirm`, method: 'POST' },
      { url: `${root}/api/reminders/${encodeURIComponent(reminderId)}/confirm`, method: 'POST' },
      { url: `${root}/api/reminders/${encodeURIComponent(reminderId)}`, method: 'PATCH' },
    ] as const;

    let last: { status: number; payload: unknown } | null = null;
    for (const attempt of confirmAttempts) {
      const result = await fetchJson(attempt.url, {
        method: attempt.method,
        cache: 'no-store',
        headers,
        body: JSON.stringify(confirmPayload),
      });

      if (result.res.ok) {
        return noStore(
          {
            ok: true,
            reminderId,
            medicationId,
            verificationStatus: 'CLIENT_GUIDED_RECORDED',
            gatewayVerificationSession: false,
            reminderConfirmation: result.payload ?? { ok: true },
          },
          200,
        );
      }

      last = { status: result.res.status, payload: result.payload };
      if (![400, 404, 405, 409, 422].includes(result.res.status)) break;
    }

    return noStore(
      {
        ok: false,
        error: 'medication_verification_complete_fallback_failed',
        upstreamStatus: last?.status ?? complete.res.status,
        upstream: last?.payload ?? complete.payload,
      },
      last?.status && last.status >= 400 ? last.status : 502,
    );
  } catch (err: any) {
    return noStore(
      { ok: false, error: err?.message || 'medication_verification_complete_proxy_failed' },
      502,
    );
  }
}
