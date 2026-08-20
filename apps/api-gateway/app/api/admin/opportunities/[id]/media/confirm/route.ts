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
  validateEnterpriseMediaUploadInput,
  verifyEnterpriseMediaUpload,
} from '@/src/lib/enterprise-media-storage';
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

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  let cleanupRef: string | null = null;
  try {
    const actor = requireOpportunityScope(
      await requireAdminStaffActor(request, { requirePassword: true }),
      'opportunities.manage',
    );
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: context.params.id },
      select: { id: true, status: true },
    });
    if (!opportunity) return json({ ok: false, error: 'opportunity_not_found' }, 404);
    if (!canEditOpportunity(opportunity.status)) {
      return json({ ok: false, error: 'opportunity_pause_before_edit' }, 409);
    }

    const contentCount = await prisma.opportunityGalleryImage.count({
      where: { opportunityId: opportunity.id, role: 'CONTENT' },
    });
    if (contentCount >= 40) {
      return json({ ok: false, error: 'opportunity_content_media_limit_reached' }, 409);
    }

    const body = await request.json().catch(() => ({}));
    const objectKey = cleanOpportunityText((body as any)?.objectKey, 512);
    const altText = cleanOpportunityText((body as any)?.altText, 240);
    const caption = cleanOpportunityText((body as any)?.caption, 500) || null;
    if (!altText) return json({ ok: false, error: 'opportunity_content_media_alt_required' }, 400);
    if (!enterpriseMediaObjectBelongsTo({ objectKey, kind: 'opportunity-image', ownerId: opportunity.id })) {
      return json({ ok: false, error: 'opportunity_content_media_object_invalid' }, 400);
    }

    const upload = validateEnterpriseMediaUploadInput({
      contentType: (body as any)?.contentType,
      sizeBytes: (body as any)?.sizeBytes,
      checksumSha256: (body as any)?.checksumSha256,
    });
    await verifyEnterpriseMediaUpload({ objectKey, ...upload });

    cleanupRef = managedEnterpriseMediaRef(objectKey);
    const media = await prisma.opportunityGalleryImage.create({
      data: {
        opportunityId: opportunity.id,
        role: 'CONTENT',
        mediaRef: cleanupRef,
        altText,
        caption,
        sortOrder: contentCount,
        createdByProfileId: actor.profileId,
      },
    });
    cleanupRef = null;

    await writeOpportunityAudit({
      actor,
      action: 'opportunity.content_media.added',
      entityId: opportunity.id,
      description: 'Opportunity Publishing Studio inline image added',
      userAgent: request.headers.get('user-agent'),
      meta: { mediaId: media.id, altText, caption: caption || undefined },
    });

    const updated = await prisma.opportunity.findUnique({
      where: { id: opportunity.id },
      include: opportunityAdminInclude,
    });
    return json({
      ok: true,
      media: {
        id: media.id,
        role: media.role,
        imageUrl: `/api/admin/opportunities/${encodeURIComponent(opportunity.id)}/media/${encodeURIComponent(media.id)}`,
        altText: media.altText,
        caption: media.caption,
      },
      opportunity: updated ? serializeAdminOpportunity(updated) : null,
    });
  } catch (error) {
    if (cleanupRef) await bestEffortDeleteManagedEnterpriseMedia(cleanupRef);
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const media = enterpriseMediaErrorResponse(error);
    if (media) return json(media.body, media.status);
    console.error('[admin opportunities] content media confirm failed', error);
    return json({ ok: false, error: 'opportunity_content_media_confirm_failed' }, 500);
  }
}
