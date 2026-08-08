import { NextRequest, NextResponse } from 'next/server';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireApplicationScope } from '@/src/lib/admin-application-access';
import { listApplicationReviewers } from '@/src/lib/admin-applications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function GET(request: NextRequest) {
  try {
    requireApplicationScope(
      await requireAdminStaffActor(request),
      'applications.assign',
    );

    return json({
      ok: true,
      reviewers: await listApplicationReviewers(),
    });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin applications] reviewers failed', error);
    return json({ ok: false, error: 'application_reviewer_list_failed' }, 500);
  }
}
