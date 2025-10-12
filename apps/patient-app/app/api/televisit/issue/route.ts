import { NextRequest, NextResponse } from 'next/server';
import { store, getJoinWindow, upsertTicket } from '@runtime/store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const visitId = body?.visitId || 'demo-visit';
  const userId = req.headers.get('x-uid') || 'anon';

  const visit = store.televisits.get(visitId);
  if (!visit) return NextResponse.json({ message: 'Visit not found' }, { status: 404 });

  const { openAt, closeAt } = getJoinWindow(visit);
  const now = Date.now();
  if (now < openAt) return NextResponse.json({ message: 'Join window not open yet' }, { status: 403 });
  if (now > closeAt) return NextResponse.json({ message: 'Join window has closed' }, { status: 403 });

  const ttlSec = parseInt(process.env.JOIN_TOKEN_TTL_SEC || '90', 10);
  const ticket = upsertTicket(visitId, userId, ttlSec);

  return NextResponse.json({
    now,
    visit,
    window: { openAt, closeAt, isOpen: true },
    ticket: { token: ticket.token, issuedAt: ticket.issuedAt, expiresAt: ticket.expiresAt, ttlSec },
  });
}
