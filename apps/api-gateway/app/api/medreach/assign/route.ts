import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { emitEvent } from '@/src/lib/events';
import { readIdentity } from '@/src/lib/identity';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  if (who.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { orderId, phlebId, encounterId, patientId, clinicianId, partnerId, scheduledAt } =
    await req.json();
  if (!orderId || !encounterId || !patientId || !phlebId) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const row = await prisma.draw.create({
    data: {
      orderId,
      encounterId,
      patientId,
      clinicianId,
      partnerId,
      phlebId,
      status: scheduledAt ? 'scheduled' : 'assigned',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    },
  });

  // AUDIT
  await prisma.auditEvent.create({
    data: {
      kind: 'draw_assigned',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: orderId,
      meta: { encounterId, phlebId, partnerId, scheduledAt: row.scheduledAt },
    },
  });

  await emitEvent({
    kind: 'order_created',
    encounterId,
    patientId,
    clinicianId,
    payload: { orderId, channel: 'medreach', phlebId },
    targets: { admin: true, patientId, clinicianId },
  });

  return NextResponse.json(row, { headers: { 'access-control-allow-origin': '*' } });
}
