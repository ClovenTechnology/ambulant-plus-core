// apps/api-gateway/app/api/careport/location/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { push } from '@/src/lib/sse';
import { readIdentity } from '@/src/lib/identity';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  const role = String((who as any)?.role ?? 'anonymous');

  if (role !== 'rider' && role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { riderId: bodyRiderId, orderId, lat, lng, status } = await req.json();
  const riderId = role === 'rider' ? ((who as any)?.uid || bodyRiderId) : bodyRiderId;

  if (!orderId || !riderId || typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  await prisma.locationPing.create({ data: { kind: 'rider', entityId: riderId, orderId, lat, lng } });
  if (status) await prisma.delivery.updateMany({ where: { orderId }, data: { status } });

  // AUDIT (optional / may throttle upstream)
  await prisma.auditEvent.create({
    data: {
      kind: 'delivery_ping',
      actorId: (who as any)?.uid ?? null,
      actorRole: (who as any)?.role ?? 'anonymous',
      subjectId: orderId,
      meta: { riderId, lat, lng, status },
    },
  });

  await push(orderId, { kind: 'rider_ping', riderId, lat, lng, status });
  return NextResponse.json({ ok: true }, { headers: { 'access-control-allow-origin': '*' } });
}
