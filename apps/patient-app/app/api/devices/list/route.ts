import { NextRequest, NextResponse } from 'next/server';
import {
  patientGatewayHeaders,
  readPatientGatewayIdentity,
} from '@/src/lib/gateway-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANONICAL_API_GATEWAY =
  'https://api-gateway.ambulantplus.co.za';

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
  );
}

function gatewayBase(): string {
  const configured = clean(
    process.env.APIGW_BASE ||
      process.env.APIGW_ORIGIN ||
      process.env.API_GATEWAY_ORIGIN ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
      process.env.NEXT_PUBLIC_API_GATEWAY_BASE,
  ).replace(/\/+$/, '');

  if (configured) return configured;

  if (isProductionRuntime()) {
    return CANONICAL_API_GATEWAY;
  }

  return 'http://localhost:3010';
}

export async function GET(req: NextRequest) {
  const identity =
    await readPatientGatewayIdentity(req);

  if (!identity) {
    return NextResponse.json(
      {
        ok: false,
        error: 'patient_authentication_required',
      },
      { status: 401 },
    );
  }

  try {
    const headers =
      patientGatewayHeaders({
        req,
        identity,
      });

    const response =
      await fetch(
        `${gatewayBase()}/api/devices/list`,
        {
          method: 'GET',
          cache: 'no-store',
          headers: {
            ...headers,
            accept: 'application/json',
          },
        },
      );

    const text =
      await response.text();

    return new NextResponse(text, {
      status: response.status,
      headers: {
        'content-type':
          response.headers.get('content-type') ||
          'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: 'device_list_unavailable',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}
