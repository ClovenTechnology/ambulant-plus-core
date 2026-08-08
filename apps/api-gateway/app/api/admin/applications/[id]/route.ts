import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireApplicationScope } from '@/src/lib/admin-application-access';
import {
  applicationAdminDetailInclude,
  serializeAdminApplication,
} from '@/src/lib/admin-applications';
import { hasEnterpriseFormScope } from '@/src/lib/admin-form-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const actor = requireApplicationScope(
      await requireAdminStaffActor(request),
      'applications.read',
    );

    const application = await prisma.application.findUnique({
      where: { id: context.params.id },
      include: applicationAdminDetailInclude,
    });

    if (!application) {
      return json({ ok: false, error: 'application_not_found' }, 404);
    }

    const canReadSubmission = hasEnterpriseFormScope(
      actor,
      'forms.submissions.read',
    );
    const canReadSensitive =
      canReadSubmission &&
      hasEnterpriseFormScope(actor, 'forms.submissions.sensitive.read');

    return json({
      ok: true,
      application: serializeAdminApplication(application, {
        canReadSubmission,
        canReadSensitive,
      }),
    });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin applications] detail failed', error);
    return json({ ok: false, error: 'application_detail_failed' }, 500);
  }
}
