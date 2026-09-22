import { NextRequest, NextResponse } from 'next/server';
import {
  patientGatewayHeaders,
  readPatientGatewayIdentity,
} from '@/src/lib/gateway-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANONICAL_API_GATEWAY =
  'https://api-gateway.ambulantplus.co.za';

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
  );
}

function gatewayBase() {
  const configured = clean(
    process.env.APIGW_BASE ||
      process.env.APIGW_ORIGIN ||
      process.env.API_GATEWAY_ORIGIN ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
      process.env.NEXT_PUBLIC_API_GATEWAY_BASE,
    500,
  ).replace(/\/+$/, '');

  if (configured) return configured;

  if (isProductionRuntime()) {
    return CANONICAL_API_GATEWAY;
  }

  return 'http://localhost:3010';
}

export async function POST(req: NextRequest) {
  try {
    const identity =
      await readPatientGatewayIdentity(req);

    if (!identity) {
      return NextResponse.json(
        {
          ok: false,
          error: 'patient_authentication_required',
        },
        {
          status: 401,
          headers: {
            'cache-control': 'no-store, max-age=0',
          },
        },
      );
    }

    const body =
      await req.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          ok: false,
          error: 'invalid_json_payload',
        },
        {
          status: 400,
          headers: {
            'cache-control': 'no-store, max-age=0',
          },
        },
      );
    }

    const vendor = clean(body.vendor, 120);
    const category = clean(body.category, 120);
    const model = clean(body.model, 180);

    const roomId =
      clean(body.room_id || body.roomId, 180) ||
      null;

    if (!vendor || !category || !model) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'missing_vendor_category_model',
        },
        {
          status: 400,
          headers: {
            'cache-control': 'no-store, max-age=0',
          },
        },
      );
    }

    /*
     * Do not forward browser-selected patient identity.
     * API Gateway derives patient ownership from the trusted
     * authenticated identity carried in the server request.
     */
    const payload = {
      vendor,
      category,
      model,
      ...(roomId ? { room_id: roomId } : {}),
    };

    const headers =
      patientGatewayHeaders({
        req,
        identity,
        includeJson: true,
      });

    const upstream = await fetch(
      `${gatewayBase()}/api/devices/register`,
      {
        method: 'POST',
        cache: 'no-store',
        headers,
        body: JSON.stringify(payload),
      },
    );

    const responseBody =
      await upstream.text();

    return new NextResponse(responseBody, {
      status: upstream.status,
      headers: {
        'content-type':
          upstream.headers.get('content-type') ||
          'application/json; charset=utf-8',
        'cache-control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error(
      '[patient-app][devices/register] proxy failed',
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'device_registration_proxy_failed',
      },
      {
        status: 503,
        headers: {
          'cache-control': 'no-store, max-age=0',
        },
      },
    );
  }
}