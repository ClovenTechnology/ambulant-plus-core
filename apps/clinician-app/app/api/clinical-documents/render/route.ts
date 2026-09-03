import { NextRequest, NextResponse } from 'next/server';
import { createTrustedClinicianIdentityHeader } from '@/src/lib/clinician-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function gatewayBase() {
  const raw = process.env.APIGW_BASE || process.env.API_GATEWAY_URL || process.env.NEXT_PUBLIC_API_GATEWAY_URL || process.env.NEXT_PUBLIC_GATEWAY_ORIGIN || '';
  return String(raw).trim().replace(/\/+$/, '');
}

export async function POST(req: NextRequest) {
  try {
    const base = gatewayBase();
    if (!base) return NextResponse.json({ ok: false, error: 'missing_gateway_origin' }, { status: 500 });
    const identity = createTrustedClinicianIdentityHeader(req);
    const upstream = await fetch(`${base}/api/clinical-documents/render`, {
      method: 'POST', cache: 'no-store',
      headers: { accept: 'application/pdf', 'content-type': 'application/json', 'x-ambulant-identity': identity },
      body: await req.text(),
    });
    const bytes = await upstream.arrayBuffer();
    return new NextResponse(bytes, { status: upstream.status, headers: { 'content-type': upstream.headers.get('content-type') || 'application/octet-stream', 'content-disposition': upstream.headers.get('content-disposition') || 'inline', 'cache-control': 'no-store' } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'clinical_document_proxy_failed' }, { status: typeof err?.status === 'number' ? err.status : 500 });
  }
}
