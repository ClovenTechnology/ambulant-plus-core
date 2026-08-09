import { NextRequest, NextResponse } from 'next/server';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import {
  createRecruitmentTemplate,
  getRecruitmentWorkspace,
  recruitmentErrorResponse,
} from '@/src/lib/admin-recruitment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(request);
    return json(await getRecruitmentWorkspace(actor));
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const recruitment = recruitmentErrorResponse(error);
    if (recruitment) return json(recruitment.body, recruitment.status);
    console.error('[admin recruitment] GET failed', error);
    return json({ ok: false, error: 'recruitment_workspace_failed' }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(request);
    const body = await request.json().catch(() => ({}));
    return json(await createRecruitmentTemplate({ actor, body }), 201);
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const recruitment = recruitmentErrorResponse(error);
    if (recruitment) return json(recruitment.body, recruitment.status);
    console.error('[admin recruitment] POST failed', error);
    return json({ ok: false, error: 'recruitment_template_create_failed' }, 500);
  }
}
