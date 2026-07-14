import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  asCents,
  asObject,
  auditEnterpriseFinance,
  dateRangeWhere,
  json,
  requireEnterpriseFinanceAdmin,
  routeError,
  text,
} from '@/src/enterprise-finance/access-envelope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A5_K_D_C_ENTERPRISE_FINANCE_MANUAL_INFLOWS_ROUTE

const ALLOWED_CATEGORIES = new Set([
  'operating_revenue',
  'investment',
  'capital_contribution',
  'founder_loan',
  'grant',
  'donation',
  'asset_sale',
  'adjustment',
  'other',
]);

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

    return json({ ok: true, envelope: access.envelope, items, allowedCategories: Array.from(ALLOWED_CATEGORIES) });
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
    const inflowCategory = text(body.inflowCategory || 'other', 100);

    if (!ALLOWED_CATEGORIES.has(inflowCategory)) {
      return json({ ok: false, error: 'unsupported_inflow_category', allowedCategories: Array.from(ALLOWED_CATEGORIES) }, 400);
    }

    const amountCents = asCents(body.amountCents ?? body.grossAmountCents ?? body.amount);
    if (amountCents <= 0) return json({ ok: false, error: 'positive_amount_required' }, 400);

    const item = await db.revenueLedgerEntry.create({
      data: {
        entryType: text(body.entryType || 'manual_inflow', 100),
        inflowCategory,
        module: text(body.module || 'enterprise_finance', 80),
        sourceType: text(body.sourceType || 'manual_inflow', 120),
        sourceId: text(body.sourceId, 180) || null,
        externalReference: text(body.externalReference || body.reference, 180) || null,
        paymentProvider: text(body.paymentProvider || body.paymentMethod, 80) || null,
        description: text(body.description || body.note, 1000) || null,
        counterpartyName: text(body.counterpartyName || body.investorName || body.contributorName, 240) || null,
        counterpartyEmail: text(body.counterpartyEmail, 240) || null,
        grossAmountCents: amountCents,
        netPlatformRevenueCents: inflowCategory === 'operating_revenue' ? amountCents : 0,
        amountReceivedCents: asCents(body.amountReceivedCents ?? amountCents),
        currency: text(body.currency || 'ZAR', 3).toUpperCase(),
        recognitionStatus: text(body.recognitionStatus || 'recognised', 80),
        paymentStatus: text(body.paymentStatus || 'received', 80),
        occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
        recognisedAt: new Date(),
        reconciledAt: body.reconciledAt ? new Date(body.reconciledAt) : null,
        reconciledByUserId: access.envelope.actor.userId,
        manualEntry: true,
        createdByUserId: access.envelope.actor.userId,
        approvedByUserId: text(body.approvedByUserId, 180) || null,
        approvedAt: body.approvedAt ? new Date(body.approvedAt) : null,
        meta: asObject(body.meta),
      },
    });

    await auditEnterpriseFinance('manual_inflow_created', req, {
      model: 'RevenueLedgerEntry',
      subjectId: item.id,
      inflowCategory,
      amountCents,
    });

    return json({ ok: true, envelope: access.envelope, item });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_manual_inflow_create_failed');
  }
}
