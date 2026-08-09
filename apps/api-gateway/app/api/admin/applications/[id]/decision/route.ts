import { NextRequest, NextResponse } from 'next/server';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireApplicationScope } from '@/src/lib/admin-application-access';
import {
  applicationInterviewEvaluationResponse,
  makeApplicationRecruitmentDecision,
} from '@/src/lib/application-interview-evaluations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const actor = requireApplicationScope(
      await requireAdminStaffActor(request),
      'applications.decision',
    );
    const body = await request.json().catch(() => ({}));
    const result = await makeApplicationRecruitmentDecision({
      applicationId: context.params.id,
      expectedStatus: body?.expectedStatus,
      decision: body?.decision,
      reason: body?.reason,
      applicantMessage: body?.applicantMessage,
      actor,
      userAgent: request.headers.get('user-agent'),
    });
    return json(result);
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const evaluation = applicationInterviewEvaluationResponse(error);
    if (evaluation) return json(evaluation.body, evaluation.status);
    console.error('[admin application decision] failed', error);
    return json({ ok: false, error: 'application_recruitment_decision_failed' }, 500);
  }
}
