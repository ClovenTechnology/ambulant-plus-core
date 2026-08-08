import { NextRequest, NextResponse } from 'next/server';
import {
  parseGuestSessionHeader,
  publicMeetingSummary,
  resolveGuestSession,
} from '@/src/lib/admin-meetings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: 'guest_session_required' },
    { status: 401, headers: { 'cache-control': 'no-store' } },
  );
}

export async function GET(request: NextRequest) {
  const token = parseGuestSessionHeader(request.headers);
  const session = await resolveGuestSession(token);

  if (!session) return unauthorized();

  const invitation = session.invitation;
  const lobby =
    session.lobbyEntries.find(
      (entry) => entry.meetingId === invitation.meetingId,
    ) || null;

  return NextResponse.json(
    {
      ok: true,
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
      meeting: publicMeetingSummary(invitation.meeting),
      participant: {
        id: invitation.participant.id,
        displayName: invitation.participant.displayName,
        role: invitation.participant.role,
        state: invitation.participant.state,
      },
      lobby: lobby
        ? {
            id: lobby.id,
            state: lobby.state,
            requestedAt: lobby.requestedAt,
            decidedAt: lobby.decidedAt,
          }
        : null,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
