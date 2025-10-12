import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { getJoinWindow, upsertTicket } from '@/src/lib/join';

export async function POST(req: NextRequest) {
  const b = await req.json().catch(()=> ({}));
  const visitId = b.visitId || 'demo-visit';
  const userId = req.headers.get('x-uid') || 'anon';

  const v = await prisma.televisit.findUnique({ where: { id: visitId } });
  if (!v) return NextResponse.json({ message:'Visit not found' }, { status:404 });

  const { openAt, closeAt } = getJoinWindow(Number(v.startsAtMs), v.durationMin, v.joinOpenLeadSec, v.joinCloseLagSec);
  const now = Date.now();
  if (now < openAt) return NextResponse.json({ message:'Join window not open yet' }, { status:403 });
  if (now > closeAt) return NextResponse.json({ message:'Join window has closed' }, { status:403 });

  const ttlSec = parseInt(process.env.JOIN_TOKEN_TTL_SEC || '90', 10);
  const t = await upsertTicket(visitId, userId, ttlSec);

  return NextResponse.json({
    now, visit: v,
    window: { openAt, closeAt, isOpen: true },
    ticket: { token: t.token, issuedAt: Number(t.issuedAt), expiresAt: Number(t.expiresAt), ttlSec }
  }, { headers: { 'access-control-allow-origin': '*' } });
}
