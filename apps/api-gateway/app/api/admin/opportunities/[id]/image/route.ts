import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
import { requireOpportunityScope } from '@/src/lib/admin-opportunity-access';
import { canEditOpportunity, cleanOpportunityText, validHttpsUrl } from '@/src/lib/opportunities-policy';
import {
  bestEffortDeleteManagedEnterpriseMedia,
  enterpriseMediaErrorResponse,
  enterpriseMediaResponseBody,
  getEnterpriseMediaObject,
  isManagedEnterpriseMediaRef,
  objectKeyFromManagedEnterpriseMediaRef,
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

async function streamManagedRef(mediaRef: string) {
  const objectKey = objectKeyFromManagedEnterpriseMediaRef(mediaRef);
  if (!objectKey) return null;
  const object = await getEnterpriseMediaObject(objectKey);
  return new Response(enterpriseMediaResponseBody(object.bytes), {
    status: 200,
    headers: {
      'content-type': object.contentType,
      'content-length': String(object.contentLength),
      'cache-control': 'private, no-store',
      ...(object.etag ? { etag: object.etag } : {}),
    },
  });
}

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    requireOpportunityScope(await requireAdminStaffActor(request), 'opportunities.read');
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: context.params.id },
      select: {
        imageUrl: true,
        galleryImages: {
          where: { role: 'FEATURED' },
          take: 1,
          select: { mediaRef: true },
        },
      },
    });
    if (!opportunity) return json({ ok: false, error: 'opportunity_not_found' }, 404);

    const featuredRef = opportunity.galleryImages[0]?.mediaRef || null;
    if (featuredRef && isManagedEnterpriseMediaRef(featuredRef)) {
      const response = await streamManagedRef(featuredRef);
      return response || json({ ok: false, error: 'opportunity_image_not_found' }, 404);
    }

    // Backward compatibility for legacy HTTPS/managed imageUrl rows.
    if (opportunity.imageUrl && isManagedEnterpriseMediaRef(opportunity.imageUrl)) {
      const response = await streamManagedRef(opportunity.imageUrl);
      return response || json({ ok: false, error: 'opportunity_image_not_found' }, 404);
    }
    if (opportunity.imageUrl && validHttpsUrl(opportunity.imageUrl)) {
      return NextResponse.redirect(opportunity.imageUrl, 302);
    }
    return json({ ok: false, error: 'opportunity_image_not_found' }, 404);
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const media = enterpriseMediaErrorResponse(error);
    if (media) return json(media.body, media.status);
    console.error('[admin opportunities] image read failed', error);
    return json({ ok: false, error: 'opportunity_image_read_failed' }, 500);
  }
}


export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  try {
    const actor = requireOpportunityScope(
      await requireAdminStaffActor(request, { requirePassword: true }),
      'opportunities.manage',
    );
    const body = await request.json().catch(() => ({}));
    const altText = cleanOpportunityText((body as any)?.altText ?? (body as any)?.imageAlt, 240);
    const caption = cleanOpportunityText((body as any)?.caption, 500) || null;
    if (!altText) return json({ ok: false, error: 'opportunity_image_alt_required' }, 400);

    const opportunity = await prisma.opportunity.findUnique({
      where: { id: context.params.id },
      select: { id: true, status: true },
    });
    if (!opportunity) return json({ ok: false, error: 'opportunity_not_found' }, 404);
    if (!canEditOpportunity(opportunity.status)) {
      return json({ ok: false, error: 'opportunity_pause_before_edit' }, 409);
    }

    const featured = await prisma.opportunityGalleryImage.findFirst({
      where: { opportunityId: opportunity.id, role: 'FEATURED' },
      select: { id: true },
    });
    if (!featured) return json({ ok: false, error: 'opportunity_image_not_found' }, 404);

    await prisma.$transaction([
      prisma.opportunityGalleryImage.update({
        where: { id: featured.id },
        data: { altText, caption },
      }),
      prisma.opportunity.update({
        where: { id: opportunity.id },
        data: { lastUpdatedByProfileId: actor.profileId },
      }),
    ]);

    await writeOpportunityAudit({
      actor,
      action: 'opportunity.image.metadata_updated',
      entityId: opportunity.id,
      description: 'Opportunity featured image accessibility metadata updated',
      userAgent: request.headers.get('user-agent'),
      meta: { altText, caption: caption || undefined },
    });

    const updated = await prisma.opportunity.findUnique({
      where: { id: opportunity.id },
      include: opportunityAdminInclude,
    });
    return json({ ok: true, opportunity: updated ? serializeAdminOpportunity(updated) : null });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin opportunities] image update failed', error);
    return json({ ok: false, error: 'opportunity_image_update_failed' }, 500);
  }
}

export async function DELETE(request: NextRequest, context: { params: { id: string } }) {
  try {
    const actor = requireOpportunityScope(
      await requireAdminStaffActor(request, { requirePassword: true }),
      'opportunities.manage',
    );
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: context.params.id },
      select: {
        id: true,
        status: true,
        imageUrl: true,
        imageAlt: true,
        galleryImages: {
          where: { role: 'FEATURED' },
          take: 1,
          select: { id: true, mediaRef: true, altText: true },
        },
      },
    });
    if (!opportunity) return json({ ok: false, error: 'opportunity_not_found' }, 404);
    if (!canEditOpportunity(opportunity.status)) {
      return json({ ok: false, error: 'opportunity_pause_before_edit' }, 409);
    }

    const featured = opportunity.galleryImages[0] || null;
    await prisma.$transaction(async (tx) => {
      if (featured) await tx.opportunityGalleryImage.delete({ where: { id: featured.id } });
      await tx.opportunity.update({
        where: { id: opportunity.id },
        data: { imageUrl: null, imageAlt: null, lastUpdatedByProfileId: actor.profileId },
      });
    });

    await writeOpportunityAudit({
      actor,
      action: 'opportunity.image.removed',
      entityId: opportunity.id,
      description: 'Opportunity featured image removed from unified media authority',
      userAgent: request.headers.get('user-agent'),
      meta: { previousImageAlt: featured?.altText || opportunity.imageAlt || undefined },
    });
    if (featured?.mediaRef) await bestEffortDeleteManagedEnterpriseMedia(featured.mediaRef);
    if (opportunity.imageUrl) await bestEffortDeleteManagedEnterpriseMedia(opportunity.imageUrl);
    return json({ ok: true });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const media = enterpriseMediaErrorResponse(error);
    if (media) return json(media.body, media.status);
    console.error('[admin opportunities] image delete failed', error);
    return json({ ok: false, error: 'opportunity_image_delete_failed' }, 500);
  }
}
