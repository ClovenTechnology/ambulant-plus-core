// apps/api-gateway/app/api/medreach/lab-reviews/route.ts
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

function cleanStars(value: unknown) {
  const stars = Math.trunc(Number(value));

  if (!Number.isFinite(stars)) return null;
  if (stars < 1 || stars > 5) return null;

  return stars;
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

async function resolvePatientProfileIdFromUserId(userId: string) {
  if (!userId) return null;

  try {
    const profile = await prisma.patientProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    return profile?.id ?? null;
  } catch {
    return null;
  }
}

async function allowedPatientIdsForActor(who: any) {
  const uid = clean(who?.uid, 128);
  const profileId = await resolvePatientProfileIdFromUserId(uid);

  return Array.from(new Set([uid, profileId].filter(Boolean).map(String)));
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

async function latestResultStatus(orderId: string) {
  const audit = await prisma.auditEvent.findFirst({
    where: {
      subjectId: orderId,
      kind: 'lab_result_updated',
    },
    orderBy: { at: 'desc' },
    select: { meta: true, at: true },
  });

  const meta = audit?.meta as any;

  return {
    status: clean(meta?.resultStatus, 40).toUpperCase(),
    at: audit?.at ?? null,
  };
}

function isReviewableServiceState(drawStatus: unknown, resultStatus: string) {
  const status = clean(drawStatus, 80).toLowerCase();

  return (
    resultStatus === 'SENT' ||
    status === 'completed' ||
    status === 'result_sent' ||
    status === 'result_sent_to_patient' ||
    status === 'result_sent_to_clinician'
  );
}

async function resolveReviewableOrder(req: NextRequest, orderId: string, who: any) {
  const role = roleOf(who);
  const uid = clean(who?.uid, 128);

  const draw = await prisma.draw.findFirst({
    where: { orderId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      orderId: true,
      patientId: true,
      encounterId: true,
      clinicianId: true,
      partnerId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!draw) {
    return { ok: false as const, status: 404, error: 'order_not_found' };
  }

  if (!draw.partnerId) {
    return { ok: false as const, status: 409, error: 'order_has_no_assigned_lab' };
  }

  const lab = await prisma.labPartner.findUnique({
    where: { id: draw.partnerId },
    select: {
      id: true,
      networkId: true,
      active: true,
      status: true,
      name: true,
    },
  });

  if (!lab || !lab.active || lab.status !== 'ACTIVE') {
    return { ok: false as const, status: 404, error: 'lab_not_found_or_inactive' };
  }

  const bundle = await prisma.medReachSpecimenBundle.findFirst({
    where: {
      OR: [{ orderId }, { drawId: draw.id }],
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      orderId: true,
      patientId: true,
      labPartnerId: true,
      status: true,
      acceptedAt: true,
      receivedAtLabAt: true,
      updatedAt: true,
    },
  });

  const result = await latestResultStatus(orderId);

  if (!isReviewableServiceState(draw.status, result.status)) {
    return {
      ok: false as const,
      status: 409,
      error: 'order_not_reviewable_yet',
    };
  }

  if (role === 'patient') {
    if (!uid) {
      return { ok: false as const, status: 403, error: 'missing_uid' };
    }

    const allowedPatientIds = await allowedPatientIdsForActor(who);
    const patientIds = Array.from(
      new Set([draw.patientId, bundle?.patientId].filter(Boolean).map(String)),
    );

    const allowed = patientIds.some((patientId) => allowedPatientIds.includes(patientId));

    if (!allowed) {
      return { ok: false as const, status: 403, error: 'forbidden' };
    }
  } else if (!['admin', 'system'].includes(role)) {
    return { ok: false as const, status: 403, error: 'forbidden' };
  }

  return {
    ok: true as const,
    draw,
    lab,
    bundle,
    result,
  };
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const role = roleOf(who);
  const url = new URL(req.url);

  const status = cleanStatus(url.searchParams.get('status'));
  const labId = clean(url.searchParams.get('labId'), 128);
  const networkId = clean(url.searchParams.get('networkId'), 128);
  const orderId = clean(url.searchParams.get('orderId'), 128);

  const where: Record<string, any> = {};

  if (status) where.status = status as any;
  if (orderId) where.orderId = orderId;

  if (['admin', 'system'].includes(role)) {
    if (labId) where.labId = labId;
    if (networkId) where.networkId = networkId;
  } else if (role === 'patient') {
    if (!who.uid) {
      return NextResponse.json({ ok: false, error: 'missing_uid' }, { status: 403 });
    }

    where.reviewerUserId = clean(who.uid, 128);
  } else if (role === 'lab' || role === 'lab_staff') {
    const actorLabId =
      role === 'lab'
        ? clean(req.headers.get('x-lab-id'), 128)
        : clean(req.headers.get('x-staff-lab-id'), 128);

    if (!actorLabId) {
      return NextResponse.json({ ok: false, error: 'missing_lab_id' }, { status: 400 });
    }

    const allowed = await canActForLab(req, actorLabId, who);

    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    where.labId = actorLabId;
  } else if (role === 'lab_network' || role === 'lab_network_staff') {
    const actorNetworkId = clean(req.headers.get('x-network-id'), 128) || networkId;

    if (!actorNetworkId) {
      return NextResponse.json({ ok: false, error: 'missing_network_id' }, { status: 400 });
    }

    const allowed = await canActForNetwork(req, actorNetworkId, who);

    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    where.networkId = actorNetworkId;
  } else {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const rows = await prisma.medReachLabReview.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    take: 100,
  });

  return NextResponse.json({
    ok: true,
    data: rows.map(projectReview),
    counts: {
      total: rows.length,
      pending: rows.filter((row) => row.status === 'PENDING').length,
      published: rows.filter((row) => row.status === 'PUBLISHED').length,
      hidden: rows.filter((row) => row.status === 'HIDDEN').length,
      flagged: rows.filter((row) => row.status === 'FLAGGED').length,
      rejected: rows.filter((row) => row.status === 'REJECTED').length,
    },
  });
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  const role = roleOf(who);

  if (!['patient', 'admin', 'system'].includes(role)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const orderId = clean(body.orderId, 128);
  const reviewerUserId = clean(who.uid, 128);
  const stars = cleanStars(body.stars);
  const comment = clean(body.comment, 1200);

  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'missing_orderId' }, { status: 400 });
  }

  if (!reviewerUserId) {
    return NextResponse.json({ ok: false, error: 'missing_reviewer' }, { status: 403 });
  }

  if (stars == null) {
    return NextResponse.json({ ok: false, error: 'invalid_stars' }, { status: 400 });
  }

  const resolved = await resolveReviewableOrder(req, orderId, who);

  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: resolved.status });
  }

  const now = new Date();

  const existing = await prisma.medReachLabReview.findFirst({
    where: {
      orderId,
      reviewerUserId,
    },
  });

  const data = {
    labId: resolved.lab.id,
    networkId: resolved.lab.networkId ?? null,
    orderId,
    patientId: resolved.draw.patientId ?? resolved.bundle?.patientId ?? null,
    reviewerUserId,
    stars,
    comment: comment || null,
    status: 'PENDING' as any,
    source: 'patient',
    reviewedAt: null,
    moderatedBy: null,
    moderatedAt: null,
    metadata: {
      drawId: resolved.draw.id,
      specimenBundleId: resolved.bundle?.id ?? null,
      drawStatus: resolved.draw.status,
      resultStatus: resolved.result.status || null,
      labName: resolved.lab.name,
      submittedByRole: role,
      submittedAt: now.toISOString(),
      safety: {
        orderBound: true,
        duplicatePolicy: 'upsert_same_order_and_reviewer',
        moderationRequired: true,
      },
    },
  };

  const review = existing
    ? await prisma.medReachLabReview.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.medReachLabReview.create({
        data,
      });

  await prisma.auditEvent.create({
    data: {
      kind: existing ? 'medreach_lab_review_updated' : 'medreach_lab_review_submitted',
      actorId: reviewerUserId,
      actorRole: role,
      subjectId: review.id,
      meta: {
        reviewId: review.id,
        orderId,
        labId: review.labId,
        networkId: review.networkId,
        stars,
        status: review.status,
      },
    },
  });

  emitEvent({
    kind: existing ? 'medreach_lab_review_updated' : 'medreach_lab_review_submitted',
    payload: {
      reviewId: review.id,
      orderId,
      labId: review.labId,
      networkId: review.networkId,
      status: review.status,
      at: now.toISOString(),
    },
    targets: {
      admin: true,
    },
  });

  return NextResponse.json({
    ok: true,
    data: projectReview(review),
  });
}