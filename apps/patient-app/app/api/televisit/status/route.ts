import { NextRequest, NextResponse } from 'next/server';
import { store, getJoinWindow, getTicket } from '@runtime/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const visitId = searchParams.get('visitId') || 'demo-visit';
  const userId = req.headers.get('x-uid') || 'anon';

  const visit = store.televisits.get(visitId);
  if (!visit) return NextResponse.json({ message: 'Visit not found' }, { status: 404 });

  const window = getJoinWindow(visit);
  const now = Date.now();
  const isOpen = now >= window.openAt && now <= window.closeAt;
  const ticket = getTicket(visitId, userId);

  return NextResponse.json({
    now,
    visit,
    window: { openAt: window.openAt, closeAt: window.closeAt, isOpen },
    ticket: ticket
      ? {
          token: ticket.token,
          issuedAt: ticket.issuedAt,
          expiresAt: ticket.expiresAt,
          ttlSec: parseInt(process.env.JOIN_TOKEN_TTL_SEC || '90', 10),
        }
      : null,
  });
}
