import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
import { requireOpportunityScope } from '@/src/lib/admin-opportunity-access';
import { canEditOpportunity, cleanOpportunityText } from '@/src/lib/opportunities-policy';
import { canAddOpportunityGalleryImage } from '@/src/lib/opportunity-gallery';
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
      select: { id: true, status: true, _count: { select: { galleryImages: true } } },
    });
    if (!opportunity) return json({ ok: false, error: 'opportunity_not_found' }, 404);
    if (!canEditOpportunity(opportunity.status)) {
      return json({ ok: false, error: 'opportunity_pause_before_edit' }, 409);
    }
    if (!canAddOpportunityGalleryImage(opportunity._count.galleryImages)) {
      return json({ ok: false, error: 'opportunity_gallery_limit_reached' }, 409);
    }

    const body = await request.json().catch(() => ({}));
    const objectKey = cleanOpportunityText((body as any)?.objectKey, 512);
    const altText = cleanOpportunityText((body as any)?.altText, 240);
    const caption = cleanOpportunityText((body as any)?.caption, 500) || null;
    if (!altText) return json({ ok: false, error: 'opportunity_gallery_alt_required' }, 400);
    if (!enterpriseMediaObjectBelongsTo({ objectKey, kind: 'opportunity-image', ownerId: opportunity.id })) {
      return json({ ok: false, error: 'opportunity_gallery_object_invalid' }, 400);
    }

    const upload = validateEnterpriseMediaUploadInput({
      contentType: (body as any)?.contentType,
      sizeBytes: (body as any)?.sizeBytes,
      checksumSha256: (body as any)?.checksumSha256,
    });
    await verifyEnterpriseMediaUpload({ objectKey, ...upload });

    const mediaRef = managedEnterpriseMediaRef(objectKey);
    cleanupRef = mediaRef;
    await prisma.opportunityGalleryImage.create({
      data: {
        opportunityId: opportunity.id,
        mediaRef,
        altText,
        caption,
        sortOrder: opportunity._count.galleryImages,
        createdByProfileId: actor.profileId,
      },
    });
    cleanupRef = null;

    const updated = await prisma.opportunity.findUnique({
      where: { id: opportunity.id },
      include: opportunityAdminInclude,
    });
    await writeOpportunityAudit({
      actor,
      action: 'opportunity.gallery_image.added',
      entityId: opportunity.id,
      description: 'Opportunity gallery image added',
      userAgent: request.headers.get('user-agent'),
      meta: { altText, caption: caption || undefined },
    });
    return json({ ok: true, opportunity: updated ? serializeAdminOpportunity(updated) : null });
  } catch (error) {
    if (cleanupRef) await bestEffortDeleteManagedEnterpriseMedia(cleanupRef);
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const media = enterpriseMediaErrorResponse(error);
    if (media) return json(media.body, media.status);
    console.error('[admin opportunities] gallery image confirmation failed', error);
    return json({ ok: false, error: 'opportunity_gallery_confirm_failed' }, 500);
  }
}
