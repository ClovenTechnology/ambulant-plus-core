import { NextRequest, NextResponse } from 'next/server';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireApplicationScope } from '@/src/lib/admin-application-access';
import {
  applicationInterviewResponse,
  resendApplicationInterviewInvitation,
} from '@/src/lib/application-interviews';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const actor = requireApplicationScope(
      await requireAdminStaffActor(request),
      'applications.interviews.manage',
    );
    const result = await resendApplicationInterviewInvitation({
      applicationId: context.params.id,
      actor: {
        actorType: 'ADMIN',
        actorRefId: actor.profileId,
        actorUserId: actor.userId,
      },
    });
    return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    const interview = applicationInterviewResponse(error);
    if (interview) return NextResponse.json(interview.body, { status: interview.status });
    console.error('[admin application interview] resend failed', error);
    return NextResponse.json(
      { ok: false, error: 'application_interview_resend_failed' },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    );
  }
}
