import { NextRequest, NextResponse } from 'next/server';

function base() {
  return (process.env.APIGW_BASE || 'http://localhost:3010').replace(/\/$/, '');
}

export const dynamic = 'force-dynamic';

// GET /api/_proxy/events/inbox?clinicianId=...&afterId=...
export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const clinicianId = u.searchParams.get('clinicianId') || '';
  const afterId = u.searchParams.get('afterId') || '';
  const qs = new URLSearchParams();
  if (clinicianId) qs.set('clinicianId', clinicianId);
  if (afterId) qs.set('afterId', afterId);

  const r = await fetch(`${base()}/api/events/inbox?${qs.toString()}`, {
    cache: 'no-store',
    headers: { 'x-role': 'clinician', 'x-uid': clinicianId || 'clin-demo' },
  });
  return new NextResponse(await r.text(), {
    status: r.status,
    headers: { 'content-type': r.headers.get('content-type') || 'application/json' },
  });
}
