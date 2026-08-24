export const REVENUE_INFLOW_CATEGORIES = [
  'operating_revenue',
  'investment',
  'capital_contribution',
  'founder_loan',
  'grant',
  'donation',
  'asset_sale',
  'adjustment',
  'other',
] as const;

export type RevenueInflowCategory = (typeof REVENUE_INFLOW_CATEGORIES)[number];

const CATEGORY_SET = new Set<string>(REVENUE_INFLOW_CATEGORIES);

export function normalizeRevenueCategory(value: unknown): RevenueInflowCategory | null {
  const raw = String(value ?? '').trim().toLowerCase();
  return CATEGORY_SET.has(raw) ? (raw as RevenueInflowCategory) : null;
}

export function isOperatingRevenueCategory(category: RevenueInflowCategory) {
  return category === 'operating_revenue';
}

export function isInvestmentCategory(category: RevenueInflowCategory) {
  return category === 'investment' || category === 'capital_contribution';
}

export function isFinancingCategory(category: RevenueInflowCategory) {
  return category === 'founder_loan';
}

function cents(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

export function calculateRevenueAmounts(input: {
  grossAmountCents: unknown;
  refundAmountCents?: unknown;
  providerFeeCents?: unknown;
  providerFeeVatCents?: unknown;
  otherSettlementDeductionCents?: unknown;
  category: RevenueInflowCategory;
}) {
  const grossAmountCents = cents(input.grossAmountCents);
  const refundAmountCents = cents(input.refundAmountCents);
  const providerFeeCents = cents(input.providerFeeCents);
  const providerFeeVatCents = cents(input.providerFeeVatCents);
  const otherSettlementDeductionCents = cents(input.otherSettlementDeductionCents);

  const deductions =
    refundAmountCents +
    providerFeeCents +
    providerFeeVatCents +
    otherSettlementDeductionCents;

  if (deductions > grossAmountCents) {
    throw new Error('settlement_deductions_exceed_gross_amount');
  }

  const netSettlementCents = grossAmountCents - deductions;

  return {
    grossAmountCents,
    refundAmountCents,
    providerFeeCents,
    providerFeeVatCents,
    otherSettlementDeductionCents,
    netSettlementCents,
    amountReceivedCents: netSettlementCents,
    netPlatformRevenueCents: isOperatingRevenueCategory(input.category)
      ? netSettlementCents
      : 0,
  };
}
