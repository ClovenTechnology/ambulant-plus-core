import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  isPublicOpportunityDetailVisible,
  normaliseOpportunitySlug,
  validOpportunitySlug,
} from '@/src/lib/opportunities-policy';
import { serializePublicOpportunity } from '@/src/lib/admin-opportunities';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'public, max-age=0, must-revalidate' },
  });
}

export async function GET(
  _request: NextRequest,
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

    return json({
      ok: true,
      opportunity: serializePublicOpportunity(row, new Date()),
    });
  } catch (error) {
    console.error('[public opportunities] detail failed', error);
    return json({ ok: false, error: 'public_opportunity_detail_failed' }, 500);
  }
}
