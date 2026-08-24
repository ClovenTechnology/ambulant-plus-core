-- Ambulant+ Finance + Commerce authority closeout V1
-- Forward-only migration. Do not edit historical migrations.

-- ---------------------------------------------------------------------------
-- Commerce: explicit buyer eligibility. Publication is governed by channel rows
-- plus buyer-eligibility rows; no implicit "visible everywhere" fallback.
-- ---------------------------------------------------------------------------
CREATE TYPE "ShopBuyerType" AS ENUM (
  'PATIENT',
  'CLINICIAN',
  'PHARMACY',
  'DELIVERY_RIDER',
  'LABORATORY',
  'PHLEBOTOMIST'
);

CREATE TABLE "ShopProductBuyerEligibility" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "buyerType" "ShopBuyerType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopProductBuyerEligibility_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopVariantBuyerEligibility" (
  "id" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "buyerType" "ShopBuyerType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopVariantBuyerEligibility_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopProductBuyerEligibility_productId_buyerType_key"
  ON "ShopProductBuyerEligibility"("productId", "buyerType");
CREATE INDEX "ShopProductBuyerEligibility_buyerType_idx"
  ON "ShopProductBuyerEligibility"("buyerType");

CREATE UNIQUE INDEX "ShopVariantBuyerEligibility_variantId_buyerType_key"
  ON "ShopVariantBuyerEligibility"("variantId", "buyerType");
CREATE INDEX "ShopVariantBuyerEligibility_buyerType_idx"
  ON "ShopVariantBuyerEligibility"("buyerType");

ALTER TABLE "ShopProductBuyerEligibility"
  ADD CONSTRAINT "ShopProductBuyerEligibility_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShopVariantBuyerEligibility"
  ADD CONSTRAINT "ShopVariantBuyerEligibility_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ShopVariant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;


-- Canonical workforce identity is independent of Admin login. Existing payroll
-- profiles are lazily linked by the application so no unsafe guessed backfill is
-- performed in SQL.
CREATE TABLE "WorkforceMember" (
  "id" TEXT NOT NULL,
  "workforceNumber" VARCHAR(120),
  "displayName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "engagementType" VARCHAR(80) NOT NULL DEFAULT 'PERMANENT',
  "status" VARCHAR(80) NOT NULL DEFAULT 'ACTIVE',
  "platformUserId" TEXT,
  "adminStaffProfileId" TEXT,
  "country" VARCHAR(2) NOT NULL DEFAULT 'ZA',
  "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "meta" JSONB,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkforceMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkforceMember_workforceNumber_key" ON "WorkforceMember"("workforceNumber");
CREATE UNIQUE INDEX "WorkforceMember_platformUserId_key" ON "WorkforceMember"("platformUserId");
CREATE UNIQUE INDEX "WorkforceMember_adminStaffProfileId_key" ON "WorkforceMember"("adminStaffProfileId");
CREATE INDEX "WorkforceMember_displayName_idx" ON "WorkforceMember"("displayName");
CREATE INDEX "WorkforceMember_email_idx" ON "WorkforceMember"("email");
CREATE INDEX "WorkforceMember_engagementType_status_idx" ON "WorkforceMember"("engagementType", "status");

ALTER TABLE "StaffPayrollProfile" ADD COLUMN "workforceMemberId" TEXT;
CREATE UNIQUE INDEX "StaffPayrollProfile_workforceMemberId_key" ON "StaffPayrollProfile"("workforceMemberId");
CREATE INDEX "StaffPayrollProfile_workforceMemberId_idx" ON "StaffPayrollProfile"("workforceMemberId");

ALTER TABLE "CommissionEvent" ADD COLUMN "workforceMemberId" TEXT;
CREATE INDEX "CommissionEvent_workforceMemberId_idx" ON "CommissionEvent"("workforceMemberId");

ALTER TABLE "CommissionAward" ADD COLUMN "workforceMemberId" TEXT;
CREATE INDEX "CommissionAward_workforceMemberId_idx" ON "CommissionAward"("workforceMemberId");

-- ---------------------------------------------------------------------------
-- Payroll: effective-dated compensation, calculated entitlement segments and
-- auditable legacy reconciliation. Existing payroll/arrears/payslip models stay
-- authoritative and are extended rather than replaced.
-- ---------------------------------------------------------------------------
CREATE TABLE "StaffCompensationHistory" (
  "id" TEXT NOT NULL,
  "staffUserId" TEXT NOT NULL,
  "payrollProfileId" TEXT NOT NULL,
  "staffProfileId" TEXT,
  "sourceFingerprint" TEXT NOT NULL,
  "sourceType" VARCHAR(120) NOT NULL DEFAULT 'payroll_profile',
  "sourceId" TEXT,
  "changeType" VARCHAR(80),
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "compensationType" VARCHAR(80) NOT NULL DEFAULT 'salary',
  "baseSalaryCents" INTEGER NOT NULL DEFAULT 0,
  "hourlyRateCents" INTEGER NOT NULL DEFAULT 0,
  "defaultHoursPerPeriod" DECIMAL(10,2),
  "payFrequency" VARCHAR(80) NOT NULL DEFAULT 'monthly',
  "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
  "lockedAt" TIMESTAMP(3),
  "lockedByUserId" TEXT,
  "notes" TEXT,
  "meta" JSONB,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffCompensationHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffCompensationHistory_sourceFingerprint_key"
  ON "StaffCompensationHistory"("sourceFingerprint");
CREATE INDEX "StaffCompensationHistory_staffUserId_effectiveFrom_idx"
  ON "StaffCompensationHistory"("staffUserId", "effectiveFrom");
CREATE INDEX "StaffCompensationHistory_payrollProfileId_effectiveFrom_idx"
  ON "StaffCompensationHistory"("payrollProfileId", "effectiveFrom");
CREATE INDEX "StaffCompensationHistory_staffProfileId_effectiveFrom_idx"
  ON "StaffCompensationHistory"("staffProfileId", "effectiveFrom");
CREATE INDEX "StaffCompensationHistory_sourceType_sourceId_idx"
  ON "StaffCompensationHistory"("sourceType", "sourceId");

CREATE TABLE "StaffPayrollEntitlement" (
  "id" TEXT NOT NULL,
  "staffUserId" TEXT NOT NULL,
  "payrollProfileId" TEXT NOT NULL,
  "payrollPeriodId" TEXT NOT NULL,
  "periodStartsAt" TIMESTAMP(3) NOT NULL,
  "periodEndsAt" TIMESTAMP(3) NOT NULL,
  "grossEntitlementCents" INTEGER NOT NULL DEFAULT 0,
  "amountHistoricallySettledCents" INTEGER NOT NULL DEFAULT 0,
  "postReconciliationPaidCents" INTEGER NOT NULL DEFAULT 0,
  "remainingCents" INTEGER NOT NULL DEFAULT 0,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
  "settlementState" VARCHAR(80) NOT NULL DEFAULT 'UNPAID',
  "calculationStatus" VARCHAR(80) NOT NULL DEFAULT 'CALCULATED',
  "calculationVersion" INTEGER NOT NULL DEFAULT 1,
  "prorationMeta" JSONB,
  "warningMeta" JSONB,
  "lockedAt" TIMESTAMP(3),
  "lockedByUserId" TEXT,
  "generatedByUserId" TEXT,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffPayrollEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffPayrollEntitlement_staffUserId_payrollPeriodId_key"
  ON "StaffPayrollEntitlement"("staffUserId", "payrollPeriodId");
CREATE INDEX "StaffPayrollEntitlement_payrollProfileId_periodStartsAt_idx"
  ON "StaffPayrollEntitlement"("payrollProfileId", "periodStartsAt");
CREATE INDEX "StaffPayrollEntitlement_settlementState_idx"
  ON "StaffPayrollEntitlement"("settlementState");
CREATE INDEX "StaffPayrollEntitlement_lockedAt_idx"
  ON "StaffPayrollEntitlement"("lockedAt");

CREATE TABLE "StaffPayrollEntitlementSegment" (
  "id" TEXT NOT NULL,
  "entitlementId" TEXT NOT NULL,
  "compensationHistoryId" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3) NOT NULL,
  "salaryRateCents" INTEGER NOT NULL DEFAULT 0,
  "grossEntitlementCents" INTEGER NOT NULL DEFAULT 0,
  "eligibleDayCount" INTEGER NOT NULL DEFAULT 0,
  "periodDayCount" INTEGER NOT NULL DEFAULT 0,
  "prorationFactor" DECIMAL(14,10) NOT NULL DEFAULT 0,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffPayrollEntitlementSegment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StaffPayrollEntitlementSegment_entitlementId_effectiveFrom_idx"
  ON "StaffPayrollEntitlementSegment"("entitlementId", "effectiveFrom");
CREATE INDEX "StaffPayrollEntitlementSegment_compensationHistoryId_idx"
  ON "StaffPayrollEntitlementSegment"("compensationHistoryId");

CREATE TABLE "StaffPayrollHistoricalReconciliation" (
  "id" TEXT NOT NULL,
  "entitlementId" TEXT NOT NULL,
  "staffUserId" TEXT NOT NULL,
  "payrollProfileId" TEXT NOT NULL,
  "settlementState" VARCHAR(80) NOT NULL,
  "amountHistoricallySettledCents" INTEGER NOT NULL DEFAULT 0,
  "reference" TEXT,
  "note" TEXT,
  "sourceType" VARCHAR(120) NOT NULL DEFAULT 'legacy_onboarding',
  "effectiveAt" TIMESTAMP(3),
  "lockedAt" TIMESTAMP(3),
  "lockedByUserId" TEXT,
  "recordedByUserId" TEXT,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffPayrollHistoricalReconciliation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StaffPayrollHistoricalReconciliation_entitlementId_key"
  ON "StaffPayrollHistoricalReconciliation"("entitlementId");
CREATE INDEX "StaffPayrollHistoricalReconciliation_staffUserId_idx"
  ON "StaffPayrollHistoricalReconciliation"("staffUserId");
CREATE INDEX "StaffPayrollHistoricalReconciliation_payrollProfileId_idx"
  ON "StaffPayrollHistoricalReconciliation"("payrollProfileId");
CREATE INDEX "StaffPayrollHistoricalReconciliation_settlementState_idx"
  ON "StaffPayrollHistoricalReconciliation"("settlementState");
CREATE INDEX "StaffPayrollHistoricalReconciliation_lockedAt_idx"
  ON "StaffPayrollHistoricalReconciliation"("lockedAt");

-- Commission idempotency is source event + policy + beneficiary. Remove the
-- older source+beneficiary uniqueness that incorrectly prevented multiple
-- policies from legitimately evaluating the same source event.
ALTER TABLE "CommissionEvent" ADD COLUMN "dedupeKey" TEXT;
DROP INDEX IF EXISTS "CommissionEvent_sourceType_sourceId_staffUserId_key";
CREATE UNIQUE INDEX "CommissionEvent_dedupeKey_key" ON "CommissionEvent"("dedupeKey");
CREATE INDEX "CommissionEvent_sourceType_sourceId_staffUserId_idx"
  ON "CommissionEvent"("sourceType", "sourceId", "staffUserId");

-- ---------------------------------------------------------------------------
-- Revenue: preserve gross revenue, provider deductions and cash settlement as
-- separately reportable accounting facts.
-- ---------------------------------------------------------------------------
ALTER TABLE "RevenueLedgerEntry"
  ADD COLUMN "providerFeeVatCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "otherSettlementDeductionCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "netSettlementCents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "FinanceReportSnapshot"
  ADD COLUMN "financingInflowCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "providerFeeCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "netSettlementCents" INTEGER NOT NULL DEFAULT 0;

-- Upload-first governance document support. Existing URL fields remain for
-- backwards compatibility while managed object keys become the normal path.
ALTER TABLE "CompanyValuationSnapshot" ADD COLUMN "documentObjectKey" TEXT;
ALTER TABLE "AnnualReturn" ADD COLUMN "documentObjectKey" TEXT;
ALTER TABLE "BoardResolution" ADD COLUMN "documentObjectKey" TEXT;
ALTER TABLE "AGMNotice" ADD COLUMN "documentObjectKey" TEXT;
