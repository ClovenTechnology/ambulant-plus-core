import { NextRequest, NextResponse } from 'next/server';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
import { recordStaffActivity, StaffActivityError } from '@/src/lib/staff-activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(request);
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(
      await recordStaffActivity({ request, actor, body }),
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    if (error instanceof StaffActivityError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error('[staff activity] POST failed', error);
    return NextResponse.json({ ok: false, error: 'staff_activity_record_failed' }, { status: 500 });
  }
}
