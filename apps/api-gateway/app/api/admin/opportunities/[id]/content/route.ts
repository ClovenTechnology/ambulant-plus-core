import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
import { requireOpportunityScope } from '@/src/lib/admin-opportunity-access';
import { canEditOpportunity } from '@/src/lib/opportunities-policy';
import { normaliseOpportunityContentDocument } from '@/src/lib/opportunity-content';
import {
  opportunityAdminInclude,
  serializeAdminOpportunity,
  writeOpportunityAudit,
} from '@/src/lib/admin-opportunities';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

function revisionKind(value: unknown): 'AUTOSAVE' | 'MANUAL' | 'RESTORED' {
  const kind = String(value || '').trim().toUpperCase();
  return kind === 'MANUAL' || kind === 'RESTORED' ? kind : 'AUTOSAVE';
}

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  try {
    const actor = requireOpportunityScope(
      await requireAdminStaffActor(request),
      'opportunities.manage',
    );
    const body = await request.json().catch(() => ({}));
    const expectedRevision = Number((body as any)?.expectedRevision);
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
      return json({ ok: false, error: 'invalid_opportunity_content_revision' }, 400);
    }

    let document: Prisma.InputJsonObject | null;
    try {
      document = normaliseOpportunityContentDocument((body as any)?.document);
    } catch (error: any) {
      return json({ ok: false, error: String(error?.message || 'invalid_opportunity_content_document') }, 400);
    }
    const showFaq = (body as any)?.showFaq !== false;
    const kind = revisionKind((body as any)?.kind);

    const current = await prisma.opportunity.findUnique({
      where: { id: context.params.id },
      select: { id: true, status: true, contentRevision: true },
    });
    if (!current) return json({ ok: false, error: 'opportunity_not_found' }, 404);
    if (!canEditOpportunity(current.status)) {
      return json({ ok: false, error: 'opportunity_pause_before_edit' }, 409);
    }
    if (current.contentRevision !== expectedRevision) {
      return json({
        ok: false,
        error: 'opportunity_content_changed_concurrently',
        currentRevision: current.contentRevision,
      }, 409);
    }

    const nextRevision = expectedRevision + 1;
    await prisma.$transaction(async (tx) => {
      const changed = await tx.opportunity.updateMany({
        where: { id: current.id, contentRevision: expectedRevision, status: current.status },
        data: {
          contentDocument: document ?? Prisma.JsonNull,
          contentSchemaVersion: 1,
          contentRevision: nextRevision,
          showFaq,
          lastUpdatedByProfileId: actor.profileId,
        },
      });
      if (changed.count !== 1) {
        throw new Error('opportunity_content_changed_concurrently');
      }
      await tx.opportunityRevision.create({
        data: {
          opportunityId: current.id,
          revisionNumber: nextRevision,
          kind,
          contentDocument: document ?? Prisma.JsonNull,
          showFaq,
          createdByProfileId: actor.profileId,
        },
      });
    });

    const updated = await prisma.opportunity.findUnique({
      where: { id: current.id },
      include: opportunityAdminInclude,
    });

    await writeOpportunityAudit({
      actor,
      action: kind === 'AUTOSAVE' ? 'opportunity.content.autosaved' : 'opportunity.content.saved',
      entityId: current.id,
      description: `Opportunity Publishing Studio content revision ${nextRevision}`,
      userAgent: request.headers.get('user-agent'),
      meta: { revisionNumber: nextRevision, kind, showFaq },
    });

    return json({
      ok: true,
      opportunity: updated ? serializeAdminOpportunity(updated) : null,
      revision: nextRevision,
    });
  } catch (error: any) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    if (String(error?.message || '') === 'opportunity_content_changed_concurrently') {
      return json({ ok: false, error: 'opportunity_content_changed_concurrently' }, 409);
    }
    console.error('[admin opportunities] content save failed', error);
    return json({ ok: false, error: 'opportunity_content_save_failed' }, 500);
  }
}
