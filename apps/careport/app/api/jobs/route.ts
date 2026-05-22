// apps/careport/app/api/jobs/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function disabled() {
  return NextResponse.json(
    {
      ok: false,
      error: 'legacy_demo_jobs_route_disabled',
      message:
        'This legacy demo jobs endpoint has been retired. Use /api/careport/riders/me/jobs for rider jobs or /api/careport/pharmacies/me/orders for pharmacy fulfilment.',
      replacements: {
        riderJobs: '/api/careport/riders/me/jobs',
        pharmacyOrders: '/api/careport/pharmacies/me/orders',
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

export async function GET(_req: NextRequest) {
  return disabled();
}

export async function POST(_req: NextRequest) {
  return disabled();
}
