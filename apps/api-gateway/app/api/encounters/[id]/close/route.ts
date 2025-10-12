//apps/api-gateway/app/api/encounters/[id]/close/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { anchorEncounter } from '@/src/lib/anchor';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const who = readIdentity(req.headers);
  if (who.role !== 'clinician' && who.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const enc = await prisma.encounter.findUnique({ where: { id: params.id } });
  if (!enc) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const [appts, erx, lab, pays] = await Promise.all([
    prisma.appointment.findMany({ where: { encounterId: enc.id } }),
    prisma.erxOrder.findMany({ where: { encounterId: enc.id } }),
    prisma.labOrder.findMany({ where: { encounterId: enc.id } }),
    prisma.payment.findMany({ where: { encounterId: enc.id } }),
  ]);

  const canonical = {
    id: enc.id,
    caseId: enc.caseId,
    patientId: enc.patientId,
    clinicianId: enc.clinicianId ?? null,
    status: 'closed',
    appointments: appts.map(a => ({ id: a.id, startsAt: a.startsAt, endsAt: a.endsAt, status: a.status })),
    orders: {
      pharmacy: erx.map(o => ({ id: o.id, drug: o.drug, sig: o.sig, createdAt: o.createdAt })),
      lab: lab.map(o => ({ id: o.id, panel: o.panel, createdAt: o.createdAt })),
    },
    payments: pays.map(p => ({ id: p.id, amountCents: p.amountCents, status: p.status, createdAt: p.createdAt })),
  };

  await prisma.encounter.update({ where: { id: enc.id }, data: { status: 'closed' } });

  // AUDIT (then anchor)
  await prisma.auditEvent.create({
    data: {
      kind: 'encounter_closed',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: enc.id,
      meta: { caseId: enc.caseId },
    },
  });

  const anchor = await anchorEncounter(enc.id, canonical);

  return NextResponse.json({ ok: true, anchor }, { headers: { 'access-control-allow-origin': '*' } });
}
