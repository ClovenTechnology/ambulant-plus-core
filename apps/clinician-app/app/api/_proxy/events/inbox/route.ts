import { NextRequest, NextResponse } from 'next/server';
import { apigwBase, forwardClinicianHeaders, jsonError } from '../../../_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: string | null | undefined) {
  return String(value || '').trim();
}

function resolveClinicianId(req: NextRequest, url: URL) {
  return (
    clean(url.searchParams.get('clinicianId')) ||
    clean(req.headers.get('x-uid')) ||
    clean(req.headers.get('x-user-id')) ||
    clean(req.headers.get('x-ambulant-user-id'))
  );
}

// GET /api/_proxy/events/inbox?clinicianId=...&afterId=...
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const clinicianId = resolveClinicianId(req, url);
    const afterId = clean(url.searchParams.get('afterId'));

    if (!clinicianId) {
      return NextResponse.json(
        { ok: false, error: 'clinicianId_required' },
        { status: 400, headers: { 'cache-control': 'no-store' } },
      );
    }

    const qs = new URLSearchParams();
    qs.set('clinicianId', clinicianId);
    if (afterId) qs.set('afterId', afterId);

    const headers = forwardClinicianHeaders(req);
    headers.set('x-uid', clinicianId);
    if (!headers.get('x-user-id')) headers.set('x-user-id', clinicianId);
    if (!headers.get('x-role') && !headers.get('x-ambulant-role')) headers.set('x-role', 'clinician');

    const res = await fetch(`${apigwBase()}/api/events/inbox?${qs.toString()}`, {
      cache: 'no-store',
      headers,
    });

    return new NextResponse(await res.text(), {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return jsonError(error, 'events_inbox_proxy_failed', 502);
  }
}
