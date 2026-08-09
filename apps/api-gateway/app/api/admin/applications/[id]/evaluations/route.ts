import { NextRequest, NextResponse } from 'next/server';
import {
  AdminStaffAuthError,
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import {
  hasApplicationScope,
} from '@/src/lib/admin-application-access';
import {
  applicationInterviewEvaluationResponse,
  getApplicationInterviewEvaluationWorkspace,
  startApplicationInterviewEvaluationCycle,
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

export async function GET(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const actor = await requireAdminStaffActor(request);
    if (
      !hasApplicationScope(actor, 'applications.interviews.evaluate') &&
      !hasApplicationScope(actor, 'applications.decision')
    ) {
      throw new AdminStaffAuthError('application_scope_required', 403);
    }
    const workspace = await getApplicationInterviewEvaluationWorkspace({
      applicationId: context.params.id,
      actor,
    });
    return json({ ok: true, ...workspace });
  } catch (error) {
    const response = known(error);
    if (response) return response;
    console.error('[admin application evaluations] get failed', error);
    return json(
      { ok: false, error: 'application_interview_evaluation_load_failed' },
      500,
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const actor = await requireAdminStaffActor(request);
    if (!hasApplicationScope(actor, 'applications.decision')) {
      throw new AdminStaffAuthError('application_scope_required', 403);
    }

    const body = await request.json().catch(() => ({}));
    await startApplicationInterviewEvaluationCycle({
      applicationId: context.params.id,
      formVersionId: body?.formVersionId,
      actor,
      userAgent: request.headers.get('user-agent'),
    });

    const workspace = await getApplicationInterviewEvaluationWorkspace({
      applicationId: context.params.id,
      actor,
    });
    return json({ ok: true, ...workspace }, 201);
  } catch (error) {
    const response = known(error);
    if (response) return response;
    console.error('[admin application evaluations] start failed', error);
    return json(
      { ok: false, error: 'application_interview_evaluation_start_failed' },
      500,
    );
  }
}
