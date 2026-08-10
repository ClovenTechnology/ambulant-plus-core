import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
import { requireOpportunityScope } from '@/src/lib/admin-opportunity-access';
import { canEditOpportunity, cleanOpportunityText } from '@/src/lib/opportunities-policy';
import {
  bestEffortDeleteManagedEnterpriseMedia,
  enterpriseMediaErrorResponse,
  enterpriseMediaObjectBelongsTo,
  managedEnterpriseMediaRef,
  verifyEnterpriseMediaUpload,
  validateEnterpriseMediaUploadInput,
} from '@/src/lib/enterprise-media-storage';
import { serializeAdminOpportunity, opportunityAdminInclude, writeOpportunityAudit } from '@/src/lib/admin-opportunities';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  try {
    const actor = requireOpportunityScope(
      await requireAdminStaffActor(request, { requirePassword: true }),
      'opportunities.manage',
    );
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: context.params.id },
      select: { id: true, status: true, imageUrl: true },
    });
    if (!opportunity) return json({ ok: false, error: 'opportunity_not_found' }, 404);
    if (!canEditOpportunity(opportunity.status)) {
      return json({ ok: false, error: 'opportunity_pause_before_edit' }, 409);
    }

    const body = await request.json().catch(() => ({}));
    const objectKey = cleanOpportunityText((body as any)?.objectKey, 512);
    const imageAlt = cleanOpportunityText((body as any)?.imageAlt, 240);
    if (!imageAlt) return json({ ok: false, error: 'opportunity_image_alt_required' }, 400);
    if (!enterpriseMediaObjectBelongsTo({ objectKey, kind: 'opportunity-image', ownerId: opportunity.id })) {
      return json({ ok: false, error: 'opportunity_image_object_invalid' }, 400);
    }

    const upload = validateEnterpriseMediaUploadInput({
      contentType: (body as any)?.contentType,
      sizeBytes: (body as any)?.sizeBytes,
      checksumSha256: (body as any)?.checksumSha256,
    });
    await verifyEnterpriseMediaUpload({ objectKey, ...upload });

    const managedRef = managedEnterpriseMediaRef(objectKey);
    const updated = await prisma.opportunity.update({
      where: { id: opportunity.id },
      data: {
        imageUrl: managedRef,
        imageAlt,
        lastUpdatedByProfileId: actor.profileId,
      },
      include: opportunityAdminInclude,
    });

    await writeOpportunityAudit({
      actor,
      action: 'opportunity.image.updated',
      entityId: opportunity.id,
      description: 'Opportunity featured image updated',
      userAgent: request.headers.get('user-agent'),
      meta: { imageAlt },
    });

    if (opportunity.imageUrl && opportunity.imageUrl !== managedRef) {
      await bestEffortDeleteManagedEnterpriseMedia(opportunity.imageUrl);
    }

    return json({ ok: true, opportunity: serializeAdminOpportunity(updated) });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const media = enterpriseMediaErrorResponse(error);
    if (media) return json(media.body, media.status);
    console.error('[admin opportunities] image confirmation failed', error);
    return json({ ok: false, error: 'opportunity_image_confirm_failed' }, 500);
  }
}
