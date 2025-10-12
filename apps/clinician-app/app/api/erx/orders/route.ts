// apps/clinician-app/app/api/erx/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GW = process.env.APIGW_BASE?.replace(/\/+$/, '');

// in-memory fallback (unchanged)
type PharmacyOrder = {
  id: string;
  kind: 'pharmacy';
  encounterId: string;
  sessionId?: string | null;
  caseId?: string | null;
  eRx: { drug: string; sig: string };
  createdAt: string;
  status: 'REQUESTED' | 'PHARMACY_MATCHED' | 'RIDER_ASSIGNED' | 'EN_ROUTE' | 'DELIVERED';
  timeline: Array<{ status: string; at: string }>;
};
const store = { seq: 1001, byId: new Map<string, PharmacyOrder>() };

function cors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'content-type');
  return res;
}
export async function OPTIONS() { return cors(new NextResponse(null, { status: 204 })); }

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // Prefer gateway with scriptId support
  if (GW) {
    const r = await fetch(`${GW}/api/erx/orders`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }).catch(() => null);
    if (r?.ok) return cors(NextResponse.json(await r.json(), { status: r.status }));
  }

  // Fallback legacy (single-drug)
  const { encounterId, eRx } = body || {};
  if (!encounterId || !eRx?.drug || !eRx?.sig)
    return cors(NextResponse.json({ ok: false, error: 'encounterId, eRx.drug and eRx.sig are required' }, { status: 400 }));

  const id = `ERX-${store.seq++}`;
  const now = new Date();
  const order: PharmacyOrder = {
    id, kind: 'pharmacy', encounterId, eRx: { drug: String(eRx.drug), sig: String(eRx.sig) },
    createdAt: now.toISOString(), status: 'REQUESTED',
    timeline: [
      { status: 'REQUESTED', at: now.toISOString() },
      { status: 'PHARMACY_MATCHED', at: new Date(now.getTime() + 5 * 60000).toISOString() },
      { status: 'RIDER_ASSIGNED',   at: new Date(now.getTime() + 10 * 60000).toISOString() },
    ],
  };
  store.byId.set(id, order);
  return cors(NextResponse.json({ ok: true, id, order }));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (GW) {
    const r = await fetch(`${GW}/api/erx/orders${id ? `?id=${encodeURIComponent(id)}` : ''}`, { cache: 'no-store' }).catch(() => null);
    if (r?.ok) return cors(NextResponse.json(await r.json(), { status: r.status }));
  }

  if (id) {
    const order = store.byId.get(id);
    return cors(NextResponse.json(order ? { ok: true, order } : { ok: false, error: 'Not found' }, { status: order ? 200 : 404 }));
  }
  const list = Array.from(store.byId.values()).slice(-50).reverse();
  return cors(NextResponse.json({ ok: true, orders: list }));
}
