import { NextRequest, NextResponse } from 'next/server';
import { patientGatewayHeaders, readPatientGatewayIdentity } from '@/src/lib/gateway-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function gatewayOrigin() {
  return (
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    ''
  ).replace(/\/+$/, '');
}

export async function GET(req: NextRequest) {
  const identity = await readPatientGatewayIdentity(req);
  if (!identity) return NextResponse.json({ ok: false, error: 'patient_authentication_required' }, { status: 401 });

  const managedRef = String(req.nextUrl.searchParams.get('managedRef') || '').trim();
  if (!managedRef.startsWith('managed://ambulant-patient-medical-aid-documents/')) {
    return NextResponse.json({ ok: false, error: 'patient_document_managed_ref_invalid' }, { status: 400 });
  }

  const gateway = gatewayOrigin();
  if (!gateway) return NextResponse.json({ ok: false, error: 'api_gateway_base_not_configured' }, { status: 503 });

  const response = await fetch(`${gateway}/api/patient-medical-aids/documents/view`, {
    method: 'POST',
    headers: patientGatewayHeaders({ req, identity, includeJson: true }),
    body: JSON.stringify({ managedRef }),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.viewUrl) {
    return NextResponse.json({ ok: false, error: payload?.error || 'patient_document_view_failed' }, { status: response.status || 502 });
  }

  return NextResponse.redirect(String(payload.viewUrl), 307);
}
