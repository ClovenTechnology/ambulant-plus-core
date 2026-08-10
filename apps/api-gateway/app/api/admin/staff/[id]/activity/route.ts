import { NextRequest, NextResponse } from 'next/server';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
import { staffActivityAnalytics, StaffActivityError } from '@/src/lib/staff-activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireAdminStaffActor(request);
    const days = new URL(request.url).searchParams.get('days');
    return NextResponse.json(
      await staffActivityAnalytics({ actor, staffProfileId: params.id, days }),
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    if (error instanceof StaffActivityError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error('[staff activity] GET failed', error);
    return NextResponse.json({ ok: false, error: 'staff_activity_load_failed' }, { status: 500 });
  }
}
