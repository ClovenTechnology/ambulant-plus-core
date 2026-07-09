import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function safeJsonObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function roleOf(req: NextRequest) {
  const who = readIdentity(req.headers);
  return {
    uid: clean((who as any)?.uid, 180),
    role: clean((who as any)?.role || 'anonymous', 80).toLowerCase(),
  };
}

function requireAdmin(req: NextRequest) {
  const who = roleOf(req);

  if (!who.uid || !['admin', 'system'].includes(who.role)) {
    return { ok: false as const, who };
  }

  return { ok: true as const, who };
}

function parseLimit(req: NextRequest) {
  const raw = Number(new URL(req.url).searchParams.get('limit') || 50);
  if (!Number.isFinite(raw)) return 50;
  return Math.max(1, Math.min(100, Math.trunc(raw)));
}

function governanceReviewOf(profile: any) {
  const meta = safeJsonObject(profile?.meta);
  return safeJsonObject(meta.governanceReview);
}

function isGovernanceCandidate(profile: any, scope: string) {
  const status = clean(profile?.status, 80).toLowerCase();
  const review = governanceReviewOf(profile);
  const active = Boolean(review?.active);

  if (scope === 'all') return true;
  if (scope === 'resolved') return Boolean(review?.resolvedAt || review?.resolution);
  if (scope === 'active') return active || status === 'disciplinary' || Boolean(profile?.disabled);

  return active || status === 'disciplinary' || Boolean(profile?.disabled);
}

function summarizeRating(rating: any) {
  if (!rating) return null;

  return {
    id: rating.id,
    stars: rating.stars,
    comment: rating.comment,
    appointmentId: rating.appointmentId,
    patientId: rating.patientId,
    createdAt: rating.createdAt,
    updatedAt: rating.updatedAt,
  };
}

function toGovernanceRow(profile: any, rating: any) {
  const review = governanceReviewOf(profile);

  return {
    id: profile.id,
    userId: profile.userId,
    displayName: profile.displayName,
    email: profile.email,
    specialty: profile.specialty,
    professionKey: profile.professionKey,
    status: profile.status,
    disabled: Boolean(profile.disabled),
    archived: Boolean(profile.archived),
    ratingAvg: profile.ratingAvg,
    ratingCount: profile.ratingCount,
    ratingSum: profile.ratingSum,
    governanceReview: review,
    latestRating: summarizeRating(rating),
    triggeredAt: review?.triggeredAt ?? rating?.createdAt ?? profile.updatedAt,
    action: review?.action ?? null,
    reason: review?.reason ?? null,
    severity: review?.severity ?? null,
    source: review?.source ?? null,
    updatedAt: profile.updatedAt,
    createdAt: profile.createdAt,
  };
}

function mergeGovernanceResolution(profile: any, patch: Record<string, any>) {
  const meta = safeJsonObject(profile?.meta);
  const previous = safeJsonObject(meta.governanceReview);

  return {
    ...meta,
    governanceReview: {
      ...previous,
      ...patch,
    },
  };
}

function contactSummaryFromBody(body: any, key: 'patient' | 'clinician') {
  const direct = safeJsonObject(body?.[key + 'Contact']);
  const summary =
    key === 'patient'
      ? clean(body.patientContactSummary || body.patientSide || body.patientStatement || direct.summary, 2000)
      : clean(body.clinicianContactSummary || body.clinicianSide || body.clinicianStatement || direct.summary, 2000);

  const contactedAt =
    key === 'patient'
      ? clean(body.patientContactedAt || direct.contactedAt, 100)
      : clean(body.clinicianContactedAt || direct.contactedAt, 100);

  const method =
    key === 'patient'
      ? clean(body.patientContactMethod || direct.method, 80)
      : clean(body.clinicianContactMethod || direct.method, 80);

  return {
    contacted: Boolean(summary || contactedAt || method),
    method: method || null,
    contactedAt: contactedAt || null,
    summary: summary || null,
  };
}

function evidenceListFromBody(body: any) {
  const evidence = Array.isArray(body?.evidenceReviewed)
    ? body.evidenceReviewed
    : Array.isArray(body?.evidence)
      ? body.evidence
      : [];

  return evidence
    .map((item: any) => clean(item, 240))
    .filter(Boolean)
    .slice(0, 20);
}

function decisionHistoryFrom(profile: any) {
  const previous = governanceReviewOf(profile);
  const history = Array.isArray(previous.decisionHistory) ? previous.decisionHistory : [];

  return history.slice(-49);
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) {
    return json({ ok: false, error: 'admin_required' }, 401);
  }

  try {
    const url = new URL(req.url);
    const scope = clean(url.searchParams.get('scope') || url.searchParams.get('status') || 'active', 40).toLowerCase();
    const q = clean(url.searchParams.get('q') || '', 120).toLowerCase();
    const limit = parseLimit(req);

    const profiles = await (prisma as any).clinicianProfile.findMany({
      where: {
        OR: [
          { status: 'disciplinary' },
          { disabled: true },
          { archived: true },
        ],
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: Math.max(limit * 3, 100),
      select: {
        id: true,
        userId: true,
        displayName: true,
        email: true,
        specialty: true,
        professionKey: true,
        status: true,
        disabled: true,
        archived: true,
        ratingAvg: true,
        ratingCount: true,
        ratingSum: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const filtered = profiles
      .filter((profile: any) => isGovernanceCandidate(profile, scope))
      .filter((profile: any) => {
        if (!q) return true;
        const review = governanceReviewOf(profile);
        const blob = [
          profile.id,
          profile.userId,
          profile.displayName,
          profile.email,
          profile.specialty,
          profile.professionKey,
          profile.status,
          review.reason,
          review.action,
          review.source,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return blob.includes(q);
      })
      .slice(0, limit);

    const userIds = filtered.map((profile: any) => profile.userId).filter(Boolean);

    const latestRatings = userIds.length
      ? await (prisma as any).clinicianRating.findMany({
          where: {
            clinicianUserId: { in: userIds },
          },
          orderBy: [{ createdAt: 'desc' }],
          select: {
            id: true,
            clinicianUserId: true,
            patientId: true,
            appointmentId: true,
            stars: true,
            comment: true,
            createdAt: true,
            updatedAt: true,
          },
          take: Math.max(userIds.length * 5, 20),
        })
      : [];

    const latestByClinicianUserId = new Map<string, any>();

    for (const rating of latestRatings) {
      if (!latestByClinicianUserId.has(rating.clinicianUserId)) {
        latestByClinicianUserId.set(rating.clinicianUserId, rating);
      }
    }

    const rows = filtered.map((profile: any) =>
      toGovernanceRow(profile, latestByClinicianUserId.get(profile.userId)),
    );

    const activeCount = rows.filter((row: any) => row.governanceReview?.active || row.status === 'disciplinary' || row.disabled).length;
    const resolvedCount = rows.filter((row: any) => row.governanceReview?.resolvedAt).length;

    return json({
      ok: true,
      scope,
      count: rows.length,
      activeCount,
      resolvedCount,
      rows,
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'clinician_governance_list_failed' }, 500);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) {
    return json({ ok: false, error: 'admin_required' }, 401);
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const clinicianId = clean(body.clinicianId || body.id, 180);
    const action = clean(body.action || body.decision, 80).toLowerCase();
    const note = clean(body.note || body.reason || body.comment, 1200);
    const decisionRationale = clean(
      body.decisionRationale || body.rationale || body.judgement || body.judgment || note,
      2000,
    );
    const governanceAssessment = clean(body.governanceAssessment || body.assessment, 2400);
    const safetyRisk = clean(body.safetyRisk || body.riskLevel || 'not_recorded', 80).toLowerCase();
    const patientContact = contactSummaryFromBody(body, 'patient');
    const clinicianContact = contactSummaryFromBody(body, 'clinician');
    const evidenceReviewed = evidenceListFromBody(body);

    if (!clinicianId) {
      return json({ ok: false, error: 'missing_clinician_id' }, 400);
    }

    if (!['reinstate', 'resolve', 'keep_suspended', 'archive'].includes(action)) {
      return json(
        {
          ok: false,
          error: 'invalid_governance_action',
          allowedActions: ['reinstate', 'resolve', 'keep_suspended', 'archive'],
        },
        400,
      );
    }

    if (!decisionRationale) {
      return json(
        {
          ok: false,
          error: 'governance_decision_rationale_required',
          message:
            'A governance decision must include a rationale summarising what informed the judgement.',
        },
        400,
      );
    }

    const profile = await (prisma as any).clinicianProfile.findFirst({
      where: {
        OR: [{ id: clinicianId }, { userId: clinicianId }],
      },
      select: {
        id: true,
        userId: true,
        displayName: true,
        status: true,
        disabled: true,
        archived: true,
        ratingAvg: true,
        ratingCount: true,
        ratingSum: true,
        meta: true,
      },
    });

    if (!profile) {
      return json({ ok: false, error: 'clinician_not_found' }, 404);
    }

    const now = new Date().toISOString();
    const decisionHistory = decisionHistoryFrom(profile);

    const decisionEntry = {
      action,
      decisionRationale,
      governanceAssessment: governanceAssessment || null,
      safetyRisk,
      patientContact,
      clinicianContact,
      evidenceReviewed,
      decidedBy: auth.who.uid,
      decidedAt: now,
    };

    const resolutionPatch = {
      active: action === 'keep_suspended',
      resolution: action,
      resolutionNote: decisionRationale,
      decisionRationale,
      governanceAssessment: governanceAssessment || null,
      safetyRisk,
      patientContact,
      clinicianContact,
      evidenceReviewed,
      resolvedBy: auth.who.uid,
      resolvedAt: now,
      lastActionAt: now,
      decisionHistory: decisionHistory.concat(decisionEntry),
    };

    const data: Record<string, any> = {
      meta: mergeGovernanceResolution(profile, resolutionPatch),
    };

    if (action === 'reinstate' || action === 'resolve') {
      data.status = 'active';
      data.disabled = false;
      data.archived = false;
    }

    if (action === 'keep_suspended') {
      data.status = 'disciplinary';
      data.disabled = true;
      data.archived = false;
    }

    if (action === 'archive') {
      data.status = 'archived';
      data.disabled = true;
      data.archived = true;
    }

    const updated = await (prisma as any).clinicianProfile.update({
      where: { id: profile.id },
      data,
      select: {
        id: true,
        userId: true,
        displayName: true,
        status: true,
        disabled: true,
        archived: true,
        ratingAvg: true,
        ratingCount: true,
        ratingSum: true,
        meta: true,
        updatedAt: true,
      },
    });

    return json({
      ok: true,
      clinician: toGovernanceRow(updated, null),
      action,
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'clinician_governance_update_failed' }, 500);
  }
}