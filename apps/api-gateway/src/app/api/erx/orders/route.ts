//apps/api-gateway/src/app/api/erx/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

function cors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'content-type');
  return res;
}
export async function OPTIONS() { return cors(new NextResponse(null, { status: 204 })); }

/**
 * Create an order referencing a script:
 * POST { scriptId: string, channel?: 'CarePort'|'MedReach'|'Generic' }
 * Legacy fallback: { encounterId, eRx:{ drug, sig } } — will synthesize a script and timeline.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Preferred: scriptId
    if (body?.scriptId) {
      const script = await prisma.erxScript.findUnique({ where: { id: String(body.scriptId) } });
      if (!script) return cors(NextResponse.json({ ok: false, error: 'script not found' }, { status: 404 }));

      // append timeline hints
      const now = Date.now();
      await prisma.erxEvent.createMany({
        data: [
          { scriptId: script.id, status: 'REQUESTED',        at: new Date(now) },
          { scriptId: script.id, status: 'PHARMACY_MATCHED', at: new Date(now + 5 * 60000) },
          { scriptId: script.id, status: 'RIDER_ASSIGNED',   at: new Date(now + 10 * 60000) },
        ],
        skipDuplicates: true,
      });

      return cors(NextResponse.json({ ok: true, id: script.id, order: { id: script.id, kind: 'pharmacy', scriptId: script.id } }));
    }

    // Legacy: synthesize a slim script from single eRx row so downstream remains consistent
    const { encounterId, eRx } = body || {};
    if (!encounterId || !eRx?.drug || !eRx?.sig)
      return cors(NextResponse.json({ ok: false, error: 'scriptId or encounterId+eRx required' }, { status: 400 }));

    const enc = await prisma.encounter.findUnique({ where: { id: String(encounterId) } });
    if (!enc) return cors(NextResponse.json({ ok: false, error: 'encounter not found' }, { status: 404 }));

    const appt = await prisma.appointment.findFirst({ where: { encounterId: enc.id }, orderBy: { startsAt: 'desc' } });
    const script = await prisma.erxScript.create({
      data: {
        encounterId: enc.id,
        sessionId: appt?.sessionId || null,
        caseId: appt?.caseId || null,
        patientId: enc.patientId,
        clinicianId: enc.clinicianId || '',
        status: 'sent',
        items: { create: [{ drugName: String(eRx.drug), notes: String(eRx.sig) }] },
        timeline: { create: [{ status: 'REQUESTED' }] },
      },
    });

    return cors(NextResponse.json({ ok: true, id: script.id, order: { id: script.id, kind: 'pharmacy', scriptId: script.id } }));
  } catch (e: any) {
    return cors(NextResponse.json({ ok: false, error: e?.message || 'order-error' }, { status: 500 }));
  }
}

/** GET:
 *  - /api/erx/orders?id=<scriptId> -> return script + items
 *  - /api/erx/orders               -> list recent scripts (last 50)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (id) {
    const script = await prisma.erxScript.findUnique({ where: { id: String(id) }, include: { items: true } });
    return cors(NextResponse.json(script ? { ok: true, order: script } : { ok: false, error: 'Not found' }, { status: script ? 200 : 404 }));
  }

  const list = await prisma.erxScript.findMany({ orderBy: { createdAt: 'desc' }, include: { items: true }, take: 50 });
  return cors(NextResponse.json({ ok: true, orders: list }));
}
