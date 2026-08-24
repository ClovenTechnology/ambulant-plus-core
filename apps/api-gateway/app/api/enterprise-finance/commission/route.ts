import { createHash, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  asCents,
  asObject,
  auditEnterpriseFinance,
  json,
  requireEnterpriseFinanceAdmin,
  routeError,
  text,
} from '@/src/enterprise-finance/access-envelope';
import {
  ensureWorkforceMemberForPayrollProfile,
  normalizeEngagementType,
} from '@/src/lib/workforce';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TERMINAL = new Set(['REJECTED', 'CANCELLED', 'CLAWED_BACK']);
const TRANSITIONS: Record<string, Set<string>> = {
  PENDING: new Set(['EARNED', 'APPROVED', 'REJECTED', 'CANCELLED', 'DISPUTED']),
  EARNED: new Set(['APPROVED', 'REJECTED', 'CANCELLED', 'DISPUTED']),
  APPROVED: new Set(['SCHEDULED', 'CANCELLED', 'DISPUTED']),
  SCHEDULED: new Set(['PAID', 'CANCELLED', 'DISPUTED']),
  PAID: new Set(['CLAWED_BACK', 'DISPUTED']),
  DISPUTED: new Set(['APPROVED', 'CANCELLED', 'CLAWED_BACK']),
};

function upperStatus(value: unknown, fallback = 'PENDING') {
  const status = String(value || fallback).trim().toUpperCase();
  if (status === 'PENDING_REVIEW' || status === 'DRAFT') return 'PENDING';
  if (status === 'INCLUDED_IN_PAYROLL') return 'SCHEDULED';
  if (status === 'PARTIALLY_PAID') return 'SCHEDULED';
  return status;
}

function idempotencyKey(input: {
  sourceType: string;
  sourceId: string;
  policyId: string | null;
  beneficiary: string;
}) {
  return createHash('sha256')
    .update(
      [
        input.sourceType.trim().toLowerCase(),
        input.sourceId.trim(),
        input.policyId || 'no-policy',
        input.beneficiary.trim(),
      ].join('|'),
    )
    .digest('hex');
}

function jsonObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function policyEligibleForWorkforce(policy: any, profile: any, workforce: any) {
  const meta = jsonObject(policy?.ruleMeta);
  const eligible = Array.isArray(meta.eligibleWorkforceTypes)
    ? meta.eligibleWorkforceTypes.map(normalizeEngagementType)
    : [];

  if (
    eligible.length &&
    !eligible.includes(
      normalizeEngagementType(
        workforce?.engagementType || profile?.employmentType || 'PERMANENT',
      ),
    )
  ) {
    return false;
  }

  const appliesToRole = String(policy?.appliesToRole || '').trim().toLowerCase();
  if (appliesToRole) {
    const role = String(profile?.staffRole || '').trim().toLowerCase();
    if (role !== appliesToRole) return false;
  }

  return true;
}

function calculateCommission(policy: any, grossSourceValueCents: number, explicit: number) {
  if (!policy) return explicit;

  const mode = String(policy.calculationMode || 'manual').trim().toLowerCase();
  const threshold = Math.max(0, Number(policy.thresholdCents || 0));
  if (grossSourceValueCents < threshold) return 0;

  if (mode === 'fixed' || mode === 'flat' || mode === 'flat_amount') {
    return Math.max(0, Number(policy.flatAmountCents || 0));
  }

  if (mode === 'percentage' || mode === 'percent') {
    return Math.max(
      0,
      Math.round((grossSourceValueCents * Number(policy.rateBps || 0)) / 10_000),
    );
  }

  if (mode === 'tiered' || mode === 'tiered_percentage') {
    const meta = jsonObject(policy.ruleMeta);
    const tiers = Array.isArray(meta.tiers) ? meta.tiers : [];
    const eligible = tiers
      .map((tier: any) => ({
        minCents: Math.max(0, Number(tier?.minCents || tier?.thresholdCents || 0)),
        rateBps: Math.max(0, Number(tier?.rateBps || 0)),
        flatAmountCents: Math.max(0, Number(tier?.flatAmountCents || 0)),
      }))
      .filter((tier: any) => grossSourceValueCents >= tier.minCents)
      .sort((a: any, b: any) => b.minCents - a.minCents)[0];

    if (!eligible) return 0;
    if (eligible.flatAmountCents > 0) return eligible.flatAmountCents;
    return Math.max(
      0,
      Math.round((grossSourceValueCents * eligible.rateBps) / 10_000),
    );
  }

  return explicit;
}

async function beneficiary(db: any, staffUserId: string) {
  const profile = await db.staffPayrollProfile.findFirst({
    where: { staffUserId },
    orderBy: { updatedAt: 'desc' },
  });
  if (!profile) throw new Error('commission_beneficiary_payroll_profile_required');

  const workforce = await ensureWorkforceMemberForPayrollProfile(profile);
  return { profile, workforce };
}

async function recordForPolicy(input: {
  db: any;
  req: NextRequest;
  actorUserId: string | null;
  body: any;
  sourceType: string;
  sourceId: string;
  staffUserId: string;
  profile: any;
  workforce: any;
  policy: any | null;
}) {
  const gross = asCents(input.body.grossSourceValueCents);
  const explicit = asCents(input.body.calculatedCommissionCents);
  const amount = calculateCommission(input.policy, gross, explicit);
  const dedupeKey = idempotencyKey({
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    policyId: input.policy?.id || null,
    beneficiary: input.staffUserId,
  });

  const existing = await input.db.commissionEvent.findUnique({
    where: { dedupeKey },
  });

  if (existing) {
    const award = await input.db.commissionAward.findFirst({
      where: { commissionEventId: existing.id, staffUserId: input.staffUserId },
      orderBy: { createdAt: 'desc' },
    });
    return { event: existing, award, duplicate: true };
  }

  const requiresApproval = input.policy?.requiresApproval !== false;
  const initialStatus = requiresApproval ? 'PENDING' : 'EARNED';

  const result = await input.db.$transaction(async (tx: any) => {
    const event = await tx.commissionEvent.create({
      data: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        staffUserId: input.staffUserId,
        workforceMemberId: input.workforce.id,
        eventStatus: initialStatus,
        occurredAt: input.body.occurredAt
          ? new Date(input.body.occurredAt)
          : new Date(),
        grossSourceValueCents: gross,
        calculatedCommissionCents: amount,
        currency: text(input.body.currency || input.policy?.currency || 'ZAR', 3).toUpperCase(),
        policyId: input.policy?.id || null,
        dedupeKey,
        module: text(input.body.module, 80) || null,
        attributionMeta: {
          ...asObject(input.body.attributionMeta),
          attributionMode:
            text(input.body.attributionMode || 'platform_event', 80) ||
            'platform_event',
          workforceMemberId: input.workforce.id,
          engagementType: input.workforce.engagementType,
        },
        sourceMeta: asObject(input.body.sourceMeta),
      },
    });

    const award = await tx.commissionAward.create({
      data: {
        commissionEventId: event.id,
        staffUserId: input.staffUserId,
        workforceMemberId: input.workforce.id,
        status: initialStatus,
        calculatedAmountCents: amount,
        approvedAmountCents: requiresApproval ? 0 : amount,
        paidAmountCents: 0,
        currency: event.currency,
        ...(requiresApproval
          ? {}
          : {
              approvedByUserId: input.actorUserId,
              approvedAt: new Date(),
            }),
        meta: {
          policyId: input.policy?.id || null,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          dedupeKey,
        },
      },
    });

    return { event, award };
  });

  await auditEnterpriseFinance('commission_event_attributed', input.req, {
    model: 'CommissionEvent',
    subjectId: result.event.id,
    staffUserId: input.staffUserId,
    workforceMemberId: input.workforce.id,
    policyId: input.policy?.id || null,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    calculatedCommissionCents: amount,
  });

  return { ...result, duplicate: false };
}

export async function GET(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1),
      500,
    );

    const staffUserId = text(searchParams.get('staffUserId'), 180);
    const status = text(searchParams.get('status'), 80);

    const policies = await db.commissionPolicy.findMany({
      where: searchParams.has('active')
        ? { active: searchParams.get('active') === 'true' }
        : {},
      orderBy: [{ updatedAt: 'desc' }],
      take: limit,
    });

    const events = await db.commissionEvent.findMany({
      where: {
        ...(staffUserId ? { staffUserId } : {}),
        ...(status ? { eventStatus: upperStatus(status) } : {}),
      },
      orderBy: [{ occurredAt: 'desc' }],
      take: limit,
    });

    const awards = await db.commissionAward.findMany({
      where: {
        ...(staffUserId ? { staffUserId } : {}),
        ...(status ? { status: upperStatus(status) } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: limit,
    });

    return json({
      ok: true,
      envelope: access.envelope,
      policies,
      events,
      awards,
      lifecycle: {
        normal: ['PENDING', 'EARNED', 'APPROVED', 'SCHEDULED', 'PAID'],
        exceptional: ['REJECTED', 'CANCELLED', 'CLAWED_BACK', 'DISPUTED'],
      },
    });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_commission_list_failed');
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const action = text(body.action || 'record_event', 80).toLowerCase();

    if (action === 'create_policy') {
      const ruleMeta = {
        ...asObject(body.ruleMeta),
        eligibleWorkforceTypes: Array.isArray(body.eligibleWorkforceTypes)
          ? body.eligibleWorkforceTypes.map(normalizeEngagementType)
          : asObject(body.ruleMeta).eligibleWorkforceTypes || [],
        qualifyingEvent: text(body.qualifyingEvent || body.sourceType, 120) || null,
        clawbackCriteria: text(body.clawbackCriteria, 1000) || null,
        payoutCycle: text(body.payoutCycle, 80) || null,
        tiers: Array.isArray(body.tiers) ? body.tiers : asObject(body.ruleMeta).tiers || [],
      };

      const item = await db.commissionPolicy.create({
        data: {
          name: text(body.name, 240) || 'Commission policy',
          description: text(body.description, 1000) || null,
          sourceType: text(body.sourceType || 'manual', 120),
          appliesToRole: text(body.appliesToRole, 120) || null,
          calculationMode: text(body.calculationMode || 'manual', 80),
          rateBps: asCents(body.rateBps),
          flatAmountCents: asCents(body.flatAmountCents),
          thresholdCents: asCents(body.thresholdCents),
          currency: text(body.currency || 'ZAR', 3).toUpperCase(),
          active: body.active === undefined ? true : Boolean(body.active),
          requiresApproval:
            body.requiresApproval === undefined ? true : Boolean(body.requiresApproval),
          startsAt: body.startsAt ? new Date(body.startsAt) : null,
          endsAt: body.endsAt ? new Date(body.endsAt) : null,
          ruleMeta,
          createdByUserId: access.envelope.actor.userId,
          approvedByUserId: text(body.approvedByUserId, 180) || null,
          approvedAt: body.approvedAt ? new Date(body.approvedAt) : null,
        },
      });

      await auditEnterpriseFinance('commission_policy_created', req, {
        model: 'CommissionPolicy',
        subjectId: item.id,
      });
      return json({ ok: true, envelope: access.envelope, item });
    }

    if (action !== 'record_event') {
      return json({ ok: false, error: 'unsupported_commission_action' }, 400);
    }

    const sourceType = text(body.sourceType || 'manual', 120);
    const sourceId =
      text(body.sourceId || body.sourceReference || body.manualReference, 180) ||
      (sourceType === 'manual' ? `manual:${randomUUID()}` : '');
    const staffUserId = text(body.staffUserId, 180);

    if (!sourceId) return json({ ok: false, error: 'sourceId_required' }, 400);
    if (!staffUserId) return json({ ok: false, error: 'staffUserId_required' }, 400);

    const { profile, workforce } = await beneficiary(db, staffUserId);
    if (!profile.commissionEligible && sourceType !== 'manual') {
      return json({ ok: false, error: 'commission_beneficiary_not_eligible' }, 409);
    }

    const policyId = text(body.policyId, 180);
    let policies: any[] = [];

    if (policyId) {
      const policy = await db.commissionPolicy.findUnique({ where: { id: policyId } });
      if (!policy || !policy.active) {
        return json({ ok: false, error: 'commission_policy_not_active' }, 404);
      }
      policies = [policy];
    } else {
      const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
      policies = await db.commissionPolicy.findMany({
        where: {
          sourceType,
          active: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: occurredAt } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: occurredAt } }] },
          ],
        },
        orderBy: { updatedAt: 'desc' },
      });
      policies = policies.filter((policy: any) =>
        policyEligibleForWorkforce(policy, profile, workforce),
      );
    }

    if (!policies.length && sourceType !== 'manual') {
      return json({
        ok: false,
        error: 'no_eligible_commission_policy_for_source_event',
      }, 409);
    }

    const policyList = policies.length ? policies : [null];
    const results = [];
    for (const policy of policyList) {
      if (policy && !policyEligibleForWorkforce(policy, profile, workforce)) continue;
      results.push(
        await recordForPolicy({
          db,
          req,
          actorUserId: access.envelope.actor.userId,
          body,
          sourceType,
          sourceId,
          staffUserId,
          profile,
          workforce,
          policy,
        }),
      );
    }

    return json({
      ok: true,
      envelope: access.envelope,
      sourceType,
      sourceId,
      workforceMemberId: workforce.id,
      results,
    });
  } catch (error: any) {
    const message = String(error?.message || '');
    if (
      message === 'commission_beneficiary_payroll_profile_required' ||
      message === 'commission_beneficiary_not_eligible'
    ) {
      return json({ ok: false, error: message }, 409);
    }
    return routeError(error, 'enterprise_finance_commission_write_failed');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const awardId = text(body.awardId || body.id, 180);
    const nextStatus = upperStatus(body.status || body.action);

    if (!awardId) return json({ ok: false, error: 'awardId_required' }, 400);
    const award = await db.commissionAward.findUnique({ where: { id: awardId } });
    if (!award) return json({ ok: false, error: 'commission_award_not_found' }, 404);

    const current = upperStatus(award.status);
    if (TERMINAL.has(current)) {
      return json({ ok: false, error: 'commission_award_terminal', currentStatus: current }, 409);
    }
    if (!TRANSITIONS[current]?.has(nextStatus)) {
      return json({
        ok: false,
        error: 'invalid_commission_lifecycle_transition',
        currentStatus: current,
        requestedStatus: nextStatus,
        allowed: Array.from(TRANSITIONS[current] || []),
      }, 409);
    }

    const approvedAmount = asCents(
      body.approvedAmountCents ??
        award.approvedAmountCents ??
        award.calculatedAmountCents,
    );

    const data: any = {
      status: nextStatus,
      meta: {
        ...jsonObject(award.meta),
        lastTransitionReason: text(body.reason || body.note, 1000) || null,
        lastTransitionAt: new Date().toISOString(),
      },
    };

    if (nextStatus === 'APPROVED') {
      data.approvedAmountCents = approvedAmount || award.calculatedAmountCents;
      data.approvedByUserId = access.envelope.actor.userId;
      data.approvedAt = new Date();
      data.rejectedByUserId = null;
      data.rejectedAt = null;
      data.rejectionReason = null;
    }
    if (nextStatus === 'REJECTED') {
      data.rejectedByUserId = access.envelope.actor.userId;
      data.rejectedAt = new Date();
      data.rejectionReason = text(body.reason, 1000) || 'Rejected by Finance';
    }
    if (nextStatus === 'SCHEDULED') {
      const payrollPeriodId = text(body.payrollPeriodId, 180);
      if (!payrollPeriodId) {
        return json({ ok: false, error: 'payrollPeriodId_required_for_scheduling' }, 400);
      }
      data.payrollPeriodId = payrollPeriodId;
    }
    if (nextStatus === 'PAID') {
      const payable = Number(award.approvedAmountCents || award.calculatedAmountCents || 0);
      data.paidAmountCents = Math.min(
        payable,
        asCents(body.paidAmountCents ?? payable),
      );
      data.paymentAllocationId = text(body.paymentAllocationId, 180) || award.paymentAllocationId || null;
    }
    if (nextStatus === 'CLAWED_BACK') {
      data.meta = {
        ...data.meta,
        clawbackAmountCents: asCents(
          body.clawbackAmountCents || award.paidAmountCents || award.approvedAmountCents,
        ),
        clawbackReason: text(body.reason, 1000) || 'Commission clawback',
      };
    }

    const item = await db.$transaction(async (tx: any) => {
      const updated = await tx.commissionAward.update({
        where: { id: awardId },
        data,
      });
      if (award.commissionEventId) {
        await tx.commissionEvent.update({
          where: { id: award.commissionEventId },
          data: { eventStatus: nextStatus },
        });
      }
      return updated;
    });

    await auditEnterpriseFinance('commission_award_status_changed', req, {
      model: 'CommissionAward',
      subjectId: item.id,
      staffUserId: item.staffUserId,
      fromStatus: current,
      toStatus: nextStatus,
      approvedAmountCents: item.approvedAmountCents,
      paidAmountCents: item.paidAmountCents,
    });

    return json({ ok: true, envelope: access.envelope, item });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_commission_update_failed');
  }
}
