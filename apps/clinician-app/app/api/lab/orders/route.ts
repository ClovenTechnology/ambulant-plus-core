// apps/clinician-app/app/api/lab/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';

type LabOrder = {
  id: string;
  kind: 'lab';
  encounterId: string;
  sessionId?: string | null;
  caseId?: string | null;
  panel: string;                 // e.g., "FBC + U&E"
  createdAt: string;
  status: 'PHLEB_ASSIGNED' | 'TRAVELING' | 'ARRIVED' | 'SAMPLE_COLLECTED' | 'LAB_RECEIVED' | 'COMPLETE';
  timeline: Array<{ status: string; at: string }>;
};

const store = {
  seq: 2001,
  byId: new Map<string, LabOrder>(),
};

function cors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'content-type');
  return res;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { encounterId, sessionId = null, caseId = null, panel } = body || {};
    if (!encounterId || !panel) {
      return cors(
        NextResponse.json({ ok: false, error: 'encounterId and panel are required' }, { status: 400 })
      );
    }

    const id = `LAB-${store.seq++}`;
    const now = new Date();

    const order: LabOrder = {
      id,
      kind: 'lab',
      encounterId,
      sessionId,
      caseId,
      panel: String(panel),
      createdAt: now.toISOString(),
      status: 'PHLEB_ASSIGNED',
      timeline: [
        { status: 'PHLEB_ASSIGNED', at: now.toISOString() },
        { status: 'TRAVELING', at: new Date(now.getTime() + 10 * 60000).toISOString() },
        { status: 'ARRIVED', at: new Date(now.getTime() + 20 * 60000).toISOString() },
      ],
    };

    store.byId.set(id, order);

    // Expose timeline globally for the /lab/timeline reader (optional)
    // @ts-ignore
    (global as any).__LAB_TIMELINE__ = (global as any).__LAB_TIMELINE__ ?? new Map();
    // @ts-ignore
    (global as any).__LAB_TIMELINE__.set(order.id, order.timeline);

    return cors(NextResponse.json({ ok: true, id, order }));
  } catch (e: any) {
    return cors(NextResponse.json({ ok: false, error: e?.message || 'Unknown error' }, { status: 500 }));
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (id) {
    const order = store.byId.get(id);
    return cors(
      NextResponse.json(order ? { ok: true, order } : { ok: false, error: 'Not found' }, { status: order ? 200 : 404 })
    );
  }
  const list = Array.from(store.byId.values()).slice(-50).reverse();
  return cors(NextResponse.json({ ok: true, orders: list }));
}
