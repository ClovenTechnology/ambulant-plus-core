import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
import { requireOpportunityScope } from '@/src/lib/admin-opportunity-access';
import { canEditOpportunity, cleanOpportunityText, validHttpsUrl } from '@/src/lib/opportunities-policy';
import { normaliseOpportunityGallerySortOrder } from '@/src/lib/opportunity-gallery';
import {
  bestEffortDeleteManagedEnterpriseMedia,
  enterpriseMediaErrorResponse,
  getEnterpriseMediaObject,
  isManagedEnterpriseMediaRef,
  objectKeyFromManagedEnterpriseMediaRef,
  enterpriseMediaResponseBody,
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

async function findImage(opportunityId: string, imageId: string) {
  return prisma.opportunityGalleryImage.findFirst({
    where: { id: imageId, opportunityId },
    include: { opportunity: { select: { id: true, status: true } } },
  });
}

export async function GET(request: NextRequest, context: { params: { id: string; imageId: string } }) {
  try {
    requireOpportunityScope(await requireAdminStaffActor(request), 'opportunities.read');
    const image = await findImage(context.params.id, context.params.imageId);
    if (!image) return json({ ok: false, error: 'opportunity_gallery_image_not_found' }, 404);

    if (isManagedEnterpriseMediaRef(image.mediaRef)) {
      const objectKey = objectKeyFromManagedEnterpriseMediaRef(image.mediaRef);
      if (!objectKey) return json({ ok: false, error: 'opportunity_gallery_image_not_found' }, 404);
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
    if (validHttpsUrl(image.mediaRef)) return NextResponse.redirect(image.mediaRef, 302);
    return json({ ok: false, error: 'opportunity_gallery_image_not_found' }, 404);
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const media = enterpriseMediaErrorResponse(error);
    if (media) return json(media.body, media.status);
    console.error('[admin opportunities] gallery image read failed', error);
    return json({ ok: false, error: 'opportunity_gallery_image_read_failed' }, 500);
  }
}

export async function PATCH(request: NextRequest, context: { params: { id: string; imageId: string } }) {
  try {
    const actor = requireOpportunityScope(
      await requireAdminStaffActor(request, { requirePassword: true }),
      'opportunities.manage',
    );
    const image = await findImage(context.params.id, context.params.imageId);
    if (!image) return json({ ok: false, error: 'opportunity_gallery_image_not_found' }, 404);
    if (!canEditOpportunity(image.opportunity.status)) {
      return json({ ok: false, error: 'opportunity_pause_before_edit' }, 409);
    }

    const body = await request.json().catch(() => ({}));
    const altText = cleanOpportunityText((body as any)?.altText, 240);
    const caption = cleanOpportunityText((body as any)?.caption, 500) || null;
    const sortOrder = normaliseOpportunityGallerySortOrder((body as any)?.sortOrder, image.sortOrder);
    if (!altText) return json({ ok: false, error: 'opportunity_gallery_alt_required' }, 400);

    await prisma.opportunityGalleryImage.update({
      where: { id: image.id },
      data: { altText, caption, sortOrder },
    });
    const updated = await prisma.opportunity.findUnique({
      where: { id: image.opportunityId },
      include: opportunityAdminInclude,
    });
    await writeOpportunityAudit({
      actor,
      action: 'opportunity.gallery_image.updated',
      entityId: image.opportunityId,
      description: 'Opportunity gallery image metadata updated',
      userAgent: request.headers.get('user-agent'),
      meta: { imageId: image.id, altText, caption: caption || undefined, sortOrder },
    });
    return json({ ok: true, opportunity: updated ? serializeAdminOpportunity(updated) : null });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin opportunities] gallery image update failed', error);
    return json({ ok: false, error: 'opportunity_gallery_update_failed' }, 500);
  }
}

export async function DELETE(request: NextRequest, context: { params: { id: string; imageId: string } }) {
  try {
    const actor = requireOpportunityScope(
      await requireAdminStaffActor(request, { requirePassword: true }),
      'opportunities.manage',
    );
    const image = await findImage(context.params.id, context.params.imageId);
    if (!image) return json({ ok: false, error: 'opportunity_gallery_image_not_found' }, 404);
    if (!canEditOpportunity(image.opportunity.status)) {
      return json({ ok: false, error: 'opportunity_pause_before_edit' }, 409);
    }

    await prisma.opportunityGalleryImage.delete({ where: { id: image.id } });
    await writeOpportunityAudit({
      actor,
      action: 'opportunity.gallery_image.removed',
      entityId: image.opportunityId,
      description: 'Opportunity gallery image removed',
      userAgent: request.headers.get('user-agent'),
      meta: { imageId: image.id, altText: image.altText },
    });
    await bestEffortDeleteManagedEnterpriseMedia(image.mediaRef);

    const updated = await prisma.opportunity.findUnique({
      where: { id: image.opportunityId },
      include: opportunityAdminInclude,
    });
    return json({ ok: true, opportunity: updated ? serializeAdminOpportunity(updated) : null });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin opportunities] gallery image delete failed', error);
    return json({ ok: false, error: 'opportunity_gallery_delete_failed' }, 500);
  }
}
