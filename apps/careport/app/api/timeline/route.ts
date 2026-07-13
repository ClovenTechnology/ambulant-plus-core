// apps/careport/app/api/timeline/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const orderId = String(url.searchParams.get('orderId') || url.searchParams.get('jobId') || '').trim();

  return NextResponse.json(
    {
      ok: false,
      error: 'legacy_timeline_route_disabled',
      orderId: orderId || null,
      message:
        'This legacy in-memory timeline endpoint has been retired. Use the api-gateway CarePort timeline/order tracking surfaces instead.',
      replacements: {
        patientTimeline: '/api/careport/timeline',
        patientTrackStream: '/api/careport/track/stream',
        adminOrders: '/api/careport/admin/orders',
      },
    },
    {
      status: 410,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
