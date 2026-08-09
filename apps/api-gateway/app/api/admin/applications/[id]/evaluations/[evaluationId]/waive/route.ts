import { NextRequest, NextResponse } from 'next/server';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireApplicationScope } from '@/src/lib/admin-application-access';
import {
  applicationInterviewEvaluationResponse,
  waiveApplicationInterviewEvaluation,
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
  context: { params: { id: string; evaluationId: string } },
) {
  try {
    const actor = requireApplicationScope(
      await requireAdminStaffActor(request),
      'applications.decision',
    );
    const body = await request.json().catch(() => ({}));
    const result = await waiveApplicationInterviewEvaluation({
      applicationId: context.params.id,
      evaluationId: context.params.evaluationId,
      reason: body?.reason,
      actor,
    });
    return json(result);
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const evaluation = applicationInterviewEvaluationResponse(error);
    if (evaluation) return json(evaluation.body, evaluation.status);
    console.error('[admin application evaluation] waive failed', error);
    return json(
      { ok: false, error: 'application_interview_evaluation_waive_failed' },
      500,
    );
  }
}
