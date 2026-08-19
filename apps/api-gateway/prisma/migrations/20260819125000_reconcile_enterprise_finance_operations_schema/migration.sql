BEGIN;

-- Ambulant+ Enterprise Finance / Operations physical-schema reconciliation
-- Generated from a read-only Prisma migrate diff:
--   live Production database -> current prisma/schema.prisma
-- Source governed HEAD: 110a930e2a8592e5d3773da12aaeafdef5adc6f7
-- Source diff SHA256: 4c56fa4e936eb4aadec62cb83e80a93c75bab22ff3c0358770b5f552bb8ef7e5
--
-- Scope intentionally limited to the 42 physically absent schema-only models
-- and their indexes. Unrelated pre-existing default/constraint/index-name drift
-- from the full Prisma diff is deliberately excluded from this repair migration.
--
-- CreateTable
CREATE TABLE "StaffPayrollProfile" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "staffDisplayName" TEXT,
    "staffEmail" TEXT,
    "staffRole" VARCHAR(120),
    "departmentId" TEXT,
    "designationId" TEXT,
    "employmentType" VARCHAR(80) NOT NULL DEFAULT 'permanent',
    "payrollStatus" VARCHAR(80) NOT NULL DEFAULT 'draft',
    "country" VARCHAR(2) NOT NULL DEFAULT 'ZA',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "baseSalaryCents" INTEGER NOT NULL DEFAULT 0,
    "hourlyRateCents" INTEGER NOT NULL DEFAULT 0,
    "defaultHoursPerPeriod" DECIMAL(10,2),
    "payFrequency" VARCHAR(80) NOT NULL DEFAULT 'monthly',
    "commissionEligible" BOOLEAN NOT NULL DEFAULT false,
    "commissionMode" VARCHAR(80) NOT NULL DEFAULT 'none',
    "taxNumber" TEXT,
    "payrollNumber" TEXT,
    "employerReference" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "profileMeta" JSONB,
    "payrollMeta" JSONB,
    "approvalStatus" VARCHAR(80) NOT NULL DEFAULT 'pending',
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPayrollProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffBankAccount" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "payrollProfileId" TEXT,
    "accountHolderName" TEXT,
    "bankName" TEXT,
    "bankCode" TEXT,
    "branchCode" TEXT,
    "accountNumberMasked" TEXT,
    "accountNumberEncrypted" TEXT,
    "accountType" VARCHAR(80),
    "country" VARCHAR(2) NOT NULL DEFAULT 'ZA',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "paystackRecipientCode" TEXT,
    "verificationStatus" VARCHAR(80) NOT NULL DEFAULT 'unverified',
    "verificationProvider" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "meta" JSONB,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "periodType" VARCHAR(80) NOT NULL DEFAULT 'monthly',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "payDate" TIMESTAMP(3),
    "country" VARCHAR(2) NOT NULL DEFAULT 'ZA',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "status" VARCHAR(80) NOT NULL DEFAULT 'draft',
    "lockedAt" TIMESTAMP(3),
    "lockedByUserId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "runType" VARCHAR(80) NOT NULL DEFAULT 'regular',
    "status" VARCHAR(80) NOT NULL DEFAULT 'draft',
    "staffCount" INTEGER NOT NULL DEFAULT 0,
    "grossCents" INTEGER NOT NULL DEFAULT 0,
    "allowanceCents" INTEGER NOT NULL DEFAULT 0,
    "commissionCents" INTEGER NOT NULL DEFAULT 0,
    "deductionCents" INTEGER NOT NULL DEFAULT 0,
    "employerCostCents" INTEGER NOT NULL DEFAULT 0,
    "netPayCents" INTEGER NOT NULL DEFAULT 0,
    "arrearsCreatedCents" INTEGER NOT NULL DEFAULT 0,
    "arrearsPaidCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "generatedByUserId" TEXT,
    "generatedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT,
    "payrollPeriodId" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "payrollProfileId" TEXT,
    "payslipNumber" TEXT,
    "status" VARCHAR(80) NOT NULL DEFAULT 'draft',
    "grossSalaryCents" INTEGER NOT NULL DEFAULT 0,
    "allowanceCents" INTEGER NOT NULL DEFAULT 0,
    "commissionCents" INTEGER NOT NULL DEFAULT 0,
    "arrearsPaidCents" INTEGER NOT NULL DEFAULT 0,
    "deductionCents" INTEGER NOT NULL DEFAULT 0,
    "taxWithholdingCents" INTEGER NOT NULL DEFAULT 0,
    "uifCents" INTEGER NOT NULL DEFAULT 0,
    "pensionCents" INTEGER NOT NULL DEFAULT 0,
    "netPayCents" INTEGER NOT NULL DEFAULT 0,
    "unpaidBalanceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "documentUrl" TEXT,
    "pdfObjectKey" TEXT,
    "issuedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "employerNote" TEXT,
    "staffNote" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayslipLineItem" (
    "id" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "staffUserId" TEXT,
    "lineType" VARCHAR(80) NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "affectsNetPay" BOOLEAN NOT NULL DEFAULT true,
    "sourceType" VARCHAR(120),
    "sourceId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayslipLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffSalaryAccrual" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "payrollProfileId" TEXT,
    "payrollPeriodId" TEXT,
    "payslipId" TEXT,
    "accrualType" VARCHAR(80) NOT NULL DEFAULT 'salary',
    "status" VARCHAR(80) NOT NULL DEFAULT 'accrued',
    "earnedFrom" TIMESTAMP(3) NOT NULL,
    "earnedTo" TIMESTAMP(3) NOT NULL,
    "grossCents" INTEGER NOT NULL DEFAULT 0,
    "netExpectedCents" INTEGER NOT NULL DEFAULT 0,
    "paidCents" INTEGER NOT NULL DEFAULT 0,
    "unpaidCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "sourceType" VARCHAR(120),
    "sourceId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffSalaryAccrual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffArrearsLedger" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "payrollProfileId" TEXT,
    "payrollPeriodId" TEXT,
    "payslipId" TEXT,
    "salaryAccrualId" TEXT,
    "entryType" VARCHAR(80) NOT NULL,
    "status" VARCHAR(80) NOT NULL DEFAULT 'open',
    "description" TEXT,
    "debitCents" INTEGER NOT NULL DEFAULT 0,
    "creditCents" INTEGER NOT NULL DEFAULT 0,
    "balanceAfterCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "dueDate" TIMESTAMP(3),
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" VARCHAR(120),
    "sourceId" TEXT,
    "batchId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffArrearsLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPaymentBatch" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "batchType" VARCHAR(80) NOT NULL DEFAULT 'payroll',
    "status" VARCHAR(80) NOT NULL DEFAULT 'draft',
    "staffCount" INTEGER NOT NULL DEFAULT 0,
    "allocationCount" INTEGER NOT NULL DEFAULT 0,
    "totalAmountCents" INTEGER NOT NULL DEFAULT 0,
    "paidAmountCents" INTEGER NOT NULL DEFAULT 0,
    "failedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "paymentMethod" VARCHAR(80) NOT NULL DEFAULT 'manual',
    "paystackBatchRef" TEXT,
    "manualReference" TEXT,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "filtersMeta" JSONB,
    "resultMeta" JSONB,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPaymentBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentBatchId" TEXT,
    "staffUserId" TEXT NOT NULL,
    "payslipId" TEXT,
    "arrearsLedgerEntryId" TEXT,
    "salaryAccrualId" TEXT,
    "allocationType" VARCHAR(80) NOT NULL DEFAULT 'arrears_payment',
    "status" VARCHAR(80) NOT NULL DEFAULT 'pending',
    "amountCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "paymentMethod" VARCHAR(80) NOT NULL DEFAULT 'manual',
    "paymentReference" TEXT,
    "paystackTransferCode" TEXT,
    "paystackReference" TEXT,
    "failureReason" TEXT,
    "allocatedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "reconciledByUserId" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPayrollDispute" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "payslipId" TEXT,
    "arrearsLedgerEntryId" TEXT,
    "disputeType" VARCHAR(80) NOT NULL DEFAULT 'payroll_query',
    "status" VARCHAR(80) NOT NULL DEFAULT 'open',
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "resolutionNote" TEXT,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPayrollDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceType" VARCHAR(120) NOT NULL,
    "appliesToRole" VARCHAR(120),
    "calculationMode" VARCHAR(80) NOT NULL DEFAULT 'manual',
    "rateBps" INTEGER NOT NULL DEFAULT 0,
    "flatAmountCents" INTEGER NOT NULL DEFAULT 0,
    "thresholdCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "ruleMeta" JSONB,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionEvent" (
    "id" TEXT NOT NULL,
    "sourceType" VARCHAR(120) NOT NULL,
    "sourceId" TEXT NOT NULL,
    "staffUserId" TEXT,
    "eventStatus" VARCHAR(80) NOT NULL DEFAULT 'pending_review',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grossSourceValueCents" INTEGER NOT NULL DEFAULT 0,
    "calculatedCommissionCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "policyId" TEXT,
    "module" VARCHAR(80),
    "attributionMeta" JSONB,
    "sourceMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionAward" (
    "id" TEXT NOT NULL,
    "commissionEventId" TEXT,
    "staffUserId" TEXT NOT NULL,
    "status" VARCHAR(80) NOT NULL DEFAULT 'draft',
    "calculatedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "approvedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "paidAmountCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "payrollPeriodId" TEXT,
    "payslipId" TEXT,
    "paymentAllocationId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueLedgerEntry" (
    "id" TEXT NOT NULL,
    "entryType" VARCHAR(100) NOT NULL,
    "inflowCategory" VARCHAR(100) NOT NULL DEFAULT 'operating_revenue',
    "module" VARCHAR(80),
    "sourceType" VARCHAR(120),
    "sourceId" TEXT,
    "externalReference" TEXT,
    "paymentProvider" TEXT,
    "providerEventId" TEXT,
    "description" TEXT,
    "counterpartyName" TEXT,
    "counterpartyEmail" TEXT,
    "grossAmountCents" INTEGER NOT NULL DEFAULT 0,
    "refundAmountCents" INTEGER NOT NULL DEFAULT 0,
    "providerFeeCents" INTEGER NOT NULL DEFAULT 0,
    "platformFeeCents" INTEGER NOT NULL DEFAULT 0,
    "netPlatformRevenueCents" INTEGER NOT NULL DEFAULT 0,
    "amountReceivedCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "recognitionStatus" VARCHAR(80) NOT NULL DEFAULT 'pending',
    "paymentStatus" VARCHAR(80) NOT NULL DEFAULT 'unreconciled',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recognisedAt" TIMESTAMP(3),
    "reconciledAt" TIMESTAMP(3),
    "reconciledByUserId" TEXT,
    "manualEntry" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevenueLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceReportSnapshot" (
    "id" TEXT NOT NULL,
    "reportType" VARCHAR(120) NOT NULL,
    "label" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "grossRevenueCents" INTEGER NOT NULL DEFAULT 0,
    "netPlatformRevenueCents" INTEGER NOT NULL DEFAULT 0,
    "manualInflowCents" INTEGER NOT NULL DEFAULT 0,
    "investmentInflowCents" INTEGER NOT NULL DEFAULT 0,
    "contractorPayableCents" INTEGER NOT NULL DEFAULT 0,
    "payrollLiabilityCents" INTEGER NOT NULL DEFAULT 0,
    "salaryArrearsCents" INTEGER NOT NULL DEFAULT 0,
    "commissionPayableCents" INTEGER NOT NULL DEFAULT 0,
    "cashOutCents" INTEGER NOT NULL DEFAULT 0,
    "snapshotMeta" JSONB,
    "generatedByUserId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAuditEvent" (
    "id" TEXT NOT NULL,
    "eventType" VARCHAR(120) NOT NULL,
    "actorUserId" TEXT,
    "actorRole" VARCHAR(120),
    "subjectType" VARCHAR(120),
    "subjectId" TEXT,
    "staffUserId" TEXT,
    "beforeMeta" JSONB,
    "afterMeta" JSONB,
    "meta" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareClass" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "authorisedShares" DECIMAL(24,6) NOT NULL DEFAULT 0,
    "issuedShares" DECIMAL(24,6) NOT NULL DEFAULT 0,
    "allocatedShares" DECIMAL(24,6) NOT NULL DEFAULT 0,
    "unallocatedShares" DECIMAL(24,6) NOT NULL DEFAULT 0,
    "votingRights" VARCHAR(120) NOT NULL DEFAULT 'standard',
    "votesPerShare" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "dividendRights" TEXT,
    "liquidationPreference" TEXT,
    "transferRestrictions" TEXT,
    "conversionRights" TEXT,
    "antiDilutionRights" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "termsMeta" JSONB,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shareholder" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "shareholderType" VARCHAR(80) NOT NULL DEFAULT 'individual',
    "displayName" TEXT NOT NULL,
    "legalName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "country" VARCHAR(2),
    "taxIdentifierMasked" TEXT,
    "investorStatus" VARCHAR(80) NOT NULL DEFAULT 'active',
    "kycStatus" VARCHAR(80) NOT NULL DEFAULT 'unverified',
    "communicationOptIn" BOOLEAN NOT NULL DEFAULT true,
    "portalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "profileMeta" JSONB,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shareholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentRound" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roundType" VARCHAR(80) NOT NULL DEFAULT 'seed',
    "status" VARCHAR(80) NOT NULL DEFAULT 'draft',
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "targetRaiseCents" INTEGER NOT NULL DEFAULT 0,
    "committedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "receivedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "preMoneyValuationCents" INTEGER NOT NULL DEFAULT 0,
    "postMoneyValuationCents" INTEGER NOT NULL DEFAULT 0,
    "instrumentType" VARCHAR(80) NOT NULL DEFAULT 'equity',
    "shareClassId" TEXT,
    "pricePerShareCents" INTEGER NOT NULL DEFAULT 0,
    "termsMeta" JSONB,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalContribution" (
    "id" TEXT NOT NULL,
    "shareholderId" TEXT,
    "investorName" TEXT,
    "investmentRoundId" TEXT,
    "contributionType" VARCHAR(100) NOT NULL DEFAULT 'investment',
    "status" VARCHAR(80) NOT NULL DEFAULT 'pending',
    "amountCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "receivedAt" TIMESTAMP(3),
    "paymentMethod" VARCHAR(80),
    "externalReference" TEXT,
    "revenueLedgerEntryId" TEXT,
    "sharesIssued" DECIMAL(24,6),
    "shareClassId" TEXT,
    "pricePerShareCents" INTEGER,
    "description" TEXT,
    "documentUrl" TEXT,
    "meta" JSONB,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapitalContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shareholding" (
    "id" TEXT NOT NULL,
    "shareholderId" TEXT NOT NULL,
    "shareClassId" TEXT NOT NULL,
    "sharesHeld" DECIMAL(24,6) NOT NULL DEFAULT 0,
    "allocatedShares" DECIMAL(24,6) NOT NULL DEFAULT 0,
    "vestedShares" DECIMAL(24,6) NOT NULL DEFAULT 0,
    "unvestedShares" DECIMAL(24,6) NOT NULL DEFAULT 0,
    "ownershipPercent" DECIMAL(10,6),
    "fullyDilutedPercent" DECIMAL(10,6),
    "votingPercent" DECIMAL(10,6),
    "status" VARCHAR(80) NOT NULL DEFAULT 'active',
    "asOfDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shareholding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareIssuance" (
    "id" TEXT NOT NULL,
    "shareholderId" TEXT NOT NULL,
    "shareClassId" TEXT NOT NULL,
    "investmentRoundId" TEXT,
    "capitalContributionId" TEXT,
    "sharesIssued" DECIMAL(24,6) NOT NULL,
    "pricePerShareCents" INTEGER NOT NULL DEFAULT 0,
    "totalConsiderationCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "issuanceType" VARCHAR(100) NOT NULL DEFAULT 'subscription',
    "status" VARCHAR(80) NOT NULL DEFAULT 'draft',
    "issuedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "documentUrl" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareIssuance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareTransfer" (
    "id" TEXT NOT NULL,
    "fromShareholderId" TEXT,
    "toShareholderId" TEXT NOT NULL,
    "shareClassId" TEXT NOT NULL,
    "sharesTransferred" DECIMAL(24,6) NOT NULL,
    "considerationCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "transferType" VARCHAR(100) NOT NULL DEFAULT 'secondary_sale',
    "status" VARCHAR(80) NOT NULL DEFAULT 'draft',
    "transferRestrictionCleared" BOOLEAN NOT NULL DEFAULT false,
    "effectiveAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "documentUrl" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareOptionGrant" (
    "id" TEXT NOT NULL,
    "shareholderId" TEXT,
    "staffUserId" TEXT,
    "shareClassId" TEXT NOT NULL,
    "grantType" VARCHAR(80) NOT NULL DEFAULT 'option',
    "status" VARCHAR(80) NOT NULL DEFAULT 'draft',
    "grantedShares" DECIMAL(24,6) NOT NULL,
    "vestedShares" DECIMAL(24,6) NOT NULL DEFAULT 0,
    "exercisedShares" DECIMAL(24,6) NOT NULL DEFAULT 0,
    "exercisePriceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "grantDate" TIMESTAMP(3),
    "vestingStartDate" TIMESTAMP(3),
    "vestingCliffDate" TIMESTAMP(3),
    "vestingEndDate" TIMESTAMP(3),
    "vestingMeta" JSONB,
    "documentUrl" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareOptionGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapTableSnapshot" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(80) NOT NULL DEFAULT 'draft',
    "totalAuthorisedShares" DECIMAL(24,6) NOT NULL DEFAULT 0,
    "totalIssuedShares" DECIMAL(24,6) NOT NULL DEFAULT 0,
    "totalAllocatedShares" DECIMAL(24,6) NOT NULL DEFAULT 0,
    "totalUnallocatedShares" DECIMAL(24,6) NOT NULL DEFAULT 0,
    "fullyDilutedShares" DECIMAL(24,6) NOT NULL DEFAULT 0,
    "ordinarySharePercent" DECIMAL(10,6),
    "preferenceSharePercent" DECIMAL(10,6),
    "optionPoolPercent" DECIMAL(10,6),
    "snapshotMeta" JSONB,
    "publishedToShareholders" BOOLEAN NOT NULL DEFAULT false,
    "generatedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapTableSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyValuationSnapshot" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valuationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valuationType" VARCHAR(80) NOT NULL DEFAULT 'internal',
    "status" VARCHAR(80) NOT NULL DEFAULT 'draft',
    "preMoneyValuationCents" INTEGER NOT NULL DEFAULT 0,
    "postMoneyValuationCents" INTEGER NOT NULL DEFAULT 0,
    "enterpriseValueCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "methodology" TEXT,
    "notes" TEXT,
    "valuationMeta" JSONB,
    "publishedToShareholders" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyValuationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareholderAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "announcementType" VARCHAR(100) NOT NULL DEFAULT 'general',
    "status" VARCHAR(80) NOT NULL DEFAULT 'draft',
    "visibleToShareholders" BOOLEAN NOT NULL DEFAULT false,
    "visibleFrom" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareholderAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareholderDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentType" VARCHAR(100) NOT NULL,
    "objectKey" TEXT,
    "fileUrl" TEXT,
    "status" VARCHAR(80) NOT NULL DEFAULT 'draft',
    "shareholderId" TEXT,
    "investmentRoundId" TEXT,
    "annualReturnId" TEXT,
    "boardResolutionId" TEXT,
    "visibleToShareholders" BOOLEAN NOT NULL DEFAULT false,
    "downloadable" BOOLEAN NOT NULL DEFAULT true,
    "documentMeta" JSONB,
    "uploadedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareholderDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnualReturn" (
    "id" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "status" VARCHAR(80) NOT NULL DEFAULT 'draft',
    "preparedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "filedAt" TIMESTAMP(3),
    "reportSnapshotId" TEXT,
    "documentUrl" TEXT,
    "annualReturnMeta" JSONB,
    "visibleToShareholders" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnualReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardResolution" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "resolutionType" VARCHAR(100) NOT NULL DEFAULT 'board',
    "status" VARCHAR(80) NOT NULL DEFAULT 'draft',
    "resolutionDate" TIMESTAMP(3),
    "effectiveDate" TIMESTAMP(3),
    "summary" TEXT,
    "documentUrl" TEXT,
    "visibleToShareholders" BOOLEAN NOT NULL DEFAULT false,
    "passedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AGMNotice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(80) NOT NULL DEFAULT 'draft',
    "venue" TEXT,
    "virtualJoinUrl" TEXT,
    "agenda" TEXT,
    "documentUrl" TEXT,
    "visibleToShareholders" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AGMNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareSaleNotice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shareClassId" TEXT,
    "sellerShareholderId" TEXT,
    "sharesAvailable" DECIMAL(24,6),
    "askingPricePerShareCents" INTEGER,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "status" VARCHAR(80) NOT NULL DEFAULT 'draft',
    "saleTerms" TEXT,
    "restrictionNotes" TEXT,
    "visibleToShareholders" BOOLEAN NOT NULL DEFAULT false,
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareSaleNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareholderAccessGrant" (
    "id" TEXT NOT NULL,
    "shareholderId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "accessStatus" VARCHAR(80) NOT NULL DEFAULT 'pending',
    "accessScope" VARCHAR(120) NOT NULL DEFAULT 'shareholder_read_only',
    "canViewCapTable" BOOLEAN NOT NULL DEFAULT true,
    "canViewValuations" BOOLEAN NOT NULL DEFAULT true,
    "canViewAnnualReturns" BOOLEAN NOT NULL DEFAULT true,
    "canViewAnnouncements" BOOLEAN NOT NULL DEFAULT true,
    "canDownloadDocuments" BOOLEAN NOT NULL DEFAULT true,
    "grantedByUserId" TEXT,
    "grantedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareholderAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsVendor" (
    "id" TEXT NOT NULL,
    "vendorType" VARCHAR(100) NOT NULL DEFAULT 'supplier',
    "status" VARCHAR(80) NOT NULL DEFAULT 'pending',
    "legalName" TEXT NOT NULL,
    "registeredName" TEXT,
    "tradingName" TEXT,
    "tradingNameSameAsRegistered" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "industry" VARCHAR(160),
    "products" JSONB,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" VARCHAR(160),
    "province" VARCHAR(160),
    "postalCode" VARCHAR(40),
    "country" VARCHAR(2),
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "contactPerson1Name" TEXT,
    "contactPerson1Role" TEXT,
    "contactPerson1Email" TEXT,
    "contactPerson1Phone" TEXT,
    "contactPerson2Name" TEXT,
    "contactPerson2Role" TEXT,
    "contactPerson2Email" TEXT,
    "contactPerson2Phone" TEXT,
    "manufacturer" BOOLEAN NOT NULL DEFAULT false,
    "supplier" BOOLEAN NOT NULL DEFAULT true,
    "payoutEligible" BOOLEAN NOT NULL DEFAULT false,
    "preferredPayoutMethod" VARCHAR(80),
    "bankAccountMasked" TEXT,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumberMasked" TEXT,
    "bankBranchCode" TEXT,
    "bankSwiftCode" TEXT,
    "paypalEmail" TEXT,
    "taxIdentifierMasked" TEXT,
    "vatRegistered" BOOLEAN NOT NULL DEFAULT false,
    "vatNumber" TEXT,
    "registrationSource" VARCHAR(120) NOT NULL DEFAULT 'public_vendor_registration',
    "documents" JSONB,
    "vendorMeta" JSONB,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsVendorInvoice" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "vendorName" TEXT,
    "invoiceNumber" TEXT,
    "invoiceStatus" VARCHAR(80) NOT NULL DEFAULT 'draft',
    "invoiceDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "amountPaidCents" INTEGER NOT NULL DEFAULT 0,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "invoiceUrl" TEXT,
    "invoiceObjectKey" TEXT,
    "invoiceUploadedAt" TIMESTAMP(3),
    "invoiceVerifiedAt" TIMESTAMP(3),
    "invoiceVerifiedByUserId" TEXT,
    "proofOfPaymentUrl" TEXT,
    "proofOfPaymentObjectKey" TEXT,
    "proofOfPaymentUploadedAt" TIMESTAMP(3),
    "proofOfPaymentVerifiedAt" TIMESTAMP(3),
    "proofOfPaymentVerifiedByUserId" TEXT,
    "paymentMethod" VARCHAR(80),
    "paymentReference" TEXT,
    "paymentDate" TIMESTAMP(3),
    "registeredVendorRequired" BOOLEAN NOT NULL DEFAULT true,
    "invoiceRequired" BOOLEAN NOT NULL DEFAULT true,
    "proofOfPaymentRequired" BOOLEAN NOT NULL DEFAULT false,
    "paymentInitiationMode" VARCHAR(80),
    "expenditureLedgerEntryId" TEXT,
    "importOrderId" TEXT,
    "vendorPayoutId" TEXT,
    "invoiceMeta" JSONB,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsVendorInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsExpenditureLedgerEntry" (
    "id" TEXT NOT NULL,
    "expenditureType" VARCHAR(120) NOT NULL DEFAULT 'operating_expense',
    "category" VARCHAR(120) NOT NULL DEFAULT 'general',
    "subcategory" VARCHAR(120),
    "status" VARCHAR(80) NOT NULL DEFAULT 'pending',
    "module" VARCHAR(80),
    "sourceType" VARCHAR(120),
    "sourceId" TEXT,
    "externalReference" TEXT,
    "vendorId" TEXT,
    "vendorName" TEXT,
    "vendorInvoiceId" TEXT,
    "importOrderId" TEXT,
    "inventoryItemId" TEXT,
    "vendorPayoutId" TEXT,
    "narration" TEXT,
    "description" TEXT,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "amountUsdCents" INTEGER NOT NULL DEFAULT 0,
    "zarEquivalentCents" INTEGER NOT NULL DEFAULT 0,
    "fxRate" DOUBLE PRECISION,
    "paymentMethod" VARCHAR(80),
    "paymentProvider" VARCHAR(80),
    "paymentReference" TEXT,
    "companyBankAccountReference" TEXT,
    "paymentStatus" VARCHAR(80) NOT NULL DEFAULT 'unpaid',
    "paidAt" TIMESTAMP(3),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceUrl" TEXT,
    "invoiceObjectKey" TEXT,
    "proofOfPaymentUrl" TEXT,
    "proofOfPaymentObjectKey" TEXT,
    "proofOfPaymentUploadedAt" TIMESTAMP(3),
    "proofOfPaymentVerifiedAt" TIMESTAMP(3),
    "proofOfPaymentVerifiedByUserId" TEXT,
    "manualEntry" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "voidedByUserId" TEXT,
    "voidedAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsExpenditureLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsInventoryCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentCategoryId" TEXT,
    "imageUrl" TEXT,
    "imageObjectKey" TEXT,
    "patientVisible" BOOLEAN NOT NULL DEFAULT false,
    "clinicianVisible" BOOLEAN NOT NULL DEFAULT false,
    "medreachVisible" BOOLEAN NOT NULL DEFAULT false,
    "careportVisible" BOOLEAN NOT NULL DEFAULT false,
    "adminVisible" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsInventoryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsInventoryItem" (
    "id" TEXT NOT NULL,
    "sku" TEXT,
    "itemCode" TEXT,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "itemType" VARCHAR(100) NOT NULL DEFAULT 'item',
    "manufacturer" TEXT,
    "manufacturerContact" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "barcode" TEXT,
    "images" JSONB,
    "primaryImageUrl" TEXT,
    "primaryImageObjectKey" TEXT,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "unitCostCents" INTEGER NOT NULL DEFAULT 0,
    "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
    "lastLandingCostCents" INTEGER NOT NULL DEFAULT 0,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "availableQuantity" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 0,
    "patientVisible" BOOLEAN NOT NULL DEFAULT false,
    "clinicianVisible" BOOLEAN NOT NULL DEFAULT false,
    "medreachVisible" BOOLEAN NOT NULL DEFAULT false,
    "careportVisible" BOOLEAN NOT NULL DEFAULT false,
    "adminVisible" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "shopProductId" TEXT,
    "shopVariantId" TEXT,
    "carePortSkuId" TEXT,
    "deviceCatalogSlug" TEXT,
    "meta" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsImportOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT,
    "status" VARCHAR(80) NOT NULL DEFAULT 'draft',
    "vendorId" TEXT,
    "vendorName" TEXT,
    "inventoryItemId" TEXT,
    "inventoryCategoryId" TEXT,
    "itemName" TEXT NOT NULL,
    "itemDescription" TEXT,
    "itemType" VARCHAR(100) NOT NULL DEFAULT 'item',
    "manufacturer" TEXT,
    "manufacturerContact" TEXT,
    "quantityOrdered" INTEGER NOT NULL DEFAULT 0,
    "quantityReceived" INTEGER NOT NULL DEFAULT 0,
    "quantityAccepted" INTEGER NOT NULL DEFAULT 0,
    "quantityRejected" INTEGER NOT NULL DEFAULT 0,
    "totalCostUsdCents" INTEGER NOT NULL DEFAULT 0,
    "zarEquivalentCents" INTEGER NOT NULL DEFAULT 0,
    "fxRate" DOUBLE PRECISION,
    "invoiceUrl" TEXT,
    "invoiceObjectKey" TEXT,
    "paymentMethod" VARCHAR(80),
    "paymentReference" TEXT,
    "proofOfPaymentUrl" TEXT,
    "proofOfPaymentObjectKey" TEXT,
    "orderDate" TIMESTAMP(3),
    "paymentDate" TIMESTAMP(3),
    "expectedDeliveryDate" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "inspectedAt" TIMESTAMP(3),
    "receivedByUserId" TEXT,
    "inspectedByUserId" TEXT,
    "qualityStatus" VARCHAR(80),
    "inspectionNotes" TEXT,
    "discrepancyNotes" TEXT,
    "importDutyCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "vatCents" INTEGER NOT NULL DEFAULT 0,
    "mspCents" INTEGER NOT NULL DEFAULT 0,
    "shippingCents" INTEGER NOT NULL DEFAULT 0,
    "clearingCents" INTEGER NOT NULL DEFAULT 0,
    "handlingCents" INTEGER NOT NULL DEFAULT 0,
    "otherLandingCostCents" INTEGER NOT NULL DEFAULT 0,
    "totalLandingCostCents" INTEGER NOT NULL DEFAULT 0,
    "landingCostPerUnitCents" INTEGER NOT NULL DEFAULT 0,
    "expenditureLedgerEntryId" TEXT,
    "vendorInvoiceId" TEXT,
    "stockMovementId" TEXT,
    "stockPostedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsImportOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsInventoryMovement" (
    "id" TEXT NOT NULL,
    "movementType" VARCHAR(100) NOT NULL DEFAULT 'adjustment',
    "status" VARCHAR(80) NOT NULL DEFAULT 'posted',
    "inventoryItemId" TEXT NOT NULL,
    "sourceType" VARCHAR(120),
    "sourceId" TEXT,
    "importOrderId" TEXT,
    "shopOrderId" TEXT,
    "shopOrderItemId" TEXT,
    "quantityDelta" INTEGER NOT NULL DEFAULT 0,
    "quantityBefore" INTEGER NOT NULL DEFAULT 0,
    "quantityAfter" INTEGER NOT NULL DEFAULT 0,
    "unitCostCents" INTEGER NOT NULL DEFAULT 0,
    "totalCostCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "narration" TEXT,
    "reference" TEXT,
    "performedByUserId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsInventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsVendorPayout" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "vendorName" TEXT,
    "vendorInvoiceId" TEXT,
    "expenditureLedgerEntryId" TEXT,
    "status" VARCHAR(80) NOT NULL DEFAULT 'pending',
    "payoutMethod" VARCHAR(80),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "paymentReference" TEXT,
    "paymentProvider" TEXT,
    "paystackRecipientCode" TEXT,
    "paystackTransferCode" TEXT,
    "proofOfPaymentUrl" TEXT,
    "proofOfPaymentObjectKey" TEXT,
    "invoiceRequired" BOOLEAN NOT NULL DEFAULT true,
    "registeredVendorRequired" BOOLEAN NOT NULL DEFAULT true,
    "initiatedViaPaystack" BOOLEAN NOT NULL DEFAULT false,
    "scheduledAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsVendorPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffPayrollProfile_staffUserId_idx" ON "StaffPayrollProfile"("staffUserId");

-- CreateIndex
CREATE INDEX "StaffPayrollProfile_staffEmail_idx" ON "StaffPayrollProfile"("staffEmail");

-- CreateIndex
CREATE INDEX "StaffPayrollProfile_employmentType_idx" ON "StaffPayrollProfile"("employmentType");

-- CreateIndex
CREATE INDEX "StaffPayrollProfile_payrollStatus_idx" ON "StaffPayrollProfile"("payrollStatus");

-- CreateIndex
CREATE INDEX "StaffPayrollProfile_approvalStatus_idx" ON "StaffPayrollProfile"("approvalStatus");

-- CreateIndex
CREATE INDEX "StaffPayrollProfile_departmentId_designationId_idx" ON "StaffPayrollProfile"("departmentId", "designationId");

-- CreateIndex
CREATE INDEX "StaffBankAccount_staffUserId_idx" ON "StaffBankAccount"("staffUserId");

-- CreateIndex
CREATE INDEX "StaffBankAccount_payrollProfileId_idx" ON "StaffBankAccount"("payrollProfileId");

-- CreateIndex
CREATE INDEX "StaffBankAccount_verificationStatus_idx" ON "StaffBankAccount"("verificationStatus");

-- CreateIndex
CREATE INDEX "StaffBankAccount_active_idx" ON "StaffBankAccount"("active");

-- CreateIndex
CREATE INDEX "PayrollPeriod_startsAt_endsAt_idx" ON "PayrollPeriod"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "PayrollPeriod_status_idx" ON "PayrollPeriod"("status");

-- CreateIndex
CREATE INDEX "PayrollPeriod_country_currency_idx" ON "PayrollPeriod"("country", "currency");

-- CreateIndex
CREATE INDEX "PayrollRun_payrollPeriodId_idx" ON "PayrollRun"("payrollPeriodId");

-- CreateIndex
CREATE INDEX "PayrollRun_status_idx" ON "PayrollRun"("status");

-- CreateIndex
CREATE INDEX "PayrollRun_generatedAt_idx" ON "PayrollRun"("generatedAt");

-- CreateIndex
CREATE INDEX "PayrollRun_approvedAt_idx" ON "PayrollRun"("approvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_payslipNumber_key" ON "Payslip"("payslipNumber");

-- CreateIndex
CREATE INDEX "Payslip_staffUserId_idx" ON "Payslip"("staffUserId");

-- CreateIndex
CREATE INDEX "Payslip_payrollPeriodId_idx" ON "Payslip"("payrollPeriodId");

-- CreateIndex
CREATE INDEX "Payslip_payrollRunId_idx" ON "Payslip"("payrollRunId");

-- CreateIndex
CREATE INDEX "Payslip_status_idx" ON "Payslip"("status");

-- CreateIndex
CREATE INDEX "Payslip_issuedAt_idx" ON "Payslip"("issuedAt");

-- CreateIndex
CREATE INDEX "PayslipLineItem_payslipId_idx" ON "PayslipLineItem"("payslipId");

-- CreateIndex
CREATE INDEX "PayslipLineItem_staffUserId_idx" ON "PayslipLineItem"("staffUserId");

-- CreateIndex
CREATE INDEX "PayslipLineItem_lineType_idx" ON "PayslipLineItem"("lineType");

-- CreateIndex
CREATE INDEX "PayslipLineItem_sourceType_sourceId_idx" ON "PayslipLineItem"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "StaffSalaryAccrual_staffUserId_idx" ON "StaffSalaryAccrual"("staffUserId");

-- CreateIndex
CREATE INDEX "StaffSalaryAccrual_payrollPeriodId_idx" ON "StaffSalaryAccrual"("payrollPeriodId");

-- CreateIndex
CREATE INDEX "StaffSalaryAccrual_payslipId_idx" ON "StaffSalaryAccrual"("payslipId");

-- CreateIndex
CREATE INDEX "StaffSalaryAccrual_status_idx" ON "StaffSalaryAccrual"("status");

-- CreateIndex
CREATE INDEX "StaffSalaryAccrual_earnedFrom_earnedTo_idx" ON "StaffSalaryAccrual"("earnedFrom", "earnedTo");

-- CreateIndex
CREATE INDEX "StaffArrearsLedger_staffUserId_idx" ON "StaffArrearsLedger"("staffUserId");

-- CreateIndex
CREATE INDEX "StaffArrearsLedger_status_idx" ON "StaffArrearsLedger"("status");

-- CreateIndex
CREATE INDEX "StaffArrearsLedger_entryType_idx" ON "StaffArrearsLedger"("entryType");

-- CreateIndex
CREATE INDEX "StaffArrearsLedger_payrollPeriodId_idx" ON "StaffArrearsLedger"("payrollPeriodId");

-- CreateIndex
CREATE INDEX "StaffArrearsLedger_effectiveAt_idx" ON "StaffArrearsLedger"("effectiveAt");

-- CreateIndex
CREATE INDEX "StaffArrearsLedger_dueDate_idx" ON "StaffArrearsLedger"("dueDate");

-- CreateIndex
CREATE INDEX "PayrollPaymentBatch_status_idx" ON "PayrollPaymentBatch"("status");

-- CreateIndex
CREATE INDEX "PayrollPaymentBatch_batchType_idx" ON "PayrollPaymentBatch"("batchType");

-- CreateIndex
CREATE INDEX "PayrollPaymentBatch_paymentMethod_idx" ON "PayrollPaymentBatch"("paymentMethod");

-- CreateIndex
CREATE INDEX "PayrollPaymentBatch_createdAt_idx" ON "PayrollPaymentBatch"("createdAt");

-- CreateIndex
CREATE INDEX "PayrollPaymentAllocation_paymentBatchId_idx" ON "PayrollPaymentAllocation"("paymentBatchId");

-- CreateIndex
CREATE INDEX "PayrollPaymentAllocation_staffUserId_idx" ON "PayrollPaymentAllocation"("staffUserId");

-- CreateIndex
CREATE INDEX "PayrollPaymentAllocation_status_idx" ON "PayrollPaymentAllocation"("status");

-- CreateIndex
CREATE INDEX "PayrollPaymentAllocation_payslipId_idx" ON "PayrollPaymentAllocation"("payslipId");

-- CreateIndex
CREATE INDEX "PayrollPaymentAllocation_arrearsLedgerEntryId_idx" ON "PayrollPaymentAllocation"("arrearsLedgerEntryId");

-- CreateIndex
CREATE INDEX "PayrollPaymentAllocation_paystackReference_idx" ON "PayrollPaymentAllocation"("paystackReference");

-- CreateIndex
CREATE INDEX "StaffPayrollDispute_staffUserId_idx" ON "StaffPayrollDispute"("staffUserId");

-- CreateIndex
CREATE INDEX "StaffPayrollDispute_status_idx" ON "StaffPayrollDispute"("status");

-- CreateIndex
CREATE INDEX "StaffPayrollDispute_payslipId_idx" ON "StaffPayrollDispute"("payslipId");

-- CreateIndex
CREATE INDEX "StaffPayrollDispute_arrearsLedgerEntryId_idx" ON "StaffPayrollDispute"("arrearsLedgerEntryId");

-- CreateIndex
CREATE INDEX "CommissionPolicy_sourceType_idx" ON "CommissionPolicy"("sourceType");

-- CreateIndex
CREATE INDEX "CommissionPolicy_active_idx" ON "CommissionPolicy"("active");

-- CreateIndex
CREATE INDEX "CommissionPolicy_appliesToRole_idx" ON "CommissionPolicy"("appliesToRole");

-- CreateIndex
CREATE INDEX "CommissionEvent_staffUserId_idx" ON "CommissionEvent"("staffUserId");

-- CreateIndex
CREATE INDEX "CommissionEvent_sourceType_idx" ON "CommissionEvent"("sourceType");

-- CreateIndex
CREATE INDEX "CommissionEvent_eventStatus_idx" ON "CommissionEvent"("eventStatus");

-- CreateIndex
CREATE INDEX "CommissionEvent_occurredAt_idx" ON "CommissionEvent"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionEvent_sourceType_sourceId_staffUserId_key" ON "CommissionEvent"("sourceType", "sourceId", "staffUserId");

-- CreateIndex
CREATE INDEX "CommissionAward_staffUserId_idx" ON "CommissionAward"("staffUserId");

-- CreateIndex
CREATE INDEX "CommissionAward_commissionEventId_idx" ON "CommissionAward"("commissionEventId");

-- CreateIndex
CREATE INDEX "CommissionAward_status_idx" ON "CommissionAward"("status");

-- CreateIndex
CREATE INDEX "CommissionAward_payrollPeriodId_idx" ON "CommissionAward"("payrollPeriodId");

-- CreateIndex
CREATE INDEX "CommissionAward_payslipId_idx" ON "CommissionAward"("payslipId");

-- CreateIndex
CREATE INDEX "RevenueLedgerEntry_entryType_idx" ON "RevenueLedgerEntry"("entryType");

-- CreateIndex
CREATE INDEX "RevenueLedgerEntry_inflowCategory_idx" ON "RevenueLedgerEntry"("inflowCategory");

-- CreateIndex
CREATE INDEX "RevenueLedgerEntry_module_idx" ON "RevenueLedgerEntry"("module");

-- CreateIndex
CREATE INDEX "RevenueLedgerEntry_sourceType_sourceId_idx" ON "RevenueLedgerEntry"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "RevenueLedgerEntry_externalReference_idx" ON "RevenueLedgerEntry"("externalReference");

-- CreateIndex
CREATE INDEX "RevenueLedgerEntry_recognitionStatus_idx" ON "RevenueLedgerEntry"("recognitionStatus");

-- CreateIndex
CREATE INDEX "RevenueLedgerEntry_paymentStatus_idx" ON "RevenueLedgerEntry"("paymentStatus");

-- CreateIndex
CREATE INDEX "RevenueLedgerEntry_occurredAt_idx" ON "RevenueLedgerEntry"("occurredAt");

-- CreateIndex
CREATE INDEX "FinanceReportSnapshot_reportType_idx" ON "FinanceReportSnapshot"("reportType");

-- CreateIndex
CREATE INDEX "FinanceReportSnapshot_periodStart_periodEnd_idx" ON "FinanceReportSnapshot"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "FinanceReportSnapshot_generatedAt_idx" ON "FinanceReportSnapshot"("generatedAt");

-- CreateIndex
CREATE INDEX "PayrollAuditEvent_eventType_idx" ON "PayrollAuditEvent"("eventType");

-- CreateIndex
CREATE INDEX "PayrollAuditEvent_actorUserId_idx" ON "PayrollAuditEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "PayrollAuditEvent_subjectType_subjectId_idx" ON "PayrollAuditEvent"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "PayrollAuditEvent_staffUserId_idx" ON "PayrollAuditEvent"("staffUserId");

-- CreateIndex
CREATE INDEX "PayrollAuditEvent_occurredAt_idx" ON "PayrollAuditEvent"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShareClass_code_key" ON "ShareClass"("code");

-- CreateIndex
CREATE INDEX "ShareClass_active_idx" ON "ShareClass"("active");

-- CreateIndex
CREATE INDEX "Shareholder_userId_idx" ON "Shareholder"("userId");

-- CreateIndex
CREATE INDEX "Shareholder_email_idx" ON "Shareholder"("email");

-- CreateIndex
CREATE INDEX "Shareholder_shareholderType_idx" ON "Shareholder"("shareholderType");

-- CreateIndex
CREATE INDEX "Shareholder_investorStatus_idx" ON "Shareholder"("investorStatus");

-- CreateIndex
CREATE INDEX "Shareholder_kycStatus_idx" ON "Shareholder"("kycStatus");

-- CreateIndex
CREATE INDEX "InvestmentRound_roundType_idx" ON "InvestmentRound"("roundType");

-- CreateIndex
CREATE INDEX "InvestmentRound_status_idx" ON "InvestmentRound"("status");

-- CreateIndex
CREATE INDEX "InvestmentRound_openedAt_closedAt_idx" ON "InvestmentRound"("openedAt", "closedAt");

-- CreateIndex
CREATE INDEX "InvestmentRound_shareClassId_idx" ON "InvestmentRound"("shareClassId");

-- CreateIndex
CREATE INDEX "CapitalContribution_shareholderId_idx" ON "CapitalContribution"("shareholderId");

-- CreateIndex
CREATE INDEX "CapitalContribution_investmentRoundId_idx" ON "CapitalContribution"("investmentRoundId");

-- CreateIndex
CREATE INDEX "CapitalContribution_contributionType_idx" ON "CapitalContribution"("contributionType");

-- CreateIndex
CREATE INDEX "CapitalContribution_status_idx" ON "CapitalContribution"("status");

-- CreateIndex
CREATE INDEX "CapitalContribution_receivedAt_idx" ON "CapitalContribution"("receivedAt");

-- CreateIndex
CREATE INDEX "CapitalContribution_externalReference_idx" ON "CapitalContribution"("externalReference");

-- CreateIndex
CREATE INDEX "Shareholding_shareholderId_idx" ON "Shareholding"("shareholderId");

-- CreateIndex
CREATE INDEX "Shareholding_shareClassId_idx" ON "Shareholding"("shareClassId");

-- CreateIndex
CREATE INDEX "Shareholding_status_idx" ON "Shareholding"("status");

-- CreateIndex
CREATE INDEX "Shareholding_asOfDate_idx" ON "Shareholding"("asOfDate");

-- CreateIndex
CREATE INDEX "ShareIssuance_shareholderId_idx" ON "ShareIssuance"("shareholderId");

-- CreateIndex
CREATE INDEX "ShareIssuance_shareClassId_idx" ON "ShareIssuance"("shareClassId");

-- CreateIndex
CREATE INDEX "ShareIssuance_investmentRoundId_idx" ON "ShareIssuance"("investmentRoundId");

-- CreateIndex
CREATE INDEX "ShareIssuance_status_idx" ON "ShareIssuance"("status");

-- CreateIndex
CREATE INDEX "ShareIssuance_issuedAt_idx" ON "ShareIssuance"("issuedAt");

-- CreateIndex
CREATE INDEX "ShareTransfer_fromShareholderId_idx" ON "ShareTransfer"("fromShareholderId");

-- CreateIndex
CREATE INDEX "ShareTransfer_toShareholderId_idx" ON "ShareTransfer"("toShareholderId");

-- CreateIndex
CREATE INDEX "ShareTransfer_shareClassId_idx" ON "ShareTransfer"("shareClassId");

-- CreateIndex
CREATE INDEX "ShareTransfer_status_idx" ON "ShareTransfer"("status");

-- CreateIndex
CREATE INDEX "ShareTransfer_effectiveAt_idx" ON "ShareTransfer"("effectiveAt");

-- CreateIndex
CREATE INDEX "ShareOptionGrant_shareholderId_idx" ON "ShareOptionGrant"("shareholderId");

-- CreateIndex
CREATE INDEX "ShareOptionGrant_staffUserId_idx" ON "ShareOptionGrant"("staffUserId");

-- CreateIndex
CREATE INDEX "ShareOptionGrant_shareClassId_idx" ON "ShareOptionGrant"("shareClassId");

-- CreateIndex
CREATE INDEX "ShareOptionGrant_status_idx" ON "ShareOptionGrant"("status");

-- CreateIndex
CREATE INDEX "CapTableSnapshot_snapshotDate_idx" ON "CapTableSnapshot"("snapshotDate");

-- CreateIndex
CREATE INDEX "CapTableSnapshot_status_idx" ON "CapTableSnapshot"("status");

-- CreateIndex
CREATE INDEX "CapTableSnapshot_publishedToShareholders_idx" ON "CapTableSnapshot"("publishedToShareholders");

-- CreateIndex
CREATE INDEX "CompanyValuationSnapshot_valuationDate_idx" ON "CompanyValuationSnapshot"("valuationDate");

-- CreateIndex
CREATE INDEX "CompanyValuationSnapshot_valuationType_idx" ON "CompanyValuationSnapshot"("valuationType");

-- CreateIndex
CREATE INDEX "CompanyValuationSnapshot_status_idx" ON "CompanyValuationSnapshot"("status");

-- CreateIndex
CREATE INDEX "CompanyValuationSnapshot_publishedToShareholders_idx" ON "CompanyValuationSnapshot"("publishedToShareholders");

-- CreateIndex
CREATE INDEX "ShareholderAnnouncement_announcementType_idx" ON "ShareholderAnnouncement"("announcementType");

-- CreateIndex
CREATE INDEX "ShareholderAnnouncement_status_idx" ON "ShareholderAnnouncement"("status");

-- CreateIndex
CREATE INDEX "ShareholderAnnouncement_visibleToShareholders_idx" ON "ShareholderAnnouncement"("visibleToShareholders");

-- CreateIndex
CREATE INDEX "ShareholderAnnouncement_publishedAt_idx" ON "ShareholderAnnouncement"("publishedAt");

-- CreateIndex
CREATE INDEX "ShareholderDocument_documentType_idx" ON "ShareholderDocument"("documentType");

-- CreateIndex
CREATE INDEX "ShareholderDocument_shareholderId_idx" ON "ShareholderDocument"("shareholderId");

-- CreateIndex
CREATE INDEX "ShareholderDocument_status_idx" ON "ShareholderDocument"("status");

-- CreateIndex
CREATE INDEX "ShareholderDocument_visibleToShareholders_idx" ON "ShareholderDocument"("visibleToShareholders");

-- CreateIndex
CREATE INDEX "AnnualReturn_financialYear_idx" ON "AnnualReturn"("financialYear");

-- CreateIndex
CREATE INDEX "AnnualReturn_status_idx" ON "AnnualReturn"("status");

-- CreateIndex
CREATE INDEX "AnnualReturn_visibleToShareholders_idx" ON "AnnualReturn"("visibleToShareholders");

-- CreateIndex
CREATE INDEX "BoardResolution_resolutionType_idx" ON "BoardResolution"("resolutionType");

-- CreateIndex
CREATE INDEX "BoardResolution_status_idx" ON "BoardResolution"("status");

-- CreateIndex
CREATE INDEX "BoardResolution_resolutionDate_idx" ON "BoardResolution"("resolutionDate");

-- CreateIndex
CREATE INDEX "BoardResolution_visibleToShareholders_idx" ON "BoardResolution"("visibleToShareholders");

-- CreateIndex
CREATE INDEX "AGMNotice_meetingDate_idx" ON "AGMNotice"("meetingDate");

-- CreateIndex
CREATE INDEX "AGMNotice_status_idx" ON "AGMNotice"("status");

-- CreateIndex
CREATE INDEX "AGMNotice_visibleToShareholders_idx" ON "AGMNotice"("visibleToShareholders");

-- CreateIndex
CREATE INDEX "ShareSaleNotice_shareClassId_idx" ON "ShareSaleNotice"("shareClassId");

-- CreateIndex
CREATE INDEX "ShareSaleNotice_sellerShareholderId_idx" ON "ShareSaleNotice"("sellerShareholderId");

-- CreateIndex
CREATE INDEX "ShareSaleNotice_status_idx" ON "ShareSaleNotice"("status");

-- CreateIndex
CREATE INDEX "ShareSaleNotice_visibleToShareholders_idx" ON "ShareSaleNotice"("visibleToShareholders");

-- CreateIndex
CREATE INDEX "ShareSaleNotice_opensAt_closesAt_idx" ON "ShareSaleNotice"("opensAt", "closesAt");

-- CreateIndex
CREATE INDEX "ShareholderAccessGrant_shareholderId_idx" ON "ShareholderAccessGrant"("shareholderId");

-- CreateIndex
CREATE INDEX "ShareholderAccessGrant_userId_idx" ON "ShareholderAccessGrant"("userId");

-- CreateIndex
CREATE INDEX "ShareholderAccessGrant_email_idx" ON "ShareholderAccessGrant"("email");

-- CreateIndex
CREATE INDEX "ShareholderAccessGrant_accessStatus_idx" ON "ShareholderAccessGrant"("accessStatus");

-- CreateIndex
CREATE INDEX "OpsVendor_vendorType_idx" ON "OpsVendor"("vendorType");

-- CreateIndex
CREATE INDEX "OpsVendor_status_idx" ON "OpsVendor"("status");

-- CreateIndex
CREATE INDEX "OpsVendor_email_idx" ON "OpsVendor"("email");

-- CreateIndex
CREATE INDEX "OpsVendor_country_idx" ON "OpsVendor"("country");

-- CreateIndex
CREATE INDEX "OpsVendor_industry_idx" ON "OpsVendor"("industry");

-- CreateIndex
CREATE INDEX "OpsVendor_vatRegistered_idx" ON "OpsVendor"("vatRegistered");

-- CreateIndex
CREATE INDEX "OpsVendor_manufacturer_idx" ON "OpsVendor"("manufacturer");

-- CreateIndex
CREATE INDEX "OpsVendor_supplier_idx" ON "OpsVendor"("supplier");

-- CreateIndex
CREATE INDEX "OpsVendor_payoutEligible_idx" ON "OpsVendor"("payoutEligible");

-- CreateIndex
CREATE INDEX "OpsVendor_registrationSource_idx" ON "OpsVendor"("registrationSource");

-- CreateIndex
CREATE INDEX "OpsVendorInvoice_vendorId_idx" ON "OpsVendorInvoice"("vendorId");

-- CreateIndex
CREATE INDEX "OpsVendorInvoice_invoiceStatus_idx" ON "OpsVendorInvoice"("invoiceStatus");

-- CreateIndex
CREATE INDEX "OpsVendorInvoice_invoiceNumber_idx" ON "OpsVendorInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "OpsVendorInvoice_paymentMethod_idx" ON "OpsVendorInvoice"("paymentMethod");

-- CreateIndex
CREATE INDEX "OpsVendorInvoice_paymentReference_idx" ON "OpsVendorInvoice"("paymentReference");

-- CreateIndex
CREATE INDEX "OpsVendorInvoice_paymentInitiationMode_idx" ON "OpsVendorInvoice"("paymentInitiationMode");

-- CreateIndex
CREATE INDEX "OpsVendorInvoice_expenditureLedgerEntryId_idx" ON "OpsVendorInvoice"("expenditureLedgerEntryId");

-- CreateIndex
CREATE INDEX "OpsVendorInvoice_importOrderId_idx" ON "OpsVendorInvoice"("importOrderId");

-- CreateIndex
CREATE INDEX "OpsVendorInvoice_vendorPayoutId_idx" ON "OpsVendorInvoice"("vendorPayoutId");

-- CreateIndex
CREATE INDEX "OpsVendorInvoice_createdAt_idx" ON "OpsVendorInvoice"("createdAt");

-- CreateIndex
CREATE INDEX "OpsExpenditureLedgerEntry_expenditureType_idx" ON "OpsExpenditureLedgerEntry"("expenditureType");

-- CreateIndex
CREATE INDEX "OpsExpenditureLedgerEntry_category_idx" ON "OpsExpenditureLedgerEntry"("category");

-- CreateIndex
CREATE INDEX "OpsExpenditureLedgerEntry_status_idx" ON "OpsExpenditureLedgerEntry"("status");

-- CreateIndex
CREATE INDEX "OpsExpenditureLedgerEntry_module_idx" ON "OpsExpenditureLedgerEntry"("module");

-- CreateIndex
CREATE INDEX "OpsExpenditureLedgerEntry_sourceType_sourceId_idx" ON "OpsExpenditureLedgerEntry"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "OpsExpenditureLedgerEntry_externalReference_idx" ON "OpsExpenditureLedgerEntry"("externalReference");

-- CreateIndex
CREATE INDEX "OpsExpenditureLedgerEntry_vendorId_idx" ON "OpsExpenditureLedgerEntry"("vendorId");

-- CreateIndex
CREATE INDEX "OpsExpenditureLedgerEntry_vendorInvoiceId_idx" ON "OpsExpenditureLedgerEntry"("vendorInvoiceId");

-- CreateIndex
CREATE INDEX "OpsExpenditureLedgerEntry_importOrderId_idx" ON "OpsExpenditureLedgerEntry"("importOrderId");

-- CreateIndex
CREATE INDEX "OpsExpenditureLedgerEntry_inventoryItemId_idx" ON "OpsExpenditureLedgerEntry"("inventoryItemId");

-- CreateIndex
CREATE INDEX "OpsExpenditureLedgerEntry_vendorPayoutId_idx" ON "OpsExpenditureLedgerEntry"("vendorPayoutId");

-- CreateIndex
CREATE INDEX "OpsExpenditureLedgerEntry_paymentMethod_idx" ON "OpsExpenditureLedgerEntry"("paymentMethod");

-- CreateIndex
CREATE INDEX "OpsExpenditureLedgerEntry_companyBankAccountReference_idx" ON "OpsExpenditureLedgerEntry"("companyBankAccountReference");

-- CreateIndex
CREATE INDEX "OpsExpenditureLedgerEntry_paymentStatus_idx" ON "OpsExpenditureLedgerEntry"("paymentStatus");

-- CreateIndex
CREATE INDEX "OpsExpenditureLedgerEntry_occurredAt_idx" ON "OpsExpenditureLedgerEntry"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "OpsInventoryCategory_code_key" ON "OpsInventoryCategory"("code");

-- CreateIndex
CREATE INDEX "OpsInventoryCategory_parentCategoryId_idx" ON "OpsInventoryCategory"("parentCategoryId");

-- CreateIndex
CREATE INDEX "OpsInventoryCategory_active_idx" ON "OpsInventoryCategory"("active");

-- CreateIndex
CREATE INDEX "OpsInventoryCategory_patientVisible_idx" ON "OpsInventoryCategory"("patientVisible");

-- CreateIndex
CREATE INDEX "OpsInventoryCategory_clinicianVisible_idx" ON "OpsInventoryCategory"("clinicianVisible");

-- CreateIndex
CREATE INDEX "OpsInventoryCategory_medreachVisible_idx" ON "OpsInventoryCategory"("medreachVisible");

-- CreateIndex
CREATE INDEX "OpsInventoryCategory_careportVisible_idx" ON "OpsInventoryCategory"("careportVisible");

-- CreateIndex
CREATE INDEX "OpsInventoryCategory_adminVisible_idx" ON "OpsInventoryCategory"("adminVisible");

-- CreateIndex
CREATE UNIQUE INDEX "OpsInventoryItem_sku_key" ON "OpsInventoryItem"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "OpsInventoryItem_itemCode_key" ON "OpsInventoryItem"("itemCode");

-- CreateIndex
CREATE INDEX "OpsInventoryItem_categoryId_idx" ON "OpsInventoryItem"("categoryId");

-- CreateIndex
CREATE INDEX "OpsInventoryItem_itemType_idx" ON "OpsInventoryItem"("itemType");

-- CreateIndex
CREATE INDEX "OpsInventoryItem_manufacturer_idx" ON "OpsInventoryItem"("manufacturer");

-- CreateIndex
CREATE INDEX "OpsInventoryItem_barcode_idx" ON "OpsInventoryItem"("barcode");

-- CreateIndex
CREATE INDEX "OpsInventoryItem_active_idx" ON "OpsInventoryItem"("active");

-- CreateIndex
CREATE INDEX "OpsInventoryItem_patientVisible_idx" ON "OpsInventoryItem"("patientVisible");

-- CreateIndex
CREATE INDEX "OpsInventoryItem_clinicianVisible_idx" ON "OpsInventoryItem"("clinicianVisible");

-- CreateIndex
CREATE INDEX "OpsInventoryItem_medreachVisible_idx" ON "OpsInventoryItem"("medreachVisible");

-- CreateIndex
CREATE INDEX "OpsInventoryItem_careportVisible_idx" ON "OpsInventoryItem"("careportVisible");

-- CreateIndex
CREATE INDEX "OpsInventoryItem_adminVisible_idx" ON "OpsInventoryItem"("adminVisible");

-- CreateIndex
CREATE INDEX "OpsInventoryItem_shopProductId_idx" ON "OpsInventoryItem"("shopProductId");

-- CreateIndex
CREATE INDEX "OpsInventoryItem_shopVariantId_idx" ON "OpsInventoryItem"("shopVariantId");

-- CreateIndex
CREATE INDEX "OpsInventoryItem_carePortSkuId_idx" ON "OpsInventoryItem"("carePortSkuId");

-- CreateIndex
CREATE INDEX "OpsInventoryItem_deviceCatalogSlug_idx" ON "OpsInventoryItem"("deviceCatalogSlug");

-- CreateIndex
CREATE UNIQUE INDEX "OpsImportOrder_orderNumber_key" ON "OpsImportOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "OpsImportOrder_status_idx" ON "OpsImportOrder"("status");

-- CreateIndex
CREATE INDEX "OpsImportOrder_vendorId_idx" ON "OpsImportOrder"("vendorId");

-- CreateIndex
CREATE INDEX "OpsImportOrder_inventoryItemId_idx" ON "OpsImportOrder"("inventoryItemId");

-- CreateIndex
CREATE INDEX "OpsImportOrder_inventoryCategoryId_idx" ON "OpsImportOrder"("inventoryCategoryId");

-- CreateIndex
CREATE INDEX "OpsImportOrder_itemType_idx" ON "OpsImportOrder"("itemType");

-- CreateIndex
CREATE INDEX "OpsImportOrder_manufacturer_idx" ON "OpsImportOrder"("manufacturer");

-- CreateIndex
CREATE INDEX "OpsImportOrder_paymentMethod_idx" ON "OpsImportOrder"("paymentMethod");

-- CreateIndex
CREATE INDEX "OpsImportOrder_paymentReference_idx" ON "OpsImportOrder"("paymentReference");

-- CreateIndex
CREATE INDEX "OpsImportOrder_orderDate_idx" ON "OpsImportOrder"("orderDate");

-- CreateIndex
CREATE INDEX "OpsImportOrder_paymentDate_idx" ON "OpsImportOrder"("paymentDate");

-- CreateIndex
CREATE INDEX "OpsImportOrder_expectedDeliveryDate_idx" ON "OpsImportOrder"("expectedDeliveryDate");

-- CreateIndex
CREATE INDEX "OpsImportOrder_expenditureLedgerEntryId_idx" ON "OpsImportOrder"("expenditureLedgerEntryId");

-- CreateIndex
CREATE INDEX "OpsImportOrder_vendorInvoiceId_idx" ON "OpsImportOrder"("vendorInvoiceId");

-- CreateIndex
CREATE INDEX "OpsImportOrder_stockMovementId_idx" ON "OpsImportOrder"("stockMovementId");

-- CreateIndex
CREATE INDEX "OpsInventoryMovement_movementType_idx" ON "OpsInventoryMovement"("movementType");

-- CreateIndex
CREATE INDEX "OpsInventoryMovement_status_idx" ON "OpsInventoryMovement"("status");

-- CreateIndex
CREATE INDEX "OpsInventoryMovement_inventoryItemId_idx" ON "OpsInventoryMovement"("inventoryItemId");

-- CreateIndex
CREATE INDEX "OpsInventoryMovement_sourceType_sourceId_idx" ON "OpsInventoryMovement"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "OpsInventoryMovement_importOrderId_idx" ON "OpsInventoryMovement"("importOrderId");

-- CreateIndex
CREATE INDEX "OpsInventoryMovement_shopOrderId_idx" ON "OpsInventoryMovement"("shopOrderId");

-- CreateIndex
CREATE INDEX "OpsInventoryMovement_shopOrderItemId_idx" ON "OpsInventoryMovement"("shopOrderItemId");

-- CreateIndex
CREATE INDEX "OpsInventoryMovement_reference_idx" ON "OpsInventoryMovement"("reference");

-- CreateIndex
CREATE INDEX "OpsInventoryMovement_occurredAt_idx" ON "OpsInventoryMovement"("occurredAt");

-- CreateIndex
CREATE INDEX "OpsVendorPayout_vendorId_idx" ON "OpsVendorPayout"("vendorId");

-- CreateIndex
CREATE INDEX "OpsVendorPayout_vendorInvoiceId_idx" ON "OpsVendorPayout"("vendorInvoiceId");

-- CreateIndex
CREATE INDEX "OpsVendorPayout_expenditureLedgerEntryId_idx" ON "OpsVendorPayout"("expenditureLedgerEntryId");

-- CreateIndex
CREATE INDEX "OpsVendorPayout_status_idx" ON "OpsVendorPayout"("status");

-- CreateIndex
CREATE INDEX "OpsVendorPayout_payoutMethod_idx" ON "OpsVendorPayout"("payoutMethod");

-- CreateIndex
CREATE INDEX "OpsVendorPayout_paymentReference_idx" ON "OpsVendorPayout"("paymentReference");

-- CreateIndex
CREATE INDEX "OpsVendorPayout_paystackRecipientCode_idx" ON "OpsVendorPayout"("paystackRecipientCode");

-- CreateIndex
CREATE INDEX "OpsVendorPayout_paystackTransferCode_idx" ON "OpsVendorPayout"("paystackTransferCode");

-- CreateIndex
CREATE INDEX "OpsVendorPayout_scheduledAt_idx" ON "OpsVendorPayout"("scheduledAt");

-- CreateIndex
CREATE INDEX "OpsVendorPayout_paidAt_idx" ON "OpsVendorPayout"("paidAt");

COMMIT;
