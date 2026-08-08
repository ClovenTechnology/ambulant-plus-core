import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireEnterpriseFormScope } from '@/src/lib/admin-form-access';
import {
  enterpriseFormVersionStructureInclude,
  toEnterpriseFormDefinition,
  writeEnterpriseFormAudit,
} from '@/src/lib/admin-forms';
import {
  validSubmissionWindow,
  validateEnterpriseFormDefinition,
  type FormDefinitionIssue,
} from '@/src/lib/admin-forms-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

class FormPublishValidationError extends Error {
  issues: FormDefinitionIssue[];

  constructor(issues: FormDefinitionIssue[]) {
    super('enterprise_form_definition_invalid');
    this.issues = issues;
  }
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

    const now = new Date();

    let published;
    try {
      published = await prisma.$transaction(async (tx) => {
        const guard = await tx.enterpriseFormVersion.updateMany({
          where: { id: versionId, formId: id, state: 'DRAFT' },
          data: { updatedAt: now },
        });

        if (guard.count !== 1) {
          throw new Error('enterprise_form_version_not_publishable');
        }

        const form = await tx.enterpriseForm.findUnique({
          where: { id },
          select: { id: true, status: true },
        });
        if (!form) throw new Error('enterprise_form_not_found');
        if (form.status !== 'ACTIVE') throw new Error('enterprise_form_archived');

        const lockedVersion = await tx.enterpriseFormVersion.findUniqueOrThrow({
          where: { id: versionId },
          include: enterpriseFormVersionStructureInclude,
        });

        if (!validSubmissionWindow(lockedVersion)) {
          throw new Error('invalid_enterprise_form_submission_window');
        }

        const issues = validateEnterpriseFormDefinition(
          toEnterpriseFormDefinition(lockedVersion),
          'publish',
        );
        if (issues.length) {
          throw new FormPublishValidationError(issues);
        }

        await tx.enterpriseFormVersion.updateMany({
          where: {
            formId: id,
            state: 'PUBLISHED',
            id: { not: versionId },
          },
          data: {
            state: 'RETIRED',
            retiredAt: now,
            retiredByProfileId: actor.profileId,
          },
        });

        return tx.enterpriseFormVersion.update({
          where: { id: versionId },
          data: {
            state: 'PUBLISHED',
            publishedAt: now,
            publishedByProfileId: actor.profileId,
            retiredAt: null,
            retiredByProfileId: null,
          },
        });
      });
    } catch (error) {
      if (error instanceof FormPublishValidationError) {
        return json(
          {
            ok: false,
            error: 'enterprise_form_definition_invalid',
            issues: error.issues,
          },
          400,
        );
      }
      if (error instanceof Error) {
        if (error.message === 'enterprise_form_not_found') {
          return json({ ok: false, error: error.message }, 404);
        }
        if (
          error.message === 'enterprise_form_archived' ||
          error.message === 'enterprise_form_version_not_publishable'
        ) {
          return json({ ok: false, error: error.message }, 409);
        }
        if (error.message === 'invalid_enterprise_form_submission_window') {
          return json({ ok: false, error: error.message }, 400);
        }
      }
      throw error;
    }

    await writeEnterpriseFormAudit({
      actor,
      action: 'enterprise_form.version.published',
      entityType: 'EnterpriseFormVersion',
      entityId: versionId,
      description: 'Enterprise form version published',
      userAgent: request.headers.get('user-agent'),
      meta: {
        formId: id,
        versionNumber: published.versionNumber,
      },
    });

    return json({ ok: true, version: published });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin forms] publish failed', error);
    return json({ ok: false, error: 'enterprise_form_publish_failed' }, 500);
  }
}
