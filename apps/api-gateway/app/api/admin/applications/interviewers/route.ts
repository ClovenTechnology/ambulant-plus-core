import { NextRequest, NextResponse } from 'next/server';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireApplicationScope } from '@/src/lib/admin-application-access';
import { listApplicationInterviewers } from '@/src/lib/application-interviews';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    requireApplicationScope(
      await requireAdminStaffActor(request),
      'applications.interviews.schedule',
    );
    return NextResponse.json(
      { ok: true, interviewers: await listApplicationInterviewers() },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    console.error('[admin application interview] interviewer list failed', error);
    return NextResponse.json(
      { ok: false, error: 'application_interview_interviewer_list_failed' },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    );
  }
}
