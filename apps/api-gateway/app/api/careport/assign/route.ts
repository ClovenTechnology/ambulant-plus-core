import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { emitEvent } from '@/src/lib/events';
import { readIdentity } from '@/src/lib/identity';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  if (who.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { orderId, riderId, encounterId, patientId, clinicianId, partnerId } = await req.json();
  if (!orderId || !encounterId || !patientId || !riderId) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const row = await prisma.delivery.create({
    data: { orderId, encounterId, patientId, clinicianId, partnerId, riderId, status: 'assigned' },
  });

  // AUDIT
  await prisma.auditEvent.create({
    data: {
      kind: 'delivery_assigned',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: orderId,
      meta: { encounterId, riderId, partnerId },
    },
  });

  await emitEvent({
    kind: 'order_created',
    encounterId,
    patientId,
    clinicianId,
    payload: { orderId, channel: 'careport', riderId },
    targets: { admin: true, patientId, clinicianId },
  });

  return NextResponse.json(row, { headers: { 'access-control-allow-origin': '*' } });
}
