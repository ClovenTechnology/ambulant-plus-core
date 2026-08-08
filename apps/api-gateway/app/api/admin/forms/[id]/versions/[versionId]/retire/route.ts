import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireEnterpriseFormScope } from '@/src/lib/admin-form-access';
import { writeEnterpriseFormAudit } from '@/src/lib/admin-forms';
import { canRetireEnterpriseFormVersion } from '@/src/lib/admin-forms-policy';

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
  context: { params: Promise<{ id: string; versionId: string }> },
) {
  try {
    const actor = requireEnterpriseFormScope(
      await requireAdminStaffActor(request),
      'forms.publish',
    );
    const { id, versionId } = await context.params;

    const existing = await prisma.enterpriseFormVersion.findFirst({
      where: { id: versionId, formId: id },
    });
    if (!existing) {
      return json({ ok: false, error: 'enterprise_form_version_not_found' }, 404);
    }
    if (!canRetireEnterpriseFormVersion(existing.state)) {
      return json({ ok: false, error: 'enterprise_form_version_not_retirable' }, 409);
    }

    const retired = await prisma.enterpriseFormVersion.updateMany({
      where: { id: versionId, formId: id, state: 'PUBLISHED' },
      data: {
        state: 'RETIRED',
        retiredAt: new Date(),
        retiredByProfileId: actor.profileId,
      },
    });

    if (retired.count !== 1) {
      return json({ ok: false, error: 'enterprise_form_version_not_retirable' }, 409);
    }

    const version = await prisma.enterpriseFormVersion.findUniqueOrThrow({
      where: { id: versionId },
    });

    await writeEnterpriseFormAudit({
      actor,
      action: 'enterprise_form.version.retired',
      entityType: 'EnterpriseFormVersion',
      entityId: versionId,
      description: 'Enterprise form version retired',
      userAgent: request.headers.get('user-agent'),
      meta: {
        formId: id,
        versionNumber: version.versionNumber,
      },
    });

    return json({ ok: true, version });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin forms] retire failed', error);
    return json({ ok: false, error: 'enterprise_form_retire_failed' }, 500);
  }
}
