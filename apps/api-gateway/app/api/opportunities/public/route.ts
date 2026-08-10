import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  cleanOpportunityText,
  isOpportunityType,
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

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const q = cleanOpportunityText(url.searchParams.get('q'), 240);
    const rawType = cleanOpportunityText(url.searchParams.get('type'), 60).toUpperCase();
    const type = isOpportunityType(rawType) ? rawType : '';
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, Number.parseInt(url.searchParams.get('pageSize') || '20', 10) || 20),
    );
    const now = new Date();

    const where: any = {
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      OR: [{ closesAt: null }, { closesAt: { gt: now } }],
      ...(type ? { type } : {}),
      ...(q
        ? {
            AND: [
              {
                OR: [
                  { title: { contains: q, mode: 'insensitive' } },
                  { summary: { contains: q, mode: 'insensitive' } },
                  { departmentLabel: { contains: q, mode: 'insensitive' } },
                  { locationLabel: { contains: q, mode: 'insensitive' } },
                ],
              },
            ],
          }
        : {}),
    };

    const include = {
      applicationForm: {
        include: {
          versions: {
            where: { state: 'PUBLISHED' as const, accessMode: 'PUBLIC' as const },
            orderBy: { versionNumber: 'desc' as const },
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
    };

    const [total, rows] = await Promise.all([
      prisma.opportunity.count({ where }),
      prisma.opportunity.findMany({
        where,
        orderBy: [
          { featured: 'desc' },
          { sortOrder: 'asc' },
          { publishedAt: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include,
      }),
    ]);

    return json({
      ok: true,
      page,
      pageSize,
      total,
      items: rows.map((row) => {
        const item = serializePublicOpportunity(row, now);
        return {
          ...item,
          imageUrl: isManagedEnterpriseMediaRef(row.imageUrl)
            ? new URL(`/api/opportunities/public/${encodeURIComponent(row.slug)}/image`, request.url).toString()
            : item.imageUrl,
        };
      }),
    });
  } catch (error) {
    console.error('[public opportunities] list failed', error);
    return json({ ok: false, error: 'public_opportunity_list_failed' }, 500);
  }
}
