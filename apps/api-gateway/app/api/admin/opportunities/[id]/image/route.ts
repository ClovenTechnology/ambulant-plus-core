import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
import { requireOpportunityScope } from '@/src/lib/admin-opportunity-access';
import { canEditOpportunity, validHttpsUrl } from '@/src/lib/opportunities-policy';
import {
  bestEffortDeleteManagedEnterpriseMedia,
  enterpriseMediaErrorResponse,
  isManagedEnterpriseMediaRef,
  objectKeyFromManagedEnterpriseMediaRef,
  getEnterpriseMediaObject,
  enterpriseMediaResponseBody,
} from '@/src/lib/enterprise-media-storage';
import { writeOpportunityAudit } from '@/src/lib/admin-opportunities';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    requireOpportunityScope(await requireAdminStaffActor(request), 'opportunities.read');
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: context.params.id },
      select: { imageUrl: true },
    });
    if (!opportunity) return json({ ok: false, error: 'opportunity_not_found' }, 404);
    if (!opportunity.imageUrl) return json({ ok: false, error: 'opportunity_image_not_found' }, 404);

    if (isManagedEnterpriseMediaRef(opportunity.imageUrl)) {
      const objectKey = objectKeyFromManagedEnterpriseMediaRef(opportunity.imageUrl);
      if (!objectKey) return json({ ok: false, error: 'opportunity_image_not_found' }, 404);
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
    if (validHttpsUrl(opportunity.imageUrl)) return NextResponse.redirect(opportunity.imageUrl, 302);
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

export async function DELETE(request: NextRequest, context: { params: { id: string } }) {
  try {
    const actor = requireOpportunityScope(
      await requireAdminStaffActor(request, { requirePassword: true }),
      'opportunities.manage',
    );
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: context.params.id },
      select: { id: true, status: true, imageUrl: true, imageAlt: true },
    });
    if (!opportunity) return json({ ok: false, error: 'opportunity_not_found' }, 404);
    if (!canEditOpportunity(opportunity.status)) {
      return json({ ok: false, error: 'opportunity_pause_before_edit' }, 409);
    }

    await prisma.opportunity.update({
      where: { id: opportunity.id },
      data: { imageUrl: null, imageAlt: null, lastUpdatedByProfileId: actor.profileId },
    });
    await writeOpportunityAudit({
      actor,
      action: 'opportunity.image.removed',
      entityId: opportunity.id,
      description: 'Opportunity featured image removed',
      userAgent: request.headers.get('user-agent'),
      meta: { previousImageAlt: opportunity.imageAlt || undefined },
    });
    await bestEffortDeleteManagedEnterpriseMedia(opportunity.imageUrl);
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
