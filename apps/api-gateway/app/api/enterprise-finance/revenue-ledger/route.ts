import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  asObject,
  auditEnterpriseFinance,
  dateRangeWhere,
  json,
  parseBool,
  requireEnterpriseFinanceAdmin,
  routeError,
  text,
} from '@/src/enterprise-finance/access-envelope';
import {
  calculateRevenueAmounts,
  normalizeRevenueCategory,
  REVENUE_INFLOW_CATEGORIES,
} from '@/src/lib/enterprise-finance-revenue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 500);

    const where: any = {
      ...dateRangeWhere(searchParams, 'occurredAt'),
    };

    const inflowCategory = text(searchParams.get('inflowCategory'), 100);
    const module = text(searchParams.get('module'), 80);
    const paymentStatus = text(searchParams.get('paymentStatus'), 80);
    const recognitionStatus = text(searchParams.get('recognitionStatus'), 80);

    if (inflowCategory) where.inflowCategory = inflowCategory;
    if (module) where.module = module;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (recognitionStatus) where.recognitionStatus = recognitionStatus;
    if (searchParams.has('manualEntry')) where.manualEntry = parseBool(searchParams.get('manualEntry'));

    const items = await db.revenueLedgerEntry.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return json({ ok: true, envelope: access.envelope, items });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_revenue_ledger_list_failed');
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const inflowCategory = normalizeRevenueCategory(
      body.inflowCategory ?? body.category ?? 'operating_revenue',
    );

    if (!inflowCategory) {
      return json({
        ok: false,
        error: 'unsupported_inflow_category',
        allowedCategories: REVENUE_INFLOW_CATEGORIES,
      }, 400);
    }

    const amounts = calculateRevenueAmounts({
      grossAmountCents: body.grossAmountCents ?? body.amountCents ?? body.amount,
      refundAmountCents: body.refundAmountCents,
      providerFeeCents: body.providerFeeCents,
      providerFeeVatCents: body.providerFeeVatCents,
      otherSettlementDeductionCents: body.otherSettlementDeductionCents,
      category: inflowCategory,
    });

    if (amounts.grossAmountCents <= 0) {
      return json({ ok: false, error: 'positive_gross_amount_required' }, 400);
    }

    const entry = await db.revenueLedgerEntry.create({
      data: {
        entryType: text(body.entryType || 'manual_entry', 100),
        inflowCategory,
        module: text(body.module, 80) || null,
        sourceType: text(body.sourceType || 'manual', 120) || null,
        sourceId: text(body.sourceId, 180) || null,
        externalReference: text(body.externalReference || body.reference, 180) || null,
        paymentProvider: text(body.paymentProvider || body.provider, 80) || null,
        providerEventId:
          text(body.providerEventId || body.providerTransactionReference, 240) || null,
        description: text(body.description || body.note, 1000) || null,
        counterpartyName:
          text(body.counterpartyName || body.counterparty, 240) || null,
        counterpartyEmail: text(body.counterpartyEmail, 240) || null,
        ...amounts,
        platformFeeCents: Number.isFinite(Number(body.platformFeeCents))
          ? Math.max(0, Math.round(Number(body.platformFeeCents)))
          : 0,
        currency: text(body.currency || 'ZAR', 3).toUpperCase(),
        recognitionStatus: text(body.recognitionStatus || 'recognised', 80),
        paymentStatus: text(body.paymentStatus || 'received', 80),
        occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
        recognisedAt: body.recognisedAt ? new Date(body.recognisedAt) : new Date(),
        reconciledAt: body.reconciledAt ? new Date(body.reconciledAt) : null,
        reconciledByUserId:
          text(body.reconciledByUserId || access.envelope.actor.userId, 180) || null,
        manualEntry: true,
        createdByUserId: access.envelope.actor.userId,
        approvedByUserId: text(body.approvedByUserId, 180) || null,
        approvedAt: body.approvedAt ? new Date(body.approvedAt) : null,
        meta: asObject(body.meta),
      },
    });

    await auditEnterpriseFinance('revenue_ledger_manual_entry_created', req, {
      model: 'RevenueLedgerEntry',
      subjectId: entry.id,
      inflowCategory: entry.inflowCategory,
      grossAmountCents: entry.grossAmountCents,
      netSettlementCents: entry.netSettlementCents,
    });

    return json({ ok: true, envelope: access.envelope, item: entry });
  } catch (error: any) {
    if (String(error?.message || '') === 'settlement_deductions_exceed_gross_amount') {
      return json({ ok: false, error: error.message }, 400);
    }
    return routeError(error, 'enterprise_finance_revenue_ledger_create_failed');
  }
}
