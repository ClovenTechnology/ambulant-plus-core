import { NextRequest, NextResponse } from 'next/server';
import { patientGatewayHeaders, readPatientGatewayIdentity } from '@/src/lib/gateway-identity';

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
  return NextResponse.json({ ok: false, error: message, ...(details ? { details } : {}) }, { status });
}

export async function GET(req: NextRequest) {
  try {
    if (!GATEWAY_ORIGIN) return jsonError('insightcore_gateway_not_configured', 500);

    const identity = await readPatientGatewayIdentity(req);
    if (!identity) return jsonError('patient_authentication_required', 401);

    const requestedPatientId = String(req.nextUrl.searchParams.get('patientId') || '').trim();
    if (requestedPatientId && requestedPatientId !== identity.patientId) {
      return jsonError('patient_context_mismatch', 403);
    }

    const url = new URL(`${GATEWAY_ORIGIN}/api/insightcore/alerts`);
    url.searchParams.set('limit', req.nextUrl.searchParams.get('limit') || '5');
    url.searchParams.set('patientId', identity.patientId);
    const since = req.nextUrl.searchParams.get('since');
    if (since) url.searchParams.set('since', since);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: patientGatewayHeaders({ req, identity }),
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => null);
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
