import { NextRequest, NextResponse } from 'next/server';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
import { getStaffEmploymentWorkspace, staffEmploymentErrorResponse, updateStaffEmployment } from '@/src/lib/staff-employment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireAdminStaffActor(request);
    return NextResponse.json(await getStaffEmploymentWorkspace({ actor, staffProfileId: params.id }), { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    const handled = staffEmploymentErrorResponse(error);
    if (handled) return NextResponse.json(handled.body, { status: handled.status });
    console.error('[staff employment] GET failed', error);
    return NextResponse.json({ ok: false, error: 'staff_employment_load_failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireAdminStaffActor(request, { requirePassword: true });
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await updateStaffEmployment({ request, actor, staffProfileId: params.id, body }), { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    const handled = staffEmploymentErrorResponse(error);
    if (handled) return NextResponse.json(handled.body, { status: handled.status });
    console.error('[staff employment] PATCH failed', error);
    return NextResponse.json({ ok: false, error: 'staff_employment_update_failed' }, { status: 500 });
  }
}
