import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireOpportunityScope } from '@/src/lib/admin-opportunity-access';
import {
  canTransitionOpportunity,
  cleanOpportunityText,
  isOpportunityStateAction,
  validOpportunityWindow,
} from '@/src/lib/opportunities-policy';
import {
  assertOpportunityApplicationFormReady,
  assertOpportunityStoredPublishable,
  opportunityAdminInclude,
  opportunityDomainResponse,
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

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const actor = await requireAdminStaffActor(request);
    const body = await request.json().catch(() => ({} as any));
    const action = String(body?.action || '').trim().toUpperCase();
    const reason = cleanOpportunityText(body?.reason, 1000) || null;

    if (!isOpportunityStateAction(action)) {
      return json({ ok: false, error: 'invalid_opportunity_state_action' }, 400);
    }

    requireOpportunityScope(
      actor,
      action === 'ARCHIVE' ? 'opportunities.manage' : 'opportunities.publish',
    );

    const current = await prisma.opportunity.findUnique({
      where: { id: context.params.id },
    });

    if (!current) {
      return json({ ok: false, error: 'opportunity_not_found' }, 404);
    }

    if (!canTransitionOpportunity(current.status, action)) {
      return json({ ok: false, error: 'invalid_opportunity_state_transition' }, 409);
    }

    const now = new Date();
    let data: any = { lastUpdatedByProfileId: actor.profileId };
    let auditAction = '';

    if (action === 'PUBLISH') {
      assertOpportunityStoredPublishable(current);

      if (!validOpportunityWindow({ opensAt: current.opensAt, closesAt: current.closesAt })) {
        return json({ ok: false, error: 'invalid_opportunity_window' }, 400);
      }
      if (current.closesAt && current.closesAt.getTime() <= now.getTime()) {
        return json({ ok: false, error: 'opportunity_closing_time_already_passed' }, 409);
      }

      await assertOpportunityApplicationFormReady({
        applicationMode: current.applicationMode,
        applicationFormId: current.applicationFormId,
        now,
      });

      data = {
        ...data,
        status: 'PUBLISHED',
        publishedAt: current.publishedAt || now,
        publishedByProfileId: actor.profileId,
        pausedAt: null,
        pausedByProfileId: null,
        statusReason: null,
      };
      auditAction = current.status === 'PAUSED' ? 'opportunity.resumed' : 'opportunity.published';
    } else if (action === 'PAUSE') {
      data = {
        ...data,
        status: 'PAUSED',
        pausedAt: now,
        pausedByProfileId: actor.profileId,
        statusReason: reason,
      };
      auditAction = 'opportunity.paused';
    } else if (action === 'CLOSE') {
      data = {
        ...data,
        status: 'CLOSED',
        closedAt: now,
        closedByProfileId: actor.profileId,
        statusReason: reason,
      };
      auditAction = 'opportunity.closed';
    } else {
      data = {
        ...data,
        status: 'ARCHIVED',
        archivedAt: now,
        archivedByProfileId: actor.profileId,
        statusReason: reason,
      };
      auditAction = 'opportunity.archived';
    }

    const changed = await prisma.opportunity.updateMany({
      where: { id: current.id, status: current.status },
      data,
    });

    if (changed.count !== 1) {
      return json({ ok: false, error: 'opportunity_state_changed_concurrently' }, 409);
    }

    const opportunity = await prisma.opportunity.findUniqueOrThrow({
      where: { id: current.id },
      include: opportunityAdminInclude,
    });

    await writeOpportunityAudit({
      actor,
      action: auditAction,
      entityId: current.id,
      description: `Opportunity state transition: ${current.status} -> ${opportunity.status}`,
      userAgent: request.headers.get('user-agent'),
      meta: {
        from: current.status,
        to: opportunity.status,
        reason,
        applicationMode: opportunity.applicationMode,
      },
    });

    return json({ ok: true, opportunity: serializeAdminOpportunity(opportunity) });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const domain = opportunityDomainResponse(error);
    if (domain) return json(domain.body, domain.status);
    console.error('[admin opportunities] state transition failed', error);
    return json({ ok: false, error: 'opportunity_state_transition_failed' }, 500);
  }
}
