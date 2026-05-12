// apps/api-gateway/app/api/medreach/location/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { push } from '@/src/lib/sse';
import { readIdentity } from '@/src/lib/identity';

export const dynamic = 'force-dynamic';

type MedReachRole = 'admin' | 'phleb' | 'patient' | 'clinician' | 'anonymous';

function roleOf(who: ReturnType<typeof readIdentity>): MedReachRole {
  return String((who as any)?.role || 'anonymous') as MedReachRole;
}

function uidOf(who: ReturnType<typeof readIdentity>): string {
  return String((who as any)?.uid || '');
}

export async function POST(req: NextRequest) {
  try {
    const who = readIdentity(req.headers);
    const role = roleOf(who);
    const uid = uidOf(who);

    if (role !== 'phleb' && role !== 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { phlebId: bodyPhlebId, orderId, lat, lng, status } = body;

    const phlebId = role === 'phleb' ? (uid || bodyPhlebId) : bodyPhlebId;

    if (!orderId || !phlebId || typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }

    await prisma.locationPing.create({
      data: {
        kind: 'phleb',
        entityId: String(phlebId),
        orderId: String(orderId),
        lat,
        lng,
      },
    });

    const drawDelegate = (prisma as any).draw;

    if (status && drawDelegate?.updateMany) {
      await drawDelegate.updateMany({
        where: { orderId: String(orderId) },
        data: { status: String(status) },
      });
    }

    await prisma.auditEvent
      .create({
        data: {
          kind: 'draw_ping',
          actorId: uid || null,
          actorRole: role,
          subjectId: String(orderId),
          meta: { phlebId, lat, lng, status },
        },
      })
      .catch(() => null);

    await push(String(orderId), {
      kind: 'phleb_ping',
      phlebId,
      lat,
      lng,
      status,
    });

    return NextResponse.json(
      { ok: true },
      { headers: { 'access-control-allow-origin': '*' } },
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'location_update_failed' },
      { status: 500 },
    );
  }
}