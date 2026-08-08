import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireEnterpriseFormScope } from '@/src/lib/admin-form-access';
import {
  asNullableJsonInput,
  enterpriseFormVersionStructureInclude,
  writeEnterpriseFormAudit,
} from '@/src/lib/admin-forms';
import {
  canEditEnterpriseFormVersion,
  cleanFormText,
  isEnterpriseFormAccessMode,
  validFormLocale,
  validSubmissionWindow,
} from '@/src/lib/admin-forms-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function parseNullableDate(value: unknown): Date | null | 'invalid' {
  if (value == null || value === '') return null;
  const parsed = new Date(String(value));
  return Number.isFinite(parsed.getTime()) ? parsed : 'invalid';
}

function isJsonObjectOrNull(value: unknown) {
  return value == null || (typeof value === 'object' && !Array.isArray(value));
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; versionId: string }> },
) {
  try {
    requireEnterpriseFormScope(await requireAdminStaffActor(request), 'forms.read');
    const { id, versionId } = await context.params;

    const version = await prisma.enterpriseFormVersion.findFirst({
      where: { id: versionId, formId: id },
      include: enterpriseFormVersionStructureInclude,
    });

    if (!version) {
      return json({ ok: false, error: 'enterprise_form_version_not_found' }, 404);
    }

    return json({ ok: true, version });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin forms] version detail failed', error);
    return json({ ok: false, error: 'enterprise_form_version_detail_failed' }, 500);
  }
}

export async function PATCH(
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

    const existing = await prisma.enterpriseFormVersion.findFirst({
      where: { id: versionId, formId: id },
    });
    if (!existing) {
      return json({ ok: false, error: 'enterprise_form_version_not_found' }, 404);
    }
    if (!canEditEnterpriseFormVersion(existing.state)) {
      return json({ ok: false, error: 'enterprise_form_version_immutable' }, 409);
    }

    const data: any = {};
    const changes: string[] = [];

    if (Object.prototype.hasOwnProperty.call(body, 'title')) {
      const title = cleanFormText(body?.title, 240);
      if (!title) return json({ ok: false, error: 'enterprise_form_version_title_required' }, 400);
      data.title = title;
      changes.push('title');
    }

    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      data.description = cleanFormText(body?.description, 8000) || null;
      changes.push('description');
    }

    if (Object.prototype.hasOwnProperty.call(body, 'accessMode')) {
      const accessMode = cleanFormText(body?.accessMode, 40).toUpperCase();
      if (!isEnterpriseFormAccessMode(accessMode)) {
        return json({ ok: false, error: 'invalid_enterprise_form_access_mode' }, 400);
      }
      data.accessMode = accessMode;
      changes.push('accessMode');
    }

    if (Object.prototype.hasOwnProperty.call(body, 'locale')) {
      const locale = cleanFormText(body?.locale, 20);
      if (!validFormLocale(locale)) {
        return json({ ok: false, error: 'invalid_enterprise_form_locale' }, 400);
      }
      data.locale = locale;
      changes.push('locale');
    }

    if (Object.prototype.hasOwnProperty.call(body, 'fallbackLocale')) {
      const fallbackLocale = cleanFormText(body?.fallbackLocale, 20) || null;
      if (fallbackLocale && !validFormLocale(fallbackLocale)) {
        return json({ ok: false, error: 'invalid_enterprise_form_fallback_locale' }, 400);
      }
      data.fallbackLocale = fallbackLocale;
      changes.push('fallbackLocale');
    }

    if (Object.prototype.hasOwnProperty.call(body, 'submitLabel')) {
      const submitLabel = cleanFormText(body?.submitLabel, 120);
      if (!submitLabel) {
        return json({ ok: false, error: 'enterprise_form_submit_label_required' }, 400);
      }
      data.submitLabel = submitLabel;
      changes.push('submitLabel');
    }

    if (Object.prototype.hasOwnProperty.call(body, 'allowSaveResume')) {
      if (typeof body?.allowSaveResume !== 'boolean') {
        return json({ ok: false, error: 'invalid_enterprise_form_save_resume' }, 400);
      }
      data.allowSaveResume = body.allowSaveResume;
      changes.push('allowSaveResume');
    }

    const acceptingFrom = Object.prototype.hasOwnProperty.call(body, 'acceptingFrom')
      ? parseNullableDate(body?.acceptingFrom)
      : existing.acceptingFrom;
    const acceptingUntil = Object.prototype.hasOwnProperty.call(body, 'acceptingUntil')
      ? parseNullableDate(body?.acceptingUntil)
      : existing.acceptingUntil;

    if (acceptingFrom === 'invalid' || acceptingUntil === 'invalid') {
      return json({ ok: false, error: 'invalid_enterprise_form_submission_window' }, 400);
    }
    if (!validSubmissionWindow({ acceptingFrom, acceptingUntil })) {
      return json({ ok: false, error: 'invalid_enterprise_form_submission_window' }, 400);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'acceptingFrom')) {
      data.acceptingFrom = acceptingFrom;
      changes.push('acceptingFrom');
    }
    if (Object.prototype.hasOwnProperty.call(body, 'acceptingUntil')) {
      data.acceptingUntil = acceptingUntil;
      changes.push('acceptingUntil');
    }

    if (Object.prototype.hasOwnProperty.call(body, 'retentionDays')) {
      const retentionDays = body?.retentionDays == null ? null : Number(body.retentionDays);
      if (
        retentionDays != null &&
        (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650)
      ) {
        return json({ ok: false, error: 'invalid_enterprise_form_retention_days' }, 400);
      }
      data.retentionDays = retentionDays;
      changes.push('retentionDays');
    }

    for (const key of ['branding', 'settings', 'notificationRules', 'antiSpamPolicy'] as const) {
      if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
      if (!isJsonObjectOrNull(body?.[key])) {
        return json({ ok: false, error: `invalid_enterprise_form_${key}` }, 400);
      }
      data[key] = asNullableJsonInput(body?.[key]);
      changes.push(key);
    }

    if (!changes.length) {
      return json({ ok: false, error: 'enterprise_form_version_no_changes' }, 400);
    }

    const updated = await prisma.enterpriseFormVersion.updateMany({
      where: { id: versionId, formId: id, state: 'DRAFT' },
      data,
    });

    if (updated.count !== 1) {
      return json({ ok: false, error: 'enterprise_form_version_immutable' }, 409);
    }

    const version = await prisma.enterpriseFormVersion.findUniqueOrThrow({
      where: { id: versionId },
    });

    await writeEnterpriseFormAudit({
      actor,
      action: 'enterprise_form.version.updated',
      entityType: 'EnterpriseFormVersion',
      entityId: versionId,
      description: 'Enterprise form draft version metadata updated',
      userAgent: request.headers.get('user-agent'),
      meta: { formId: id, changes },
    });

    return json({ ok: true, version });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin forms] version update failed', error);
    return json({ ok: false, error: 'enterprise_form_version_update_failed' }, 500);
  }
}
