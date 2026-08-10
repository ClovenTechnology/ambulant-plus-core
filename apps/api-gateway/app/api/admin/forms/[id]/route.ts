import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import {
  hasEnterpriseFormScope,
  requireEnterpriseFormScope,
} from '@/src/lib/admin-form-access';
import {
  canPermanentlyDeleteEnterpriseForm,
  cleanFormText,
  normaliseFormSlug,
  validFormLocale,
  validFormSlug,
} from '@/src/lib/admin-forms-policy';
import {
  isPrismaUniqueConstraintError,
  writeEnterpriseFormAudit,
} from '@/src/lib/admin-forms';

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
    const actor = requireEnterpriseFormScope(await requireAdminStaffActor(request), 'forms.read');
    const { id } = await context.params;

    const form = await prisma.enterpriseForm.findUnique({
      where: { id },
      include: {
        _count: {
          select: { submissions: true, opportunities: true, recruitmentTemplates: true },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            state: true,
            accessMode: true,
            title: true,
            description: true,
            locale: true,
            fallbackLocale: true,
            submitLabel: true,
            allowSaveResume: true,
            acceptingFrom: true,
            acceptingUntil: true,
            retentionDays: true,
            createdFromVersionId: true,
            publishedAt: true,
            retiredAt: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                applications: true,
                applicationInterviewEvaluationCycles: true,
                recruitmentEvaluationTemplates: true,
              },
            },
          },
        },
      },
    });

    if (!form) return json({ ok: false, error: 'enterprise_form_not_found' }, 404);
    const canDelete = actor.isSuperAdmin && canPermanentlyDeleteEnterpriseForm({
      submissionCount: form._count.submissions,
      opportunityCount: form._count.opportunities,
      recruitmentTemplateCount: form._count.recruitmentTemplates,
      versions: form.versions.map((version) => ({
        state: version.state,
        publishedAt: version.publishedAt,
        applicationCount: version._count.applications,
        evaluationCycleCount: version._count.applicationInterviewEvaluationCycles,
        recruitmentEvaluationTemplateCount: version._count.recruitmentEvaluationTemplates,
      })),
    });
    return json({ ok: true, form, permissions: { canDelete } });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin forms] detail failed', error);
    return json({ ok: false, error: 'enterprise_form_detail_failed' }, 500);
  }
}

export async function PATCH(
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

    const existing = await prisma.enterpriseForm.findUnique({ where: { id } });
    if (!existing) return json({ ok: false, error: 'enterprise_form_not_found' }, 404);

    const data: any = {};
    const changes: string[] = [];

    if (Object.prototype.hasOwnProperty.call(body, 'name')) {
      const name = cleanFormText(body?.name, 240);
      if (!name) return json({ ok: false, error: 'enterprise_form_name_required' }, 400);
      data.name = name;
      changes.push('name');
    }

    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      data.description = cleanFormText(body?.description, 8000) || null;
      changes.push('description');
    }

    if (Object.prototype.hasOwnProperty.call(body, 'slug')) {
      const slug = normaliseFormSlug(body?.slug);
      if (!validFormSlug(slug)) {
        return json({ ok: false, error: 'invalid_enterprise_form_slug' }, 400);
      }
      const collision = await prisma.enterpriseForm.findFirst({
        where: { slug, id: { not: id } },
        select: { id: true },
      });
      if (collision) return json({ ok: false, error: 'enterprise_form_slug_exists' }, 409);
      data.slug = slug;
      changes.push('slug');
    }

    if (Object.prototype.hasOwnProperty.call(body, 'defaultLocale')) {
      const locale = cleanFormText(body?.defaultLocale, 20);
      if (!validFormLocale(locale)) {
        return json({ ok: false, error: 'invalid_enterprise_form_locale' }, 400);
      }
      data.defaultLocale = locale;
      changes.push('defaultLocale');
    }

    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      if (!hasEnterpriseFormScope(actor, 'forms.publish')) {
        return json({ ok: false, error: 'enterprise_form_publish_scope_required' }, 403);
      }
      const status = cleanFormText(body?.status, 40).toUpperCase();
      if (!['ACTIVE', 'ARCHIVED'].includes(status)) {
        return json({ ok: false, error: 'invalid_enterprise_form_status' }, 400);
      }
      data.status = status;
      data.archivedAt = status === 'ARCHIVED' ? new Date() : null;
      data.archivedByProfileId = status === 'ARCHIVED' ? actor.profileId : null;
      changes.push('status');
    }

    if (!changes.length) {
      return json({ ok: false, error: 'enterprise_form_no_changes' }, 400);
    }

    const form = await prisma.enterpriseForm.update({ where: { id }, data });

    await writeEnterpriseFormAudit({
      actor,
      action: 'enterprise_form.updated',
      entityType: 'EnterpriseForm',
      entityId: id,
      description: 'Enterprise form metadata updated',
      userAgent: request.headers.get('user-agent'),
      meta: { changes },
    });

    return json({ ok: true, form });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    if (isPrismaUniqueConstraintError(error)) {
      return json({ ok: false, error: 'enterprise_form_slug_exists' }, 409);
    }
    console.error('[admin forms] update failed', error);
    return json({ ok: false, error: 'enterprise_form_update_failed' }, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = requireEnterpriseFormScope(
      await requireAdminStaffActor(request, { requirePassword: true }),
      'forms.design',
    );
    if (!actor.isSuperAdmin) return json({ ok: false, error: 'super_admin_required' }, 403);
    const body = await request.json().catch(() => ({} as any));
    if (String(body?.confirm || '') !== 'DELETE') {
      return json({ ok: false, error: 'delete_confirmation_required' }, 400);
    }
    const { id } = await context.params;
    const form = await prisma.enterpriseForm.findUnique({
      where: { id },
      include: {
        _count: { select: { submissions: true, opportunities: true, recruitmentTemplates: true } },
        versions: {
          select: {
            id: true,
            state: true,
            publishedAt: true,
            _count: {
              select: {
                applications: true,
                applicationInterviewEvaluationCycles: true,
                recruitmentEvaluationTemplates: true,
              },
            },
          },
        },
      },
    });
    if (!form) return json({ ok: false, error: 'enterprise_form_not_found' }, 404);

    const allowed = canPermanentlyDeleteEnterpriseForm({
      submissionCount: form._count.submissions,
      opportunityCount: form._count.opportunities,
      recruitmentTemplateCount: form._count.recruitmentTemplates,
      versions: form.versions.map((version) => ({
        state: version.state,
        publishedAt: version.publishedAt,
        applicationCount: version._count.applications,
        evaluationCycleCount: version._count.applicationInterviewEvaluationCycles,
        recruitmentEvaluationTemplateCount: version._count.recruitmentEvaluationTemplates,
      })),
    });
    if (!allowed) return json({ ok: false, error: 'enterprise_form_delete_not_allowed' }, 409);

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          actorUserId: actor.userId,
          actorType: 'ADMIN',
          actorRefId: actor.profileId,
          app: 'admin-dashboard',
          action: 'enterprise_form.deleted',
          entityType: 'EnterpriseForm',
          entityId: form.id,
          description: 'Unused enterprise form permanently deleted',
          userAgent: request.headers.get('user-agent') || undefined,
          meta: { name: form.name, key: form.key, slug: form.slug },
        },
      });
      await tx.enterpriseFormVersion.deleteMany({ where: { formId: form.id } });
      await tx.enterpriseForm.delete({ where: { id: form.id } });
    });
    return json({ ok: true });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin forms] delete failed', error);
    return json({ ok: false, error: 'enterprise_form_delete_failed' }, 500);
  }
}

