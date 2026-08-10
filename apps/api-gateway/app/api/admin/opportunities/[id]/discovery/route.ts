import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireOpportunityScope } from '@/src/lib/admin-opportunity-access';
import { canEditOpportunity } from '@/src/lib/opportunities-policy';
import {
  opportunityAdminInclude,
  serializeAdminOpportunity,
  writeOpportunityAudit,
} from '@/src/lib/admin-opportunities';
import { generateOpportunityDiscovery } from '@/src/lib/opportunity-discovery';

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
  { params }: { params: { id: string } },
) {
  try {
    const actor = requireOpportunityScope(
      await requireAdminStaffActor(request),
      'opportunities.manage',
    );

    const current = await prisma.opportunity.findUnique({
      where: { id: params.id },
    });

    if (!current) return json({ ok: false, error: 'opportunity_not_found' }, 404);
    if (!canEditOpportunity(current.status)) {
      return json({ ok: false, error: 'opportunity_pause_before_edit' }, 409);
    }

    const generated = generateOpportunityDiscovery({
      title: current.title,
      type: current.type,
      summary: current.summary,
      description: current.description,
      tags: current.tags,
      audienceLabel: current.audienceLabel,
      commitmentLabel: current.commitmentLabel,
      commercialLabel: current.commercialLabel,
      ctaLabel: current.ctaLabel,
      departmentLabel: current.departmentLabel,
      locationMode: current.locationMode,
      locationLabel: current.locationLabel,
      countryCode: current.countryCode,
      opensAt: current.opensAt,
      closesAt: current.closesAt,
    });

    const updated = await prisma.opportunity.update({
      where: { id: current.id },
      data: {
        seoTitle: generated.seoTitle,
        seoDescription: generated.seoDescription,
        aeoSummary: generated.aeoSummary,
        aeoQuestions: generated.aeoQuestions,
        discoveryMeta: generated.discoveryMeta,
        lastUpdatedByProfileId: actor.profileId,
      },
      include: opportunityAdminInclude,
    });

    await writeOpportunityAudit({
      actor,
      action: 'opportunity.discovery.generated',
      entityId: updated.id,
      description: 'SEO and answer-ready discovery metadata regenerated',
      userAgent: request.headers.get('user-agent'),
      meta: {
        generator: (generated.discoveryMeta as any).generator,
        questionCount: generated.aeoQuestions.length,
      },
    });

    return json({ ok: true, opportunity: serializeAdminOpportunity(updated) });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin opportunities] discovery generation failed', error);
    return json({ ok: false, error: 'opportunity_discovery_generation_failed' }, 500);
  }
}
