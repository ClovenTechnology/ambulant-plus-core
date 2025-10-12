import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { push } from '@/src/lib/sse';
import { readIdentity } from '@/src/lib/identity';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  if (who.role !== 'rider' && who.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { riderId: bodyRiderId, orderId, lat, lng, status } = await req.json();
  const riderId = who.role === 'rider' ? (who.uid || bodyRiderId) : bodyRiderId;
  if (!orderId || !riderId || typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  await prisma.locationPing.create({ data: { kind: 'rider', entityId: riderId, orderId, lat, lng } });
  if (status) await prisma.delivery.updateMany({ where: { orderId }, data: { status } });

  // AUDIT (optional / may throttle upstream)
  await prisma.auditEvent.create({
    data: {
      kind: 'delivery_ping',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: orderId,
      meta: { riderId, lat, lng, status },
    },
  });

  await push(orderId, { kind: 'rider_ping', riderId, lat, lng, status });
  return NextResponse.json({ ok: true }, { headers: { 'access-control-allow-origin': '*' } });
}
