import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { push } from '@/src/lib/sse';
import { readIdentity } from '@/src/lib/identity';

export const dynamic = 'force-dynamic';

type CarePortRole = 'admin' | 'rider' | 'patient' | 'clinician' | 'anonymous';

function roleOf(who: ReturnType<typeof readIdentity>): CarePortRole {
  return String((who as any)?.role || 'anonymous') as CarePortRole;
}

function uidOf(who: ReturnType<typeof readIdentity>): string {
  return String((who as any)?.uid || '');
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  const role = roleOf(who);
  const uid = uidOf(who);

  if (role !== 'rider' && role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { riderId: bodyRiderId, orderId, lat, lng, status } = await req.json().catch(() => ({}));

  const riderId = role === 'rider' ? (uid || bodyRiderId) : bodyRiderId;

  if (!orderId || !riderId || typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  await prisma.locationPing.create({
    data: {
      kind: 'rider',
      entityId: String(riderId),
      orderId: String(orderId),
      lat,
      lng,
    },
  });

  if (status) {
    await prisma.delivery.updateMany({
      where: { orderId: String(orderId) },
      data: { status: String(status) },
    });
  }

  await prisma.auditEvent
    .create({
      data: {
        kind: 'delivery_ping',
        actorId: uid || null,
        actorRole: role,
        subjectId: String(orderId),
        meta: { riderId, lat, lng, status },
      },
    })
    .catch(() => null);

  await push(String(orderId), {
    kind: 'rider_ping',
    riderId,
    lat,
    lng,
    status,
  });

  return NextResponse.json(
    { ok: true },
    { headers: { 'access-control-allow-origin': '*' } },
  );
}