import { NextRequest, NextResponse } from 'next/server';
import {
  cleanMeetingText,
  publicMeetingSummary,
  verifyGuestInvitation,
} from '@/src/lib/admin-meetings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function nonEnumerating(status = 401) {
  return NextResponse.json(
    { ok: false, error: 'invalid_or_expired_invitation' },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as any));
    const token = cleanMeetingText(body?.token, 800);
    const pin = cleanMeetingText(body?.pin, 32);

    if (!token) return nonEnumerating();

    const verified = await verifyGuestInvitation({
      token,
      pin: pin || null,
      headers: request.headers,
    });

    return NextResponse.json(
      {
        ok: true,
        guestSessionToken: verified.sessionToken,
        expiresAt: verified.session.expiresAt,
        meeting: publicMeetingSummary(verified.meeting),
        participant: {
          id: verified.participant.id,
          displayName: verified.participant.displayName,
          role: verified.participant.role,
        },
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error: any) {
    if (String(error?.message || '') === 'invalid_or_expired_invitation') {
      return nonEnumerating();
    }

    console.error('[meeting guest] verify failed', error);
    return nonEnumerating();
  }
}
