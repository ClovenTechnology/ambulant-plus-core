import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireApplicationScope } from '@/src/lib/admin-application-access';
import {
  applicationAdminListInclude,
  applicationListItem,
  applicationSearchWhere,
} from '@/src/lib/admin-applications';
import { isApplicationStatus } from '@/src/lib/applications-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function GET(request: NextRequest) {
  try {
    const actor = requireApplicationScope(
      await requireAdminStaffActor(request),
      'applications.read',
    );

    const url = new URL(request.url);
    const q = String(url.searchParams.get('q') || '').trim().slice(0, 240);
    const rawStatus = String(url.searchParams.get('status') || '').trim().toUpperCase();
    const status = isApplicationStatus(rawStatus) ? rawStatus : '';
    const opportunityId = String(url.searchParams.get('opportunityId') || '').trim().slice(0, 240);
    const reviewerProfileId = String(url.searchParams.get('reviewerProfileId') || '').trim().slice(0, 240);
    const mine = url.searchParams.get('mine') === '1';
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(url.searchParams.get('pageSize') || '25', 10) || 25),
    );

    const where = applicationSearchWhere({
      q,
      status,
      opportunityId,
      reviewerProfileId: mine ? actor.profileId : reviewerProfileId,
    });

    const [total, items, opportunities] = await Promise.all([
      prisma.application.count({ where }),
      prisma.application.findMany({
        where,
        orderBy: [
          { submittedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: applicationAdminListInclude,
      }),
      prisma.opportunity.findMany({
        where: { applications: { some: {} } },
        orderBy: { title: 'asc' },
        take: 500,
        select: { id: true, title: true, key: true },
      }),
    ]);

    return json({
      ok: true,
      actorProfileId: actor.profileId,
      page,
      pageSize,
      total,
      items: items.map(applicationListItem),
      opportunities,
    });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin applications] list failed', error);
    return json({ ok: false, error: 'application_list_failed' }, 500);
  }
}
