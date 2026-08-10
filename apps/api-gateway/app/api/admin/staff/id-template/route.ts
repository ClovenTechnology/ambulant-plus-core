import { NextRequest, NextResponse } from 'next/server';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
import { getStaffIdTemplate, staffEmploymentErrorResponse, updateStaffIdTemplate } from '@/src/lib/staff-employment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(request);
    return NextResponse.json(await getStaffIdTemplate(actor), { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    const handled = staffEmploymentErrorResponse(error);
    if (handled) return NextResponse.json(handled.body, { status: handled.status });
    return NextResponse.json({ ok: false, error: 'staff_id_template_load_failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(request, { requirePassword: true });
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await updateStaffIdTemplate({ actor, body }), { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    const handled = staffEmploymentErrorResponse(error);
    if (handled) return NextResponse.json(handled.body, { status: handled.status });
    return NextResponse.json({ ok: false, error: 'staff_id_template_update_failed' }, { status: 500 });
  }
}
