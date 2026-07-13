// apps/careport/app/api/jobs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function disabled(jobId: string) {
  return NextResponse.json(
    {
      ok: false,
      error: 'legacy_job_route_disabled',
      jobId,
      message:
        'This legacy job endpoint has been retired. Use /api/careport/riders/me/jobs/[orderId] for rider jobs or /api/careport/pharmacies/me/orders/[orderId] for pharmacy fulfilment.',
      replacements: {
        riderJob: `/api/careport/riders/me/jobs/${encodeURIComponent(jobId)}`,
        pharmacyOrder: `/api/careport/pharmacies/me/orders/${encodeURIComponent(jobId)}`,
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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return disabled(String(params.id || '').trim());
}

export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  return disabled(String(params.id || '').trim());
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return disabled(String(params.id || '').trim());
}
