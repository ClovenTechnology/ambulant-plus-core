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
    requireEnterpriseFormScope(await requireAdminStaffActor(request), 'forms.read');
    const { id } = await context.params;

    const form = await prisma.enterpriseForm.findUnique({
      where: { id },
      include: {
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
          },
        },
      },
    });

    if (!form) return json({ ok: false, error: 'enterprise_form_not_found' }, 404);
    return json({ ok: true, form });
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
