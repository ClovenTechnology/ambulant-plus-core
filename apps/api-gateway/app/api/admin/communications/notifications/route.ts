import { NextRequest, NextResponse } from 'next/server';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
import { communicationsErrorResponse, updateStaffNotifications } from '@/src/lib/admin-communications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(request);
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await updateStaffNotifications({ actor, body }), {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    const comms = communicationsErrorResponse(error);
    if (comms) return NextResponse.json(comms.body, { status: comms.status });
    console.error('[admin communications] notification update failed', error);
    return NextResponse.json({ ok: false, error: 'staff_notification_update_failed' }, { status: 500 });
  }
}
