import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  const uid = req.headers.get('x-uid') || 'pt-za-001';
  const body = await req.json().catch(() => ({}));
  const { deviceId } = body;

  if (!deviceId) {
    return NextResponse.json({ ok: false, error: 'missing_deviceId' }, { status: 400 });
  }

  try {
    const rec = await prisma.userDevice.updateMany({
      where: { userId: uid, catalogSlug: deviceId },
      data: { lastSeenAt: new Date() },
    });

    if (rec.count === 0) {
      return NextResponse.json({ ok: false, error: 'device_not_found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || 'heartbeat_failed' }, { status: 500 });
  }
}
