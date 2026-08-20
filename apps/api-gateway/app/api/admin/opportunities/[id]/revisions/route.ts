import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
import { requireOpportunityScope } from '@/src/lib/admin-opportunity-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    requireOpportunityScope(await requireAdminStaffActor(request), 'opportunities.read');
    const exists = await prisma.opportunity.findUnique({
      where: { id: context.params.id },
      select: { id: true },
    });
    if (!exists) return json({ ok: false, error: 'opportunity_not_found' }, 404);

    const items = await prisma.opportunityRevision.findMany({
      where: { opportunityId: context.params.id },
      orderBy: [{ revisionNumber: 'desc' }, { createdAt: 'desc' }],
      take: 40,
      select: {
        id: true,
        revisionNumber: true,
        kind: true,
        contentDocument: true,
        showFaq: true,
        createdAt: true,
        createdByProfile: { select: { id: true, name: true, email: true } },
      },
    });

    return json({ ok: true, items });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin opportunities] revisions failed', error);
    return json({ ok: false, error: 'opportunity_revisions_failed' }, 500);
  }
}
