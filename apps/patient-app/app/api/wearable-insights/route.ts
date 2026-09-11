import { NextRequest, NextResponse } from 'next/server';
import { patientGatewayHeaders, readPatientGatewayIdentity } from '@/src/lib/gateway-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const identity = await readPatientGatewayIdentity(req);
  if (!identity) {
    return NextResponse.json({ ok: false, error: 'patient_authentication_required' }, { status: 401 });
  }

  const reportUrl = new URL('/api/reports/vitals', req.url);
  reportUrl.searchParams.set('range', req.nextUrl.searchParams.get('range') || '7d');
  const response = await fetch(reportUrl.toString(), {
    cache: 'no-store',
    headers: patientGatewayHeaders({ req, identity }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    return NextResponse.json(
      { ok: false, error: payload?.error || 'live_wearable_insights_unavailable' },
      { status: response.status || 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    source: 'live_vitals_projection',
    generatedAtISO: payload.generatedAtISO ?? new Date().toISOString(),
    summary: payload.summary ?? {},
    latest: payload.latest ?? null,
    trend: Array.isArray(payload.trend) ? payload.trend : [],
    sources: payload.sources ?? {},
  });
}
