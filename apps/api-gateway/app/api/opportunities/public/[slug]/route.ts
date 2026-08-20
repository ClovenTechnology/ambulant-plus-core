import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  isPublicOpportunityDetailVisible,
  normaliseOpportunitySlug,
  validOpportunitySlug,
} from '@/src/lib/opportunities-policy';
import { serializePublicOpportunity } from '@/src/lib/admin-opportunities';
import { isManagedEnterpriseMediaRef } from '@/src/lib/enterprise-media-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'public, max-age=0, must-revalidate' },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: { slug: string } },
) {
  try {
    const slug = normaliseOpportunitySlug(context.params.slug);
    if (!validOpportunitySlug(slug)) {
      return json({ ok: false, error: 'opportunity_not_found' }, 404);
    }

    const row = await prisma.opportunity.findUnique({
      where: { slug },
      include: {
        applicationForm: {
          include: {
            versions: {
              where: { state: 'PUBLISHED', accessMode: 'PUBLIC' },
              orderBy: { versionNumber: 'desc' },
              take: 1,
              select: {
                id: true,
                versionNumber: true,
                acceptingFrom: true,
                acceptingUntil: true,
              },
            },
          },
        },
        galleryImages: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            role: true,
            mediaRef: true,
            altText: true,
            caption: true,
            sortOrder: true,
          },
        },
      },
    });

    if (
      !row ||
      !isPublicOpportunityDetailVisible({
        status: row.status,
        visibility: row.visibility,
      })
    ) {
      return json({ ok: false, error: 'opportunity_not_found' }, 404);
    }

    const opportunity = serializePublicOpportunity(row, new Date());
    const featuredStored = row.galleryImages.find((entry) => entry.role === 'FEATURED');
    return json({
      ok: true,
      opportunity: {
        ...opportunity,
        imageUrl: featuredStored
          ? new URL(`/api/opportunities/public/${encodeURIComponent(row.slug)}/image`, request.url).toString()
          : isManagedEnterpriseMediaRef(row.imageUrl)
            ? new URL(`/api/opportunities/public/${encodeURIComponent(row.slug)}/image`, request.url).toString()
            : opportunity.imageUrl,
        imageAlt: featuredStored?.altText || opportunity.imageAlt,
        featuredImage: opportunity.featuredImage
          ? {
              ...opportunity.featuredImage,
              imageUrl: new URL(
                `/api/opportunities/public/${encodeURIComponent(row.slug)}/image`,
                request.url,
              ).toString(),
            }
          : null,
        galleryImages: opportunity.galleryImages.map((image: any) => {
          const stored = row.galleryImages.find((entry) => entry.id === image.id);
          return {
            ...image,
            imageUrl: isManagedEnterpriseMediaRef(stored?.mediaRef)
              ? new URL(
                  `/api/opportunities/public/${encodeURIComponent(row.slug)}/gallery/${encodeURIComponent(image.id)}`,
                  request.url,
                ).toString()
              : image.imageUrl,
          };
        }),
        contentImages: opportunity.contentImages.map((image: any) => {
          const stored = row.galleryImages.find((entry) => entry.id === image.id);
          return {
            ...image,
            imageUrl: isManagedEnterpriseMediaRef(stored?.mediaRef)
              ? new URL(
                  `/api/opportunities/public/${encodeURIComponent(row.slug)}/media/${encodeURIComponent(image.id)}`,
                  request.url,
                ).toString()
              : image.imageUrl,
          };
        }),
      },
    });
  } catch (error) {
    console.error('[public opportunities] detail failed', error);
    return json({ ok: false, error: 'public_opportunity_detail_failed' }, 500);
  }
}
