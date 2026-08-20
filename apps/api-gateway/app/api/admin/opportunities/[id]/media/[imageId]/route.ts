import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
import { requireOpportunityScope } from '@/src/lib/admin-opportunity-access';
import { canEditOpportunity, cleanOpportunityText } from '@/src/lib/opportunities-policy';
import { opportunityContentMediaIds } from '@/src/lib/opportunity-content';
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

async function findMedia(opportunityId: string, imageId: string) {
  return prisma.opportunityGalleryImage.findFirst({
    where: { id: imageId, opportunityId, role: 'CONTENT' },
    include: {
      opportunity: {
        select: {
          id: true,
          status: true,
          contentDocument: true,
          publishedContentDocument: true,
          revisions: { select: { contentDocument: true } },
        },
      },
    },
  });
}

export async function GET(request: NextRequest, context: { params: { id: string; imageId: string } }) {
  try {
    requireOpportunityScope(await requireAdminStaffActor(request), 'opportunities.read');
    const media = await findMedia(context.params.id, context.params.imageId);
    if (!media) return json({ ok: false, error: 'opportunity_content_media_not_found' }, 404);
    if (!isManagedEnterpriseMediaRef(media.mediaRef)) {
      return json({ ok: false, error: 'opportunity_content_media_not_found' }, 404);
    }
    const objectKey = objectKeyFromManagedEnterpriseMediaRef(media.mediaRef);
    if (!objectKey) return json({ ok: false, error: 'opportunity_content_media_not_found' }, 404);
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
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const media = enterpriseMediaErrorResponse(error);
    if (media) return json(media.body, media.status);
    console.error('[admin opportunities] content media read failed', error);
    return json({ ok: false, error: 'opportunity_content_media_read_failed' }, 500);
  }
}

export async function PATCH(request: NextRequest, context: { params: { id: string; imageId: string } }) {
  try {
    const actor = requireOpportunityScope(
      await requireAdminStaffActor(request, { requirePassword: true }),
      'opportunities.manage',
    );
    const media = await findMedia(context.params.id, context.params.imageId);
    if (!media) return json({ ok: false, error: 'opportunity_content_media_not_found' }, 404);
    if (!canEditOpportunity(media.opportunity.status)) {
      return json({ ok: false, error: 'opportunity_pause_before_edit' }, 409);
    }
    const body = await request.json().catch(() => ({}));
    const altText = cleanOpportunityText((body as any)?.altText, 240);
    const caption = cleanOpportunityText((body as any)?.caption, 500) || null;
    if (!altText) return json({ ok: false, error: 'opportunity_content_media_alt_required' }, 400);

    await prisma.opportunityGalleryImage.update({
      where: { id: media.id },
      data: { altText, caption },
    });
    await writeOpportunityAudit({
      actor,
      action: 'opportunity.content_media.updated',
      entityId: media.opportunityId,
      description: 'Opportunity Publishing Studio inline image metadata updated',
      userAgent: request.headers.get('user-agent'),
      meta: { mediaId: media.id, altText, caption: caption || undefined },
    });
    const updated = await prisma.opportunity.findUnique({
      where: { id: media.opportunityId },
      include: opportunityAdminInclude,
    });
    return json({ ok: true, opportunity: updated ? serializeAdminOpportunity(updated) : null });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin opportunities] content media update failed', error);
    return json({ ok: false, error: 'opportunity_content_media_update_failed' }, 500);
  }
}

export async function DELETE(request: NextRequest, context: { params: { id: string; imageId: string } }) {
  try {
    const actor = requireOpportunityScope(
      await requireAdminStaffActor(request, { requirePassword: true }),
      'opportunities.manage',
    );
    const media = await findMedia(context.params.id, context.params.imageId);
    if (!media) return json({ ok: false, error: 'opportunity_content_media_not_found' }, 404);
    if (!canEditOpportunity(media.opportunity.status)) {
      return json({ ok: false, error: 'opportunity_pause_before_edit' }, 409);
    }
    const retainedDocuments = [
      media.opportunity.contentDocument,
      media.opportunity.publishedContentDocument,
      ...media.opportunity.revisions.map((revision) => revision.contentDocument),
    ];
    if (retainedDocuments.some((document) => opportunityContentMediaIds(document).includes(media.id))) {
      return json({ ok: false, error: 'opportunity_content_media_in_use' }, 409);
    }

    await prisma.opportunityGalleryImage.delete({ where: { id: media.id } });
    await writeOpportunityAudit({
      actor,
      action: 'opportunity.content_media.removed',
      entityId: media.opportunityId,
      description: 'Unused Opportunity Publishing Studio inline image removed',
      userAgent: request.headers.get('user-agent'),
      meta: { mediaId: media.id, altText: media.altText },
    });
    await bestEffortDeleteManagedEnterpriseMedia(media.mediaRef);
    return json({ ok: true });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin opportunities] content media delete failed', error);
    return json({ ok: false, error: 'opportunity_content_media_delete_failed' }, 500);
  }
}
