// apps/clinician-app/app/api/insightcore/alerts/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GW =
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
  process.env.NEXT_PUBLIC_GATEWAY_BASE ||
  '';

export async function GET(req: NextRequest) {
  if (!GW) {
    // Dev fallback with empty list
    return NextResponse.json({ alerts: [] });
  }

  const clinicianId = req.nextUrl.searchParams.get('clinicianId') || undefined;

  const url = new URL(`${GW.replace(/\/+$/, '')}/api/insightcore/alerts`);
  url.searchParams.set('limit', req.nextUrl.searchParams.get('limit') || '10');
  if (clinicianId) url.searchParams.set('clinicianId', clinicianId);

  const r = await fetch(url.toString(), {
    headers: {
      ...(req.headers.get('cookie') ? { cookie: req.headers.get('cookie') as string } : {}),
      'x-role': 'clinician',
    },
    cache: 'no-store',
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    return NextResponse.json(
      { alerts: [], error: 'insightcore-alerts-upstream', detail: txt || r.statusText },
      { status: 200 },
    );
  }

  const data = (await r.json().catch(() => ({ alerts: [] }))) as { alerts?: any[] };
  return NextResponse.json({ alerts: data.alerts || [] });
}
