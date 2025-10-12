// apps/clinician-app/app/api/erx/timeline/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GW = process.env.APIGW_BASE?.replace(/\/+$/, '');

type TL = Array<{ status: string; at: string }>;
const fallback = new Map<string, TL>();

function cors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'content-type');
  return res;
}
export async function OPTIONS() { return cors(new NextResponse(null, { status: 204 })); }

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || 'ERX-1001';

  // Prefer gateway timeline from Prisma (ErxEvent)
  if (GW) {
    const r = await fetch(`${GW}/api/erx/timeline?id=${encodeURIComponent(id)}`, { cache: 'no-store' }).catch(() => null);
    if (r?.ok) return cors(NextResponse.json(await r.json(), { status: r.status }));
  }

  // Fallback synthesised timeline (unchanged)
  let timeline = fallback.get(id);
  if (!timeline) {
    const now = Date.now();
    timeline = [
      { status: 'REQUESTED',         at: new Date(now - 60 * 60000).toISOString() },
      { status: 'PHARMACY_MATCHED',  at: new Date(now - 45 * 60000).toISOString() },
      { status: 'RIDER_ASSIGNED',    at: new Date(now - 30 * 60000).toISOString() },
      { status: 'EN_ROUTE',          at: new Date(now - 15 * 60000).toISOString() },
      { status: 'DELIVERED',         at: new Date(now -  5 * 60000).toISOString() },
    ];
    fallback.set(id, timeline);
  }
  return cors(NextResponse.json({ id, timeline }));
}
