//apps/api-gateway/app/api/devices/online/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/devices/online?window=300
 * Returns { count } = devices seen within the window (seconds).
 *
 * Primary signal: UserDevice.lastSeenAt
 * Fallback signal: Device.updatedAt (if you don't use UserDevice heartbeat)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const winSecRaw = parseInt(searchParams.get('window') || '300', 10);
    const winSec = Number.isFinite(winSecRaw) ? Math.max(30, Math.min(winSecRaw, 24 * 60 * 60)) : 300; // clamp 30s..24h
    const since = new Date(Date.now() - winSec * 1000);

    // Prefer UserDevice heartbeat if present
    let count = 0;
    try {
      count = await prisma.userDevice.count({
        where: { lastSeenAt: { gte: since } },
      });
    } catch {
      // ignore; fallback next
    }

    // Fallback to Device.updatedAt if no user-device rows match or table unused
    if (!count) {
      try {
        count = await prisma.device.count({
          where: { updatedAt: { gte: since } },
        });
      } catch {
        // ignore; will return 0
      }
    }

    return NextResponse.json({ count, windowSeconds: winSec, since: since.toISOString() });
  } catch (err: any) {
    console.error('GET /api/devices/online error', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
