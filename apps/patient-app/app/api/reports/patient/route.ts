import { NextRequest, NextResponse } from 'next/server';

import { readPatientGatewayIdentity } from '@/src/lib/gateway-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Legacy generic patient-report endpoint.
 *
 * The previous implementation accepted a caller-supplied subject identifier
 * and placed it directly into a generated PDF. Governed report generation now happens
 * through /api/reports/sleep POST, which resolves the patient from the
 * authenticated gateway identity and produces an identifier-safe projection.
 */
export async function POST(req: NextRequest) {
  const identity = await readPatientGatewayIdentity(req);

  if (!identity) {
    return NextResponse.json(
      { ok: false, error: 'patient_authentication_required' },
      { status: 401 },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: 'legacy_patient_report_route_retired',
      canonical: '/api/reports/sleep',
    },
    {
      status: 410,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
