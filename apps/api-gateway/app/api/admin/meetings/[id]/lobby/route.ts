import { NextRequest, NextResponse } from 'next/server';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import {
  meetingForActor,
  requireMeetingModeration,
} from '@/src/lib/admin-meeting-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const actor = await requireAdminStaffActor(request);
    const access = await meetingForActor(params.id, actor);
    requireMeetingModeration(access);

    return NextResponse.json(
      {
        ok: true,
        entries: access.meeting.lobbyEntries,
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) {
      return NextResponse.json(auth.body, { status: auth.status });
    }

    console.error('[admin meetings] lobby list failed', error);
    return NextResponse.json(
      { ok: false, error: 'meeting_lobby_list_failed' },
      { status: 500 },
    );
  }
}
