import { NextRequest, NextResponse } from 'next/server';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireApplicationScope } from '@/src/lib/admin-application-access';
import {
  adminApplicationResponse,
  cleanApplicationPayload,
  transitionApplication,
} from '@/src/lib/admin-applications';
import {
  isApplicationStatus,
} from '@/src/lib/applications-policy';

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
    const actor = await requireAdminStaffActor(request);
    const body = cleanApplicationPayload(await request.json().catch(() => ({})));
    const expectedStatus = String(body.expectedStatus || '').trim().toUpperCase();
    const toStatus = String(body.toStatus || '').trim().toUpperCase();

    if (!isApplicationStatus(expectedStatus) || !isApplicationStatus(toStatus)) {
      return json({ ok: false, error: 'invalid_application_status_transition' }, 400);
    }

    requireApplicationScope(
      actor,
      toStatus === 'DECLINED' ? 'applications.decision' : 'applications.review',
    );

    const result = await transitionApplication({
      applicationId: context.params.id,
      expectedStatus,
      toStatus,
      reason: body.reason == null ? null : String(body.reason),
      actor,
      userAgent: request.headers.get('user-agent'),
    });

    return json({ ok: true, ...result });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const domain = adminApplicationResponse(error);
    if (domain) return json(domain.body, domain.status);
    console.error('[admin applications] transition failed', error);
    return json({ ok: false, error: 'application_transition_failed' }, 500);
  }
}
