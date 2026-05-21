// apps/patient-app/app/api/insightcore/alerts/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GATEWAY_ORIGIN = (
  process.env.APIGW_BASE ||
  process.env.NEXT_PUBLIC_APIGW_BASE ||
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
  process.env.NEXT_PUBLIC_GATEWAY_BASE ||
  ''
).replace(/\/+$/, '');

function jsonError(message: string, status = 500, details?: Record<string, unknown>) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...(details ? { details } : {}),
    },
    { status },
  );
}

function requireGatewayOrigin(): string {
  if (!GATEWAY_ORIGIN) {
    throw Object.assign(new Error('insightcore_gateway_not_configured'), {
      status: 500,
    });
  }

  return GATEWAY_ORIGIN;
}

export async function GET(req: NextRequest) {
  try {
    const gateway = requireGatewayOrigin();

    const url = new URL(`${gateway}/api/insightcore/alerts`);
    url.searchParams.set('limit', req.nextUrl.searchParams.get('limit') || '5');

    const patientId = req.nextUrl.searchParams.get('patientId');
    if (patientId) url.searchParams.set('patientId', patientId);

    const orgId = req.nextUrl.searchParams.get('orgId');
    if (orgId) url.searchParams.set('orgId', orgId);

    const cookie = req.headers.get('cookie');
    const uid = req.headers.get('x-uid');
    const role = req.headers.get('x-role') || 'patient';

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(uid ? { 'x-uid': uid } : {}),
        'x-role': role,
      },
      cache: 'no-store',
    });

    const text = await response.text();
    let payload: unknown = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    if (!response.ok) {
      return jsonError('insightcore_alerts_gateway_failed', response.status, {
        upstreamStatus: response.status,
        upstreamPayload: payload,
      });
    }

    const data = payload as { alerts?: unknown[] };

    return NextResponse.json({
      ok: true,
      source: 'insightcore',
      alerts: Array.isArray(data?.alerts) ? data.alerts.slice(0, 5) : [],
    });
  } catch (err: any) {
    return jsonError(err?.message || 'insightcore_alerts_failed', err?.status || 500);
  }
}