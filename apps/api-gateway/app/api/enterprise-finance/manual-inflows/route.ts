import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  asObject,
  auditEnterpriseFinance,
  dateRangeWhere,
  json,
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
      manualEntry: true,
    };

    const inflowCategory = text(searchParams.get('inflowCategory'), 100);
    if (inflowCategory) where.inflowCategory = inflowCategory;

    const items = await db.revenueLedgerEntry.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return json({
      ok: true,
      envelope: access.envelope,
      items,
      allowedCategories: REVENUE_INFLOW_CATEGORIES,
    });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_manual_inflows_list_failed');
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const inflowCategory = normalizeRevenueCategory(
      body.inflowCategory ?? body.category ?? 'other',
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
      providerFeeCents: body.providerFeeCents ?? body.providerFee,
      providerFeeVatCents: body.providerFeeVatCents ?? body.providerFeeVat,
      otherSettlementDeductionCents:
        body.otherSettlementDeductionCents ?? body.otherSettlementDeduction,
      category: inflowCategory,
    });

    if (amounts.grossAmountCents <= 0) {
      return json({ ok: false, error: 'positive_gross_amount_required' }, 400);
    }

    const meta = {
      ...asObject(body.meta),
      ...(text(body.supportingDocumentObjectKey, 700)
        ? { supportingDocumentObjectKey: text(body.supportingDocumentObjectKey, 700) }
        : {}),
      accountingSemantics: {
        grossRevenueRecognised: inflowCategory === 'operating_revenue',
        investmentInflow:
          inflowCategory === 'investment' || inflowCategory === 'capital_contribution',
        financingInflow: inflowCategory === 'founder_loan',
      },
    };

    const item = await db.revenueLedgerEntry.create({
      data: {
        entryType: text(body.entryType || 'manual_inflow', 100),
        inflowCategory,
        module: text(body.module || 'enterprise_finance', 80),
        sourceType: text(body.sourceType || 'manual_inflow', 120),
        sourceId: text(body.sourceId, 180) || null,
        externalReference: text(body.externalReference || body.reference, 180) || null,
        paymentProvider: text(body.paymentProvider || body.provider || body.paymentMethod, 80) || null,
        providerEventId:
          text(body.providerEventId || body.providerTransactionReference, 240) || null,
        description: text(body.description || body.note, 1000) || null,
        counterpartyName:
          text(
            body.counterpartyName ||
              body.counterparty ||
              body.investorName ||
              body.contributorName,
            240,
          ) || null,
        counterpartyEmail: text(body.counterpartyEmail, 240) || null,
        ...amounts,
        currency: text(body.currency || 'ZAR', 3).toUpperCase(),
        recognitionStatus: text(body.recognitionStatus || 'recognised', 80),
        paymentStatus: text(body.paymentStatus || 'received', 80),
        occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
        recognisedAt: new Date(),
        reconciledAt: body.reconciledAt ? new Date(body.reconciledAt) : new Date(),
        reconciledByUserId: access.envelope.actor.userId,
        manualEntry: true,
        createdByUserId: access.envelope.actor.userId,
        approvedByUserId: text(body.approvedByUserId, 180) || null,
        approvedAt: body.approvedAt ? new Date(body.approvedAt) : null,
        meta,
      },
    });

    await auditEnterpriseFinance('manual_inflow_created', req, {
      model: 'RevenueLedgerEntry',
      subjectId: item.id,
      inflowCategory,
      grossAmountCents: amounts.grossAmountCents,
      providerFeeCents: amounts.providerFeeCents,
      providerFeeVatCents: amounts.providerFeeVatCents,
      otherSettlementDeductionCents: amounts.otherSettlementDeductionCents,
      netSettlementCents: amounts.netSettlementCents,
    });

    return json({ ok: true, envelope: access.envelope, item });
  } catch (error: any) {
    if (String(error?.message || '') === 'settlement_deductions_exceed_gross_amount') {
      return json({ ok: false, error: error.message }, 400);
    }
    return routeError(error, 'enterprise_finance_manual_inflow_create_failed');
  }
}
