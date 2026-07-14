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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A5_K_D_C_ENTERPRISE_FINANCE_COMMISSION_ROUTE

export async function GET(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 500);

    const staffUserId = text(searchParams.get('staffUserId'), 180);
    const status = text(searchParams.get('status'), 80);

    const policies = await db.commissionPolicy.findMany({
      where: searchParams.has('active') ? { active: searchParams.get('active') === 'true' } : {},
      orderBy: [{ updatedAt: 'desc' }],
      take: limit,
    });

    const events = await db.commissionEvent.findMany({
      where: {
        ...(staffUserId ? { staffUserId } : {}),
        ...(status ? { eventStatus: status } : {}),
      },
      orderBy: [{ occurredAt: 'desc' }],
      take: limit,
    });

    const awards = await db.commissionAward.findMany({
      where: {
        ...(staffUserId ? { staffUserId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: limit,
    });

    return json({ ok: true, envelope: access.envelope, policies, events, awards });
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
    const action = text(body.action || 'record_event', 80);

    if (action === 'create_policy') {
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
          requiresApproval: body.requiresApproval === undefined ? true : Boolean(body.requiresApproval),
          startsAt: body.startsAt ? new Date(body.startsAt) : null,
          endsAt: body.endsAt ? new Date(body.endsAt) : null,
          ruleMeta: asObject(body.ruleMeta),
          createdByUserId: access.envelope.actor.userId,
          approvedByUserId: text(body.approvedByUserId, 180) || null,
          approvedAt: body.approvedAt ? new Date(body.approvedAt) : null,
        },
      });

      await auditEnterpriseFinance('commission_policy_created', req, { model: 'CommissionPolicy', subjectId: item.id });
      return json({ ok: true, envelope: access.envelope, item });
    }

    if (action === 'approve_award') {
      const staffUserId = text(body.staffUserId, 180);
      if (!staffUserId) return json({ ok: false, error: 'staffUserId_required' }, 400);

      const item = await db.commissionAward.create({
        data: {
          commissionEventId: text(body.commissionEventId, 180) || null,
          staffUserId,
          status: 'approved',
          calculatedAmountCents: asCents(body.calculatedAmountCents ?? body.approvedAmountCents),
          approvedAmountCents: asCents(body.approvedAmountCents ?? body.calculatedAmountCents),
          currency: text(body.currency || 'ZAR', 3).toUpperCase(),
          payrollPeriodId: text(body.payrollPeriodId, 180) || null,
          payslipId: text(body.payslipId, 180) || null,
          approvedByUserId: access.envelope.actor.userId,
          approvedAt: new Date(),
          meta: asObject(body.meta),
        },
      });

      await auditEnterpriseFinance('commission_award_approved', req, {
        model: 'CommissionAward',
        subjectId: item.id,
        staffUserId,
        amountCents: item.approvedAmountCents,
      });

      return json({ ok: true, envelope: access.envelope, item });
    }

    const item = await db.commissionEvent.create({
      data: {
        sourceType: text(body.sourceType || 'manual', 120),
        sourceId: text(body.sourceId || 'manual-' + Date.now(), 180),
        staffUserId: text(body.staffUserId, 180) || null,
        eventStatus: text(body.eventStatus || 'pending_review', 80),
        occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
        grossSourceValueCents: asCents(body.grossSourceValueCents),
        calculatedCommissionCents: asCents(body.calculatedCommissionCents),
        currency: text(body.currency || 'ZAR', 3).toUpperCase(),
        policyId: text(body.policyId, 180) || null,
        module: text(body.module, 80) || null,
        attributionMeta: asObject(body.attributionMeta),
        sourceMeta: asObject(body.sourceMeta),
      },
    });

    await auditEnterpriseFinance('commission_event_recorded', req, {
      model: 'CommissionEvent',
      subjectId: item.id,
      staffUserId: item.staffUserId,
    });

    return json({ ok: true, envelope: access.envelope, item });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_commission_write_failed');
  }
}
