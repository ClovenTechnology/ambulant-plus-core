import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isPublicOpportunityDetailVisible, validHttpsUrl } from '@/src/lib/opportunities-policy';
import {
  enterpriseMediaErrorResponse,
  isManagedEnterpriseMediaRef,
  objectKeyFromManagedEnterpriseMediaRef,
  getEnterpriseMediaObject,
  enterpriseMediaResponseBody,
} from '@/src/lib/enterprise-media-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function GET(_request: NextRequest, context: { params: { slug: string } }) {
  try {
    const opportunity = await prisma.opportunity.findUnique({
      where: { slug: context.params.slug },
      select: { status: true, visibility: true, imageUrl: true },
    });
    if (!opportunity || !isPublicOpportunityDetailVisible(opportunity)) {
      return json({ ok: false, error: 'opportunity_not_found' }, 404);
    }
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
          'cache-control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
          ...(object.etag ? { etag: object.etag } : {}),
        },
      });
    }
    if (validHttpsUrl(opportunity.imageUrl)) return NextResponse.redirect(opportunity.imageUrl, 302);
    return json({ ok: false, error: 'opportunity_image_not_found' }, 404);
  } catch (error) {
    const media = enterpriseMediaErrorResponse(error);
    if (media) return json(media.body, media.status);
    console.error('[public opportunities] image failed', error);
    return json({ ok: false, error: 'opportunity_image_failed' }, 500);
  }
}
