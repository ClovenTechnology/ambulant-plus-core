import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { push } from '@/src/lib/sse';
import { readIdentity } from '@/src/lib/identity';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  if (who.role !== 'phleb' && who.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { phlebId: bodyPhlebId, orderId, lat, lng, status } = await req.json();
  const phlebId = who.role === 'phleb' ? (who.uid || bodyPhlebId) : bodyPhlebId;

  if (!orderId || !phlebId || typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  await prisma.locationPing.create({ data: { kind: 'phleb', entityId: phlebId, orderId, lat, lng } });
  if (status) await prisma.draw.updateMany({ where: { orderId }, data: { status } });

  // AUDIT (optional)
  await prisma.auditEvent.create({
    data: {
      kind: 'draw_ping',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: orderId,
      meta: { phlebId, lat, lng, status },
    },
  });

  await push(orderId, { kind: 'phleb_ping', phlebId, lat, lng, status });
  return NextResponse.json({ ok: true }, { headers: { 'access-control-allow-origin': '*' } });
}
