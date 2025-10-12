import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { emitEvent } from '@/src/lib/events';
import { readIdentity } from '@/src/lib/identity';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  if (who.role !== 'clinician' && who.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  const id = `LAB-${Math.floor(2000 + Math.random() * 9000)}`;

  const enc = b.encounterId
    ? await prisma.encounter.findUnique({ where: { id: b.encounterId } })
    : null;

  const encounterId = b.encounterId ?? 'enc-za-001';
  const caseId      = b.caseId      ?? enc?.caseId      ?? 'case-za-001';
  const patientId   = b.patientId   ?? enc?.patientId   ?? 'pt-za-001';
  const clinicianId = b.clinicianId ?? enc?.clinicianId ?? (who.role === 'clinician' ? who.uid : 'clin-za-001');

  if (who.role === 'clinician' && who.uid && clinicianId !== who.uid) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const row = await prisma.labOrder.create({
    data: {
      id,
      kind: 'lab',
      encounterId,
      sessionId: b.sessionId ?? 'sess-001',
      caseId,
      patientId,
      clinicianId,
      panel: b.panel ?? 'CBC',
    },
  });

  // AUDIT
  await prisma.auditEvent.create({
    data: {
      kind: 'lab_created',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: row.id,
      meta: { encounterId, patientId, clinicianId },
    },
  });

  await emitEvent({
    kind: 'order_created',
    encounterId: row.encounterId,
    patientId,
    clinicianId,
    payload: { orderId: row.id, kind: 'lab' },
    targets: { admin: true, patientId, clinicianId },
  });

  return NextResponse.json(row, { status: 201, headers: { 'access-control-allow-origin': '*' } });
}
