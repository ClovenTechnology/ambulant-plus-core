import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  dateRangeWhere,
  json,
  requireEnterpriseFinanceAdmin,
  routeError,
  safeAggregateSum,
  safeCount,
} from '@/src/enterprise-finance/access-envelope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const { searchParams } = new URL(req.url);
    const revenueWhere = dateRangeWhere(searchParams, 'occurredAt');
    const arrearsWhere = {
      ...dateRangeWhere(searchParams, 'effectiveAt'),
      status: { in: ['open', 'partial', 'unpaid', 'overdue'] },
    };

    const operatingRevenue = await safeAggregateSum(
      db.revenueLedgerEntry,
      [
        'grossAmountCents',
        'refundAmountCents',
        'providerFeeCents',
        'providerFeeVatCents',
        'otherSettlementDeductionCents',
        'netSettlementCents',
        'netPlatformRevenueCents',
        'amountReceivedCents',
      ],
      { ...revenueWhere, inflowCategory: 'operating_revenue' },
    );

    const allInflows = await safeAggregateSum(
      db.revenueLedgerEntry,
      [
        'providerFeeCents',
        'providerFeeVatCents',
        'otherSettlementDeductionCents',
        'netSettlementCents',
        'amountReceivedCents',
      ],
      revenueWhere,
    );

    const manualInflows = await safeAggregateSum(
      db.revenueLedgerEntry,
      ['grossAmountCents', 'netSettlementCents', 'amountReceivedCents'],
      { ...revenueWhere, manualEntry: true },
    );

    const investmentInflows = await safeAggregateSum(
      db.revenueLedgerEntry,
      ['grossAmountCents', 'netSettlementCents', 'amountReceivedCents'],
      {
        ...revenueWhere,
        inflowCategory: { in: ['investment', 'capital_contribution'] },
      },
    );

    const financingInflows = await safeAggregateSum(
      db.revenueLedgerEntry,
      ['grossAmountCents', 'netSettlementCents', 'amountReceivedCents'],
      { ...revenueWhere, inflowCategory: 'founder_loan' },
    );

    const arrears = await safeAggregateSum(
      db.staffArrearsLedger,
      ['debitCents', 'creditCents'],
      arrearsWhere,
    );

    const commissionPayable = await safeAggregateSum(
      db.commissionAward,
      ['approvedAmountCents', 'paidAmountCents'],
      {
        status: {
          in: [
            'approved',
            'APPROVED',
            'scheduled',
            'SCHEDULED',
            'included_in_payroll',
            'partially_paid',
          ],
        },
      },
    );

    const contractorPayable = await safeAggregateSum(
      db.payout,
      ['amountCents'],
      { status: { in: ['pending', 'approved'] } },
    );

    const payrollLiabilityCents = Math.max(
      0,
      (arrears.debitCents || 0) - (arrears.creditCents || 0),
    );
    const commissionPayableCents = Math.max(
      0,
      (commissionPayable.approvedAmountCents || 0) -
        (commissionPayable.paidAmountCents || 0),
    );

    const counts = {
      staffPayrollProfiles: await safeCount(db.staffPayrollProfile),
      openArrears: await safeCount(db.staffArrearsLedger, arrearsWhere),
      revenueEntries: await safeCount(db.revenueLedgerEntry, revenueWhere),
      shareholders: await safeCount(db.shareholder, {
        investorStatus: { in: ['active', 'approved'] },
      }),
      shareClasses: await safeCount(db.shareClass, { active: true }),
      pendingCommissions: await safeCount(db.commissionAward, {
        status: {
          in: ['draft', 'pending_review', 'PENDING', 'EARNED', 'approved', 'APPROVED'],
        },
      }),
      publishedAnnouncements: await safeCount(db.shareholderAnnouncement, {
        visibleToShareholders: true,
      }),
    };

    const received = (row: Record<string, number>) =>
      row.netSettlementCents || row.amountReceivedCents || row.grossAmountCents || 0;

    return json({
      ok: true,
      envelope: access.envelope,
      summary: {
        currency: 'ZAR',
        // Only operating revenue is gross revenue.
        grossRevenueCents: operatingRevenue.grossAmountCents || 0,
        netPlatformRevenueCents: operatingRevenue.netPlatformRevenueCents || 0,
        amountReceivedCents: allInflows.netSettlementCents || allInflows.amountReceivedCents || 0,
        netSettlementCents: allInflows.netSettlementCents || allInflows.amountReceivedCents || 0,
        refundAmountCents: operatingRevenue.refundAmountCents || 0,
        providerFeeCents: allInflows.providerFeeCents || 0,
        providerFeeVatCents: allInflows.providerFeeVatCents || 0,
        otherSettlementDeductionCents:
          allInflows.otherSettlementDeductionCents || 0,
        manualInflowCents: received(manualInflows),
        investmentInflowCents: received(investmentInflows),
        financingInflowCents: received(financingInflows),
        contractorPayableCents: contractorPayable.amountCents || 0,
        payrollLiabilityCents,
        salaryArrearsCents: payrollLiabilityCents,
        commissionPayableCents,
      },
      counts,
    });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_overview_failed');
  }
}
