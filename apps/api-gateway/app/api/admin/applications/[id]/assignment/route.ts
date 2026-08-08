import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireApplicationScope } from '@/src/lib/admin-application-access';
import {
  adminApplicationResponse,
  assertAssignableReviewer,
  cleanApplicationPayload,
  cleanReviewerId,
  writeApplicationAudit,
} from '@/src/lib/admin-applications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const actor = requireApplicationScope(
      await requireAdminStaffActor(request),
      'applications.assign',
    );
    const body = cleanApplicationPayload(await request.json().catch(() => ({})));
    const reviewerProfileId = cleanReviewerId(body.reviewerProfileId) || null;
    const expectedUpdatedAt = String(body.expectedUpdatedAt || '').trim();

    if (!expectedUpdatedAt || Number.isNaN(Date.parse(expectedUpdatedAt))) {
      return json({ ok: false, error: 'application_expected_updated_at_required' }, 400);
    }

    if (reviewerProfileId) {
      await assertAssignableReviewer(reviewerProfileId);
    }

    const current = await prisma.application.findUnique({
      where: { id: context.params.id },
      select: { id: true, assignedReviewerProfileId: true, updatedAt: true },
    });

    if (!current) {
      return json({ ok: false, error: 'application_not_found' }, 404);
    }

    if (current.updatedAt.toISOString() !== new Date(expectedUpdatedAt).toISOString()) {
      return json({ ok: false, error: 'application_changed_concurrently' }, 409);
    }

    const changed = await prisma.application.updateMany({
      where: { id: current.id, updatedAt: current.updatedAt },
      data: { assignedReviewerProfileId: reviewerProfileId },
    });

    if (changed.count !== 1) {
      return json({ ok: false, error: 'application_changed_concurrently' }, 409);
    }

    const application = await prisma.application.findUniqueOrThrow({
      where: { id: current.id },
      select: {
        id: true,
        updatedAt: true,
        assignedReviewerProfileId: true,
        assignedReviewerProfile: {
          select: {
            id: true,
            name: true,
            email: true,
            staffIdentifier: true,
            lifecycleState: true,
          },
        },
      },
    });

    await writeApplicationAudit({
      actor,
      action: 'application.reviewer_assigned',
      entityId: current.id,
      description: reviewerProfileId
        ? 'Application reviewer assigned'
        : 'Application reviewer cleared',
      userAgent: request.headers.get('user-agent'),
      meta: {
        previousReviewerProfileId: current.assignedReviewerProfileId,
        reviewerProfileId,
      },
    });

    return json({ ok: true, application });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const domain = adminApplicationResponse(error);
    if (domain) return json(domain.body, domain.status);
    console.error('[admin applications] assignment failed', error);
    return json({ ok: false, error: 'application_assignment_failed' }, 500);
  }
}
