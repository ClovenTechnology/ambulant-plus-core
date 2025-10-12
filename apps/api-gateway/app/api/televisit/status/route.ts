import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { getJoinWindow } from '@/src/lib/join';

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const visitId = u.searchParams.get('visitId') || 'demo-visit';
  const userId = req.headers.get('x-uid') || 'anon';

  const v = await prisma.televisit.findUnique({ where: { id: visitId } });
  if (!v) return NextResponse.json({ message: 'Visit not found' }, { status: 404 });

  const win = getJoinWindow(Number(v.startsAtMs), v.durationMin, v.joinOpenLeadSec, v.joinCloseLagSec);
  const now = Date.now();
  const isOpen = now >= win.openAt && now <= win.closeAt;

  const t = await prisma.ticket.findFirst({ where: { visitId, userId } });

  return NextResponse.json({
    now, visit: v,
    window: { openAt: win.openAt, closeAt: win.closeAt, isOpen },
    ticket: t ? { token: t.token, issuedAt: Number(t.issuedAt), expiresAt: Number(t.expiresAt), ttlSec: 90 } : null,
  }, { headers: { 'access-control-allow-origin': '*' } });
}
