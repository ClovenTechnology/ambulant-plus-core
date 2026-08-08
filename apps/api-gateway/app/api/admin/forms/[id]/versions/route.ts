import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireEnterpriseFormScope } from '@/src/lib/admin-form-access';
import {
  createEnterpriseFormDraftVersion,
  isPrismaUniqueConstraintError,
  writeEnterpriseFormAudit,
} from '@/src/lib/admin-forms';
import { cleanFormText } from '@/src/lib/admin-forms-policy';

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
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireEnterpriseFormScope(await requireAdminStaffActor(request), 'forms.read');
    const { id } = await context.params;

    const form = await prisma.enterpriseForm.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!form) return json({ ok: false, error: 'enterprise_form_not_found' }, 404);

    const versions = await prisma.enterpriseFormVersion.findMany({
      where: { formId: id },
      orderBy: { versionNumber: 'desc' },
    });

    return json({ ok: true, versions });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin forms] version list failed', error);
    return json({ ok: false, error: 'enterprise_form_version_list_failed' }, 500);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = requireEnterpriseFormScope(
      await requireAdminStaffActor(request),
      'forms.design',
    );
    const { id } = await context.params;
    const body = await request.json().catch(() => ({} as any));

    const form = await prisma.enterpriseForm.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!form) return json({ ok: false, error: 'enterprise_form_not_found' }, 404);
    if (form.status !== 'ACTIVE') {
      return json({ ok: false, error: 'enterprise_form_archived' }, 409);
    }

    const sourceVersionId = cleanFormText(body?.sourceVersionId, 120) || null;

    let version;
    try {
      version = await createEnterpriseFormDraftVersion({
        formId: id,
        actorProfileId: actor.profileId,
        sourceVersionId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'enterprise_form_draft_already_exists') {
        return json({ ok: false, error: message }, 409);
      }
      if (message === 'enterprise_form_source_version_not_found') {
        return json({ ok: false, error: message }, 404);
      }
      throw error;
    }

    await writeEnterpriseFormAudit({
      actor,
      action: 'enterprise_form.version.created',
      entityType: 'EnterpriseFormVersion',
      entityId: version.id,
      description: 'Enterprise form draft version created',
      userAgent: request.headers.get('user-agent'),
      meta: {
        formId: id,
        versionNumber: version.versionNumber,
        sourceVersionId,
      },
    });

    return json({ ok: true, version }, 201);
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    if (isPrismaUniqueConstraintError(error)) {
      return json({ ok: false, error: 'enterprise_form_version_conflict' }, 409);
    }
    console.error('[admin forms] version create failed', error);
    return json({ ok: false, error: 'enterprise_form_version_create_failed' }, 500);
  }
}
