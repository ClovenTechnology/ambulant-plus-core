import { NextRequest, NextResponse } from 'next/server';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import {
  recruitmentErrorResponse,
  updateRecruitmentTemplate,
} from '@/src/lib/admin-recruitment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const actor = await requireAdminStaffActor(request);
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(
      await updateRecruitmentTemplate({ actor, templateId: params.id, body }),
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    const recruitment = recruitmentErrorResponse(error);
    if (recruitment) return NextResponse.json(recruitment.body, { status: recruitment.status });
    console.error('[admin recruitment template] PATCH failed', error);
    return NextResponse.json({ ok: false, error: 'recruitment_template_update_failed' }, { status: 500 });
  }
}
