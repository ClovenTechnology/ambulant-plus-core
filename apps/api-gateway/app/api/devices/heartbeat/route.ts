import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity, requireTrustedAuthenticatedIdentity } from '@/src/lib/identity';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  try { requireTrustedAuthenticatedIdentity(who); }
  catch { return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 }); }
  const b = await req.json().catch(() => ({}));
  if (!b.deviceId) return NextResponse.json({ ok: false, error: 'missing_deviceId' }, { status: 400 });
  try {
    const rec = await prisma.userDevice.updateMany({ where: { userId: who.uid!, catalogSlug: b.deviceId }, data: { lastSeenAt: new Date() } });
    if (rec.count === 0) return NextResponse.json({ ok: false, error: 'device_not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, ts: Date.now() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || 'heartbeat_failed' }, { status: 500 });
  }
}
