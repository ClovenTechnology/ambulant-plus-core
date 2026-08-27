import { NextRequest, NextResponse } from 'next/server';
import { authErrorResponse, requireClinicianAuth } from '@/src/lib/clinician-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function gatewayBase() {
  return String(process.env.API_GATEWAY_URL || process.env.NEXT_PUBLIC_API_GATEWAY_URL || '').trim().replace(/\/+$/, '');
}
async function forward(req: NextRequest) {
  const gateway = gatewayBase();
  if (!gateway) return NextResponse.json({ ok: false, error: 'api_gateway_url_missing' }, { status: 500 });
  const auth = await requireClinicianAuth(req, { allowAdmin: false, allowAdminStaff: false });
  if (!auth.ok) return authErrorResponse(auth);
  if (auth.role !== 'clinician') return NextResponse.json({ ok: false, error: 'clinician_required' }, { status: 403 });
  const uid = String(auth.session?.sub || auth.clinician?.userId || auth.clinicianId || '').trim();
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text();
  const response = await fetch(`${gateway}/api/clinicians/me/simulation`, {
    method: req.method,
    headers: {
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
      'x-role': 'clinician',
      'x-uid': uid,
      ...(auth.clinicianId ? { 'x-clinician-id': auth.clinicianId } : {}),
    },
    body,
    cache: 'no-store',
  });
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' },
  });
}
export async function GET(req: NextRequest) { return forward(req); }
export async function POST(req: NextRequest) { return forward(req); }
