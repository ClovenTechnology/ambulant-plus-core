import { NextRequest, NextResponse } from 'next/server';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
import { recordStaffEmploymentChange, staffEmploymentErrorResponse } from '@/src/lib/staff-employment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireAdminStaffActor(request, { requirePassword: true });
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await recordStaffEmploymentChange({ request, actor, staffProfileId: params.id, body }), { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    const handled = staffEmploymentErrorResponse(error);
    if (handled) return NextResponse.json(handled.body, { status: handled.status });
    console.error('[staff employment changes] POST failed', error);
    return NextResponse.json({ ok: false, error: 'staff_employment_change_failed' }, { status: 500 });
  }
}
