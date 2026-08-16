// apps/patient-app/app/api/appointments/[id]/reschedule/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  patientGatewayHeaders,
  readPatientGatewayIdentity,
} from '@/src/lib/gateway-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANONICAL_API_GATEWAY =
  'https://api-gateway.ambulantplus.co.za';

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

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  });
}

async function proxyReschedule(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
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

    const id = String(params?.id || '').trim();

    if (!id) {
      return json(
        { ok: false, error: 'appointment_id_required' },
        400,
      );
    }

    const body = await req
      .json()
      .catch(() => ({} as any));

    const startsAt =
      body.startsAt ||
      body.starts_at ||
      body.start ||
      body.startISO;

    if (!startsAt) {
      return json(
        { ok: false, error: 'startsAt_required' },
        400,
      );
    }

    const response = await fetch(
      `${gatewayBase()}/api/appointments/${encodeURIComponent(id)}/reschedule`,
      {
        method: 'POST',
        cache: 'no-store',
        headers: patientGatewayHeaders({
          req,
          identity,
          includeJson: true,
        }),
        body: JSON.stringify({
          ...body,
          startsAt,
        }),
      },
    );

    const text = await response.text();

    return new NextResponse(text, {
      status: response.status,
      headers: {
        'content-type':
          response.headers.get('content-type') ||
          'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (error: any) {
    return json(
      {
        ok: false,
        error:
          error?.message ||
          'appointment_reschedule_proxy_failed',
      },
      error?.message ===
        'internal_identity_secret_unavailable'
        ? 503
        : 502,
    );
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  return proxyReschedule(req, ctx);
}

export async function PUT(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  return proxyReschedule(req, ctx);
}
