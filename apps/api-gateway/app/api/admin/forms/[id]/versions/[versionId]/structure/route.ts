import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireEnterpriseFormScope } from '@/src/lib/admin-form-access';
import {
  isPrismaUniqueConstraintError,
  replaceEnterpriseFormDraftStructure,
  writeEnterpriseFormAudit,
} from '@/src/lib/admin-forms';
import {
  canEditEnterpriseFormVersion,
  validateEnterpriseFormDefinition,
  type EnterpriseFormDefinition,
} from '@/src/lib/admin-forms-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; versionId: string }> },
) {
  try {
    const actor = requireEnterpriseFormScope(
      await requireAdminStaffActor(request),
      'forms.design',
    );
    const { id, versionId } = await context.params;
    const body = await request.json().catch(() => ({} as any));
    const definition = (body?.definition ?? body) as EnterpriseFormDefinition;

    const version = await prisma.enterpriseFormVersion.findFirst({
      where: { id: versionId, formId: id },
      select: { id: true, state: true },
    });
    if (!version) {
      return json({ ok: false, error: 'enterprise_form_version_not_found' }, 404);
    }
    if (!canEditEnterpriseFormVersion(version.state)) {
      return json({ ok: false, error: 'enterprise_form_version_immutable' }, 409);
    }

    const issues = validateEnterpriseFormDefinition(definition, 'draft');
    if (issues.length) {
      return json({ ok: false, error: 'enterprise_form_definition_invalid', issues }, 400);
    }

    let saved;
    try {
      saved = await replaceEnterpriseFormDraftStructure({
        versionId,
        definition,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'enterprise_form_version_immutable') {
        return json({ ok: false, error: 'enterprise_form_version_immutable' }, 409);
      }
      throw error;
    }

    const pageCount = definition.pages.length;
    const sectionCount = definition.pages.reduce(
      (total, page) => total + page.sections.length,
      0,
    );
    const fieldCount = definition.pages.reduce(
      (total, page) =>
        total + page.sections.reduce((sum, section) => sum + section.fields.length, 0),
      0,
    );

    await writeEnterpriseFormAudit({
      actor,
      action: 'enterprise_form.version.structure_replaced',
      entityType: 'EnterpriseFormVersion',
      entityId: versionId,
      description: 'Enterprise form draft structure replaced',
      userAgent: request.headers.get('user-agent'),
      meta: {
        formId: id,
        pageCount,
        sectionCount,
        fieldCount,
        ruleCount: definition.rules?.length ?? 0,
        translationCount: definition.translations?.length ?? 0,
      },
    });

    return json({ ok: true, version: saved });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    if (isPrismaUniqueConstraintError(error)) {
      return json({ ok: false, error: 'enterprise_form_definition_conflict' }, 409);
    }
    console.error('[admin forms] structure replace failed', error);
    return json({ ok: false, error: 'enterprise_form_structure_replace_failed' }, 500);
  }
}
