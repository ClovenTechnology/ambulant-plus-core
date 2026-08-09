import { NextRequest, NextResponse } from 'next/server';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireApplicationScope } from '@/src/lib/admin-application-access';
import {
  applicationInterviewEvaluationResponse,
  saveOwnApplicationInterviewEvaluation,
  submitOwnApplicationInterviewEvaluation,
} from '@/src/lib/application-interview-evaluations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function known(error: unknown) {
  const auth = adminStaffAuthResponse(error);
  if (auth) return json(auth.body, auth.status);
  const evaluation = applicationInterviewEvaluationResponse(error);
  if (evaluation) return json(evaluation.body, evaluation.status);
  return null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const actor = requireApplicationScope(
      await requireAdminStaffActor(request),
      'applications.interviews.evaluate',
    );
    const body = await request.json().catch(() => ({}));
    const result = await saveOwnApplicationInterviewEvaluation({
      applicationId: context.params.id,
      answers: body?.answers,
      actor,
    });
    return json(result);
  } catch (error) {
    const response = known(error);
    if (response) return response;
    console.error('[admin application evaluation] save failed', error);
    return json(
      { ok: false, error: 'application_interview_evaluation_save_failed' },
      500,
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const actor = requireApplicationScope(
      await requireAdminStaffActor(request),
      'applications.interviews.evaluate',
    );
    const body = await request.json().catch(() => ({}));
    const result = await submitOwnApplicationInterviewEvaluation({
      applicationId: context.params.id,
      answers: body?.answers,
      actor,
    });
    return json(result);
  } catch (error) {
    const response = known(error);
    if (response) return response;
    console.error('[admin application evaluation] submit failed', error);
    return json(
      { ok: false, error: 'application_interview_evaluation_submit_failed' },
      500,
    );
  }
}
