//apps/api-gateway/src/app/api/erx/route.ts
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

export async function GET() {
  const scripts = await prisma.erxScript.findMany({
    orderBy: { createdAt: 'desc' },
    include: { items: true },
    take: 50,
  });
  return cors(NextResponse.json(scripts));
}

/**
 * Accepts either:
 *  - legacy: { appointmentId, meds: [{ drug, sig, qty, refills }] }
 *  - new:    { appointmentId, items: [{ drugName, dose, route, frequency, duration, quantity, refills, notes }], notes?, channel? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { appointmentId } = body || {};
    if (!appointmentId) return cors(NextResponse.json({ error: 'appointmentId required' }, { status: 400 }));

    const appt = await prisma.appointment.findUnique({ where: { id: String(appointmentId) } });
    if (!appt) return cors(NextResponse.json({ error: 'appointment not found' }, { status: 404 }));

    // build items from legacy meds[] if needed
    let items = Array.isArray(body.items) ? body.items : [];
    if (!items.length && Array.isArray(body.meds)) {
      items = body.meds.map((m: any) => {
        const sig = String(m.sig || '');
        // naive parse: "500 mg PO TID x7 days" (best effort)
        const [dose, route, frequency] = sig.split(/\s+/).slice(0, 3);
        const duration = /(\dx?\s*\w+)/i.exec(sig)?.[1];
        return {
          drugName: String(m.drug || ''),
          dose, route, frequency,
          duration: duration || undefined,
          quantity: m.qty ? String(m.qty) : undefined,
          refills: Number.isFinite(m.refills) ? Number(m.refills) : 0,
          notes: m.notes ? String(m.notes) : undefined,
        };
      });
    }
    if (!items.length) return cors(NextResponse.json({ error: 'no items' }, { status: 400 }));

    const script = await prisma.erxScript.create({
      data: {
        encounterId: appt.encounterId,
        sessionId: appt.sessionId,
        caseId: appt.caseId,
        patientId: appt.patientId,
        clinicianId: appt.clinicianId,
        notes: body.notes || null,
        status: 'sent',
        channel: body.channel || null,
        dispenseCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
        items: { create: items.map((i: any) => ({ ...i })) },
        timeline: { create: [{ status: 'REQUESTED' }] },
      },
      include: { items: true, timeline: true },
    });

    return cors(NextResponse.json(script, { status: 201 }));
  } catch (e: any) {
    return cors(NextResponse.json({ error: e?.message || 'erx-error' }, { status: 500 }));
  }
}
