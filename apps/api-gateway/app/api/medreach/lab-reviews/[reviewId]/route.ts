// apps/api-gateway/app/api/medreach/lab-reviews/[reviewId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { emitEvent } from '@/src/lib/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REVIEW_STATUSES = ['PENDING', 'PUBLISHED', 'HIDDEN', 'FLAGGED', 'REJECTED'] as const;

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function roleOf(who: any) {
  return String(who?.role || '').toLowerCase();
}

function cleanStatus(value: unknown) {
  const status = clean(value, 40).toUpperCase();

  return REVIEW_STATUSES.includes(status as any) ? status : '';
}

function projectReview(row: any) {
  return {
    id: row.id,
    labId: row.labId,
    networkId: row.networkId ?? null,
    orderId: row.orderId ?? null,
    patientId: row.patientId ?? null,
    reviewerUserId: row.reviewerUserId ?? null,
    stars: row.stars,
    comment: row.comment ?? null,
    status: row.status,
    source: row.source,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? null,
    reviewedAt: row.reviewedAt?.toISOString?.() ?? null,
    moderatedBy: row.moderatedBy ?? null,
    moderatedAt: row.moderatedAt?.toISOString?.() ?? null,
  };
}

async function canActForLab(req: NextRequest, labId: string, who: any) {
  const role = roleOf(who);
  const uid = clean(who?.uid, 128);

  if (['admin', 'system'].includes(role)) return true;
  if (!uid || !labId) return false;

  if (role === 'lab') {
    const headerLabId = clean(req.headers.get('x-lab-id'), 128);

    if (!headerLabId || headerLabId !== labId) return false;

    const lab = await prisma.labPartner.findUnique({
      where: { id: labId },
      select: { id: true, active: true, status: true, ownerUserId: true },
    });

    if (!lab || !lab.active || lab.status !== 'ACTIVE') return false;
    if (lab.ownerUserId && lab.ownerUserId !== uid) return false;

    return true;
  }

  if (role === 'lab_staff') {
    const headerLabId = clean(req.headers.get('x-staff-lab-id'), 128);

    if (!headerLabId || headerLabId !== labId) return false;

    const staff = await prisma.medReachLabStaff.findFirst({
      where: {
        userId: uid,
        labId,
        active: true,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    return Boolean(staff?.id);
  }

  return false;
}

async function canActForNetwork(req: NextRequest, networkId: string, who: any) {
  const role = roleOf(who);
  const uid = clean(who?.uid, 128);

  if (['admin', 'system'].includes(role)) return true;
  if (!uid || !networkId) return false;

  const headerNetworkId = clean(req.headers.get('x-network-id'), 128);

  if (headerNetworkId && headerNetworkId !== networkId) return false;

  const staff = await prisma.medReachLabNetworkStaff.findFirst({
    where: {
      userId: uid,
      networkId,
      active: true,
      status: 'ACTIVE',
      role: { in: ['NETWORK_OWNER', 'NETWORK_ADMIN', 'QUALITY'] as any },
    },
    select: { id: true },
  });

  return Boolean(staff?.id);
}

async function canModerateReview(_req: NextRequest, _review: any, who: any) {
  const role = roleOf(who);

  return ['admin', 'system'].includes(role);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { reviewId: string } },
) {
  const who = readIdentity(req.headers);
  const reviewId = clean(params.reviewId, 128);

  if (!reviewId) {
    return NextResponse.json({ ok: false, error: 'missing_reviewId' }, { status: 400 });
  }

  const review = await prisma.medReachLabReview.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    return NextResponse.json({ ok: false, error: 'review_not_found' }, { status: 404 });
  }

  const role = roleOf(who);
  const isOwnPatientReview =
    role === 'patient' && clean(who.uid, 128) && clean(who.uid, 128) === review.reviewerUserId;

  const allowed = isOwnPatientReview || (await canModerateReview(req, review, who));

  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    data: projectReview(review),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { reviewId: string } },
) {
  const who = readIdentity(req.headers);
  const reviewId = clean(params.reviewId, 128);

  if (!reviewId) {
    return NextResponse.json({ ok: false, error: 'missing_reviewId' }, { status: 400 });
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const review = await prisma.medReachLabReview.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    return NextResponse.json({ ok: false, error: 'review_not_found' }, { status: 404 });
  }

  const allowed = await canModerateReview(req, review, who);

  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const status = cleanStatus(body.status);
  const moderationNote = clean(body.moderationNote, 600);
  const now = new Date();

  if (!status && !moderationNote) {
    return NextResponse.json({ ok: false, error: 'no_changes' }, { status: 400 });
  }

  const nextMeta = {
    ...((review.metadata as any) || {}),
    moderation: {
      ...(((review.metadata as any)?.moderation as any) || {}),
      lastNote: moderationNote || null,
      lastStatus: status || review.status,
      moderatedBy: clean(who.uid, 128) || null,
      moderatedRole: who.role || null,
      moderatedAt: now.toISOString(),
    },
  };

  const updated = await prisma.medReachLabReview.update({
    where: { id: review.id },
    data: {
      ...(status ? { status: status as any } : {}),
      metadata: nextMeta as any,
      moderatedBy: clean(who.uid, 128) || null,
      moderatedAt: now,
      reviewedAt: status === 'PUBLISHED' ? now : review.reviewedAt,
    },
  });

  await prisma.auditEvent.create({
    data: {
      kind: 'medreach_lab_review_moderated',
      actorId: clean(who.uid, 128) || null,
      actorRole: who.role,
      subjectId: updated.id,
      meta: {
        reviewId: updated.id,
        orderId: updated.orderId,
        labId: updated.labId,
        networkId: updated.networkId,
        status: updated.status,
        moderationNote: moderationNote || null,
      },
    },
  });

  emitEvent({
    kind: 'medreach_lab_review_moderated',
    payload: {
      reviewId: updated.id,
      orderId: updated.orderId,
      labId: updated.labId,
      networkId: updated.networkId,
      status: updated.status,
      at: now.toISOString(),
    },
    targets: {
      admin: true,
    },
  });

  return NextResponse.json({
    ok: true,
    data: projectReview(updated),
  });
}