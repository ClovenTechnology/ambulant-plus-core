import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const uid = req.headers.get('x-uid') || 'pt-za-001';
  const b = await req.json().catch(() => ({}));

  if (!b.deviceId) {
    return NextResponse.json({ ok: false, error: 'missing_deviceId' }, { status: 400 });
  }

  try {
    const rec = await prisma.userDevice.updateMany({
      where: { userId: uid, catalogSlug: b.deviceId },
      data: { lastSeenAt: new Date() },
    });

    if (rec.count === 0) {
      return NextResponse.json({ ok: false, error: 'device_not_found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, ts: Date.now() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || 'heartbeat_failed' }, { status: 500 });
  }
}
