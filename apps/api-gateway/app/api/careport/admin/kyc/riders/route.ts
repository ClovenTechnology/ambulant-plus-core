import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { orgIdFromHeaders, requireRole } from '@/src/lib/careport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'access-control-allow-origin': '*' },
  });
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);

  try {
    requireRole(who, ['admin']);

    const orgId = orgIdFromHeaders(req.headers);
    const url = new URL(req.url);
    const status = clean(url.searchParams.get('status') || 'PENDING_REVIEW', 80).toUpperCase();
    const country = clean(url.searchParams.get('country') || '', 10).toUpperCase();
    const q = clean(url.searchParams.get('q') || '', 120);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 100)));

    const where: any = { orgId };
    if (status && status !== 'ALL') where.kyiStatus = status;
    if (country) where.country = country;
    if (q) {
      where.OR = [
        { userId: { contains: q, mode: 'insensitive' } },
        { kyiRejectedReason: { contains: q, mode: 'insensitive' } },
      ];
    }

    const riders = await (prisma as any).carePortRiderProfile.findMany({
      where,
      orderBy: [{ kyiSubmittedAt: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
    });

    return json({ ok: true, orgId, riders });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'careport_admin_riders_failed', riders: [] }, error?.status || 500);
  }
}
