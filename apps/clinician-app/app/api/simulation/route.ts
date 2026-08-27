import { NextRequest, NextResponse } from 'next/server';
import { authErrorResponse, requireClinicianAuth } from '@/src/lib/clinician-auth';
import { createTrustedClinicianIdentityHeader } from '@/src/lib/clinician-session';

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
  let trustedIdentity: string;
  try {
    trustedIdentity = createTrustedClinicianIdentityHeader(req);
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: String(error?.message || 'identity_bridge_failed'),
      },
      {
        status: Number(error?.status || 500),
        headers: { 'cache-control': 'no-store' },
      },
    );
  }

  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text();
  const response = await fetch(`${gateway}/api/clinicians/me/simulation`, {
    method: req.method,
    headers: {
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
      'x-ambulant-identity': trustedIdentity,
      ...(req.headers.get('x-request-id')
        ? { 'x-request-id': req.headers.get('x-request-id') as string }
        : {}),
      ...(req.headers.get('x-correlation-id')
        ? { 'x-correlation-id': req.headers.get('x-correlation-id') as string }
        : {}),
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
