import { NextRequest, NextResponse } from 'next/server';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
import { communicationsErrorResponse, reconnectDirectStaffCall } from '@/src/lib/admin-communications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireAdminStaffActor(request);
    return NextResponse.json(await reconnectDirectStaffCall({ actor, meetingId: params.id }), {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    const comms = communicationsErrorResponse(error);
    if (comms) return NextResponse.json(comms.body, { status: comms.status });
    console.error('[admin communications] direct call reconnect failed', error);
    return NextResponse.json({ ok: false, error: 'direct_call_reconnect_failed' }, { status: 500 });
  }
}
