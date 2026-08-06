// apps/patient-app/app/api/payments/route.ts
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

const CANONICAL_GATEWAY = '';

function gatewayBase() {
  const base = (
    process.env.APIGW_BASE ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.API_GATEWAY_URL ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    CANONICAL_GATEWAY
  ).replace(/\/+$/, '');

  if (!base) throw new Error('APIGW_BASE_required');
  return base;
}

async function readBody(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

function targetUrl(req: NextRequest) {
  const incoming = new URL(req.url);
  const target = new URL(
    '/api/payments',
    gatewayBase(),
  );

  incoming.searchParams.forEach(
    (value, key) => {
      target.searchParams.set(key, value);
    },
  );

  return target.toString();
}

export async function GET(req: NextRequest) {
  try {
    const identity =
      await readPatientGatewayIdentity(req);

    if (!identity) {
      return json(
        {
          ok: false,
          error: 'patient_session_required',
        },
        401,
      );
    }

    const response = await fetch(
      targetUrl(req),
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
    const payload = await readBody(response);

    return json(
      payload ?? { ok: response.ok },
      response.status,
    );
  } catch (error: any) {
    const message =
      error?.message ||
      'payments_gateway_failed';

    return json(
      { ok: false, error: message },
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
      return json(
        {
          ok: false,
          error: 'patient_session_required',
        },
        401,
      );
    }

    const payload =
      await req.json().catch(() => ({} as any));
    const idempotencyKey =
      resolveGatewayIdempotencyKey(
        req,
        payload.idempotencyKey ||
          payload.idempotency_key,
      );

    const response = await fetch(
      targetUrl(req),
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
    const body = await readBody(response);

    return json(
      body ?? { ok: response.ok },
      response.status,
    );
  } catch (error: any) {
    const message =
      error?.message ||
      'payments_gateway_failed';

    return json(
      { ok: false, error: message },
      message ===
      'internal_identity_secret_unavailable'
        ? 503
        : 502,
    );
  }
}
