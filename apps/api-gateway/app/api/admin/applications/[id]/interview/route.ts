import { NextRequest, NextResponse } from 'next/server';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import {
  hasApplicationScope,
  requireApplicationScope,
} from '@/src/lib/admin-application-access';
import {
  applicationInterviewResponse,
  cancelApplicationInterview,
  latestApplicationInterview,
  rescheduleApplicationInterview,
  scheduleApplicationInterview,
  serializeAdminApplicationInterview,
} from '@/src/lib/application-interviews';
import { issueApplicationAccessLinkForApplication } from '@/src/lib/public-application-portal';

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
  const interview = applicationInterviewResponse(error);
  if (interview) return json(interview.body, interview.status);
  return null;
}

export async function GET(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const actor = requireApplicationScope(
      await requireAdminStaffActor(request),
      'applications.interviews.read',
    );
    const interview = await latestApplicationInterview(context.params.id);
    return json({
      ok: true,
      permissions: {
        canRead: true,
        canSchedule: hasApplicationScope(actor, 'applications.interviews.schedule'),
        canManage: hasApplicationScope(actor, 'applications.interviews.manage'),
      },
      interview: serializeAdminApplicationInterview(interview),
    });
  } catch (error) {
    const response = known(error);
    if (response) return response;
    console.error('[admin application interview] get failed', error);
    return json({ ok: false, error: 'application_interview_load_failed' }, 500);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const actor = requireApplicationScope(
      await requireAdminStaffActor(request),
      'applications.interviews.schedule',
    );
    const body = await request.json().catch(() => ({}));
    const result = await scheduleApplicationInterview({
      applicationId: context.params.id,
      actor: {
        actorType: 'ADMIN',
        actorRefId: actor.profileId,
        actorUserId: actor.userId,
      },
      schedule: body,
    });

    if (result.application.applicantEmailNormalized) {
      await issueApplicationAccessLinkForApplication({
        applicationId: result.application.id,
        referenceCode: result.application.referenceCode,
        applicantEmailNormalized: result.application.applicantEmailNormalized,
        opportunityTitle: result.application.opportunityTitle,
        reason: 'interview_invited',
        revokeExisting: false,
      }).catch(() => null);
    }

    return json({ ok: true, ...result }, 201);
  } catch (error) {
    const response = known(error);
    if (response) return response;
    console.error('[admin application interview] schedule failed', error);
    return json({ ok: false, error: 'application_interview_schedule_failed' }, 500);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const actor = requireApplicationScope(
      await requireAdminStaffActor(request),
      'applications.interviews.manage',
    );
    const body = await request.json().catch(() => ({}));
    const result = await rescheduleApplicationInterview({
      applicationId: context.params.id,
      actor: {
        actorType: 'ADMIN',
        actorRefId: actor.profileId,
        actorUserId: actor.userId,
      },
      schedule: body,
    });

    if (result.application.applicantEmailNormalized) {
      await issueApplicationAccessLinkForApplication({
        applicationId: result.application.id,
        referenceCode: result.application.referenceCode,
        applicantEmailNormalized: result.application.applicantEmailNormalized,
        opportunityTitle: result.application.opportunityTitle,
        reason: 'interview_rescheduled',
        revokeExisting: false,
      }).catch(() => null);
    }

    return json({ ok: true, ...result });
  } catch (error) {
    const response = known(error);
    if (response) return response;
    console.error('[admin application interview] reschedule failed', error);
    return json({ ok: false, error: 'application_interview_reschedule_failed' }, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const actor = requireApplicationScope(
      await requireAdminStaffActor(request),
      'applications.interviews.manage',
    );
    const body = await request.json().catch(() => ({}));
    const result = await cancelApplicationInterview({
      applicationId: context.params.id,
      actor: {
        actorType: 'ADMIN',
        actorRefId: actor.profileId,
        actorUserId: actor.userId,
      },
      reason: body?.reason,
      applicantMessage: body?.applicantMessage,
    });
    return json(result);
  } catch (error) {
    const response = known(error);
    if (response) return response;
    console.error('[admin application interview] cancel failed', error);
    return json({ ok: false, error: 'application_interview_cancel_failed' }, 500);
  }
}
