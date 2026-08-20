import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  isPublicOpportunityDetailVisible,
  normaliseOpportunitySlug,
  validHttpsUrl,
  validOpportunitySlug,
} from '@/src/lib/opportunities-policy';
import {
  enterpriseMediaErrorResponse,
  getEnterpriseMediaObject,
  isManagedEnterpriseMediaRef,
  objectKeyFromManagedEnterpriseMediaRef,
  enterpriseMediaResponseBody,
} from '@/src/lib/enterprise-media-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function GET(
  _request: NextRequest,
  context: { params: { slug: string; imageId: string } },
) {
  try {
    const slug = normaliseOpportunitySlug(context.params.slug);
    if (!validOpportunitySlug(slug)) {
      return json({ ok: false, error: 'opportunity_not_found' }, 404);
    }

    const image = await prisma.opportunityGalleryImage.findFirst({
      where: { id: context.params.imageId, role: 'CONTENT', opportunity: { slug } },
      include: { opportunity: { select: { status: true, visibility: true } } },
    });

    if (!image || !isPublicOpportunityDetailVisible(image.opportunity)) {
      return json({ ok: false, error: 'opportunity_content_media_not_found' }, 404);
    }

    if (isManagedEnterpriseMediaRef(image.mediaRef)) {
      const objectKey = objectKeyFromManagedEnterpriseMediaRef(image.mediaRef);
      if (!objectKey) return json({ ok: false, error: 'opportunity_content_media_not_found' }, 404);
      const object = await getEnterpriseMediaObject(objectKey);
      return new Response(enterpriseMediaResponseBody(object.bytes), {
        status: 200,
        headers: {
          'content-type': object.contentType,
          'content-length': String(object.contentLength),
          'cache-control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
          ...(object.etag ? { etag: object.etag } : {}),
        },
      });
    }

    if (validHttpsUrl(image.mediaRef)) return NextResponse.redirect(image.mediaRef, 302);
    return json({ ok: false, error: 'opportunity_content_media_not_found' }, 404);
  } catch (error) {
    const media = enterpriseMediaErrorResponse(error);
    if (media) return json(media.body, media.status);
    console.error('[public opportunities] content media failed', error);
    return json({ ok: false, error: 'opportunity_content_media_failed' }, 500);
  }
}
