import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireEnterpriseFormScope } from '@/src/lib/admin-form-access';
import {
  cleanFormText,
  normaliseFormKey,
  normaliseFormSlug,
  validFormKey,
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

export async function GET(request: NextRequest) {
  try {
    const actor = requireEnterpriseFormScope(
      await requireAdminStaffActor(request),
      'forms.read',
    );

    const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || '1') || 1);
    const pageSize = Math.min(
      100,
      Math.max(10, Number(request.nextUrl.searchParams.get('pageSize') || '30') || 30),
    );
    const q = cleanFormText(request.nextUrl.searchParams.get('q'), 240);
    const statusText = cleanFormText(request.nextUrl.searchParams.get('status'), 40).toUpperCase();

    if (statusText && !['ACTIVE', 'ARCHIVED'].includes(statusText)) {
      return json({ ok: false, error: 'invalid_enterprise_form_status' }, 400);
    }

    const where: any = {
      ...(statusText ? { status: statusText } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { key: { contains: q, mode: 'insensitive' } },
              { slug: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.enterpriseForm.count({ where }),
      prisma.enterpriseForm.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 10,
            select: {
              id: true,
              versionNumber: true,
              state: true,
              accessMode: true,
              locale: true,
              publishedAt: true,
              retiredAt: true,
              updatedAt: true,
            },
          },
        },
      }),
    ]);

    return json({
      ok: true,
      actorProfileId: actor.profileId,
      page,
      pageSize,
      total,
      items: rows,
    });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin forms] list failed', error);
    return json({ ok: false, error: 'enterprise_form_list_failed' }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = requireEnterpriseFormScope(
      await requireAdminStaffActor(request),
      'forms.design',
    );
    const body = await request.json().catch(() => ({} as any));

    const name = cleanFormText(body?.name, 240);
    const key = normaliseFormKey(body?.key || name);
    const slug = normaliseFormSlug(body?.slug || name);
    const description = cleanFormText(body?.description, 8000) || null;
    const defaultLocale = cleanFormText(body?.defaultLocale, 20) || 'en';

    if (!name) return json({ ok: false, error: 'enterprise_form_name_required' }, 400);
    if (!validFormKey(key)) return json({ ok: false, error: 'invalid_enterprise_form_key' }, 400);
    if (!validFormSlug(slug)) return json({ ok: false, error: 'invalid_enterprise_form_slug' }, 400);
    if (!validFormLocale(defaultLocale)) {
      return json({ ok: false, error: 'invalid_enterprise_form_locale' }, 400);
    }

    const collision = await prisma.enterpriseForm.findFirst({
      where: { OR: [{ key }, { slug }] },
      select: { id: true, key: true, slug: true },
    });

    if (collision) {
      return json({ ok: false, error: 'enterprise_form_key_or_slug_exists' }, 409);
    }

    const created = await prisma.$transaction(async (tx) => {
      const form = await tx.enterpriseForm.create({
        data: {
          key,
          slug,
          name,
          description,
          defaultLocale,
          createdByProfileId: actor.profileId,
        },
      });

      const version = await tx.enterpriseFormVersion.create({
        data: {
          formId: form.id,
          versionNumber: 1,
          state: 'DRAFT',
          accessMode: 'PUBLIC',
          title: name,
          description,
          locale: defaultLocale,
          createdByProfileId: actor.profileId,
        },
      });

      return { form, version };
    });

    await writeEnterpriseFormAudit({
      actor,
      action: 'enterprise_form.created',
      entityType: 'EnterpriseForm',
      entityId: created.form.id,
      description: 'Enterprise form and initial draft version created',
      userAgent: request.headers.get('user-agent'),
      meta: {
        key,
        slug,
        versionId: created.version.id,
        versionNumber: 1,
      },
    });

    return json({ ok: true, ...created }, 201);
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    if (isPrismaUniqueConstraintError(error)) {
      return json({ ok: false, error: 'enterprise_form_key_or_slug_exists' }, 409);
    }
    console.error('[admin forms] create failed', error);
    return json({ ok: false, error: 'enterprise_form_create_failed' }, 500);
  }
}
