import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireOpportunityScope } from '@/src/lib/admin-opportunity-access';
import {
  isOpportunityType,
  cleanOpportunityText,
} from '@/src/lib/opportunities-policy';
import {
  isOpportunityUniqueConstraintError,
  opportunityAdminInclude,
  opportunityDomainResponse,
  parseOpportunityWriteInput,
  serializeAdminOpportunity,
  writeOpportunityAudit,
} from '@/src/lib/admin-opportunities';

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
    const actor = requireOpportunityScope(
      await requireAdminStaffActor(request),
      'opportunities.read',
    );

    const url = new URL(request.url);
    const q = cleanOpportunityText(url.searchParams.get('q'), 240);
    const rawStatus = cleanOpportunityText(url.searchParams.get('status'), 40).toUpperCase();
    const rawType = cleanOpportunityText(url.searchParams.get('type'), 60).toUpperCase();
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(url.searchParams.get('pageSize') || '25', 10) || 25),
    );

    const status = ['DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED', 'ARCHIVED'].includes(
      rawStatus,
    )
      ? rawStatus
      : '';
    const type = isOpportunityType(rawType) ? rawType : '';

    const where: any = {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { key: { contains: q, mode: 'insensitive' } },
              { slug: { contains: q, mode: 'insensitive' } },
              { summary: { contains: q, mode: 'insensitive' } },
              { departmentLabel: { contains: q, mode: 'insensitive' } },
              { locationLabel: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.opportunity.count({ where }),
      prisma.opportunity.findMany({
        where,
        orderBy: [
          { featured: 'desc' },
          { sortOrder: 'asc' },
          { updatedAt: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: opportunityAdminInclude,
      }),
    ]);

    return json({
      ok: true,
      actorProfileId: actor.profileId,
      page,
      pageSize,
      total,
      items: items.map((item) => serializeAdminOpportunity(item)),
    });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const domain = opportunityDomainResponse(error);
    if (domain) return json(domain.body, domain.status);
    console.error('[admin opportunities] list failed', error);
    return json({ ok: false, error: 'opportunity_list_failed' }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = requireOpportunityScope(
      await requireAdminStaffActor(request),
      'opportunities.manage',
    );
    const body = await request.json().catch(() => ({} as any));
    const input = parseOpportunityWriteInput(body);

    if (input.applicationFormId) {
      const form = await prisma.enterpriseForm.findUnique({
        where: { id: input.applicationFormId },
        select: { id: true },
      });
      if (!form) {
        return json({ ok: false, error: 'opportunity_application_form_not_found' }, 400);
      }
    }

    const created = await prisma.opportunity.create({
      data: {
        ...input,
        status: 'DRAFT',
        createdByProfileId: actor.profileId,
        lastUpdatedByProfileId: actor.profileId,
      },
      include: opportunityAdminInclude,
    });

    await writeOpportunityAudit({
      actor,
      action: 'opportunity.created',
      entityId: created.id,
      description: 'Opportunity draft created',
      userAgent: request.headers.get('user-agent'),
      meta: {
        key: created.key,
        slug: created.slug,
        type: created.type,
        applicationMode: created.applicationMode,
      },
    });

    return json({ ok: true, opportunity: serializeAdminOpportunity(created) }, 201);
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const domain = opportunityDomainResponse(error);
    if (domain) return json(domain.body, domain.status);
    if (isOpportunityUniqueConstraintError(error)) {
      return json({ ok: false, error: 'opportunity_key_or_slug_exists' }, 409);
    }
    console.error('[admin opportunities] create failed', error);
    return json({ ok: false, error: 'opportunity_create_failed' }, 500);
  }
}
