import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireOpportunityScope } from '@/src/lib/admin-opportunity-access';
import { canEditOpportunity } from '@/src/lib/opportunities-policy';
import {
  isOpportunityUniqueConstraintError,
  opportunityAdminInclude,
  opportunityDomainResponse,
  parseOpportunityWriteInput,
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

export async function GET(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    requireOpportunityScope(
      await requireAdminStaffActor(request),
      'opportunities.read',
    );

    const opportunity = await prisma.opportunity.findUnique({
      where: { id: context.params.id },
      include: opportunityAdminInclude,
    });

    if (!opportunity) {
      return json({ ok: false, error: 'opportunity_not_found' }, 404);
    }

    return json({ ok: true, opportunity });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin opportunities] detail failed', error);
    return json({ ok: false, error: 'opportunity_detail_failed' }, 500);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const actor = requireOpportunityScope(
      await requireAdminStaffActor(request),
      'opportunities.manage',
    );

    const current = await prisma.opportunity.findUnique({
      where: { id: context.params.id },
    });

    if (!current) {
      return json({ ok: false, error: 'opportunity_not_found' }, 404);
    }

    if (!canEditOpportunity(current.status)) {
      return json({ ok: false, error: 'opportunity_pause_before_edit' }, 409);
    }

    const body = await request.json().catch(() => ({} as any));
    const input = parseOpportunityWriteInput(body, current);

    if (input.applicationFormId) {
      const form = await prisma.enterpriseForm.findUnique({
        where: { id: input.applicationFormId },
        select: { id: true },
      });
      if (!form) {
        return json({ ok: false, error: 'opportunity_application_form_not_found' }, 400);
      }
    }

    const updated = await prisma.opportunity.update({
      where: { id: current.id },
      data: {
        ...input,
        lastUpdatedByProfileId: actor.profileId,
      },
      include: opportunityAdminInclude,
    });

    await writeOpportunityAudit({
      actor,
      action: 'opportunity.updated',
      entityId: updated.id,
      description: 'Opportunity draft/pause-safe fields updated',
      userAgent: request.headers.get('user-agent'),
      meta: {
        status: updated.status,
        key: updated.key,
        slug: updated.slug,
        applicationMode: updated.applicationMode,
      },
    });

    return json({ ok: true, opportunity: updated });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const domain = opportunityDomainResponse(error);
    if (domain) return json(domain.body, domain.status);
    if (isOpportunityUniqueConstraintError(error)) {
      return json({ ok: false, error: 'opportunity_key_or_slug_exists' }, 409);
    }
    console.error('[admin opportunities] update failed', error);
    return json({ ok: false, error: 'opportunity_update_failed' }, 500);
  }
}
