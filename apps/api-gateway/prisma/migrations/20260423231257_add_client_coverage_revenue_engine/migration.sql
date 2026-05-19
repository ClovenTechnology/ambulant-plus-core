/*
  Warnings:

  - The values [PENDING,RESERVED,APPROVED,PAID,PARTIALLY_PAID,FAILED,CANCELLED] on the enum `SettlementStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `claimId` on the `SettlementRecord` table. All the data in the column will be lost.
  - You are about to drop the column `grossAmountMinor` on the `SettlementRecord` table. All the data in the column will be lost.
  - You are about to drop the column `netAmountMinor` on the `SettlementRecord` table. All the data in the column will be lost.
  - You are about to drop the column `settlementPartyId` on the `SettlementRecord` table. All the data in the column will be lost.
  - You are about to drop the column `settlementPartyType` on the `SettlementRecord` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[clientId,memberNumber,dependentCode]` on the table `ClientMember` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[billableEventId]` on the table `SettlementRecord` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `clinicianId` to the `SettlementRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clinicianShareMinor` to the `SettlementRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `grossMinor` to the `SettlementRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `netClinicianMinor` to the `SettlementRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `platformShareMinor` to the `SettlementRecord` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ClaimsSubmissionMode" AS ENUM ('AUTO', 'API', 'MANUAL_REVIEW', 'HYBRID');

-- CreateEnum
CREATE TYPE "EligibilityMode" AS ENUM ('UPLOAD', 'API', 'HYBRID', 'MANUAL');

-- CreateEnum
CREATE TYPE "ClientMemberSource" AS ENUM ('PATIENT_SELF_LINK', 'CLIENT_UPLOAD', 'API_SYNC');

-- CreateEnum
CREATE TYPE "ClientMemberVerification" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "ClientConsentScope" AS ENUM ('CLAIMS', 'VITALS', 'REPORTS', 'CARE_COORDINATION');

-- CreateEnum
CREATE TYPE "FundingSourceType" AS ENUM ('CARD', 'MEDICAL_AID', 'HMO', 'CORPORATE_SPONSOR', 'VOUCHER', 'MIXED');

-- CreateEnum
CREATE TYPE "ClientClaimEvidenceKind" AS ENUM ('ENCOUNTER_SUMMARY', 'ICD10', 'PRESCRIPTION', 'LAB_ORDER', 'CONSENT', 'VITALS_SUMMARY', 'REPORT', 'PREAUTH');

-- CreateEnum
CREATE TYPE "ClientClaimEvidenceVisibility" AS ENUM ('CLAIMS_ONLY', 'CLAIMS_AND_COORDINATION');

-- CreateEnum
CREATE TYPE "ClinicianCommercialMode" AS ENUM ('INDEPENDENT', 'AMBULANT_AFFILIATED', 'PRIVATE_CASH');

-- CreateEnum
CREATE TYPE "BillingProviderType" AS ENUM ('CLINICIAN', 'AMBULANT_PRACTICE', 'GROUP_PRACTICE');

-- CreateEnum
CREATE TYPE "FeeModelType" AS ENUM ('CLINICIAN_DEFINED', 'PLATFORM_BAND', 'FIXED_TARIFF');

-- CreateEnum
CREATE TYPE "PlatformRecoveryModel" AS ENUM ('PLATFORM_RETENTION', 'MONTHLY_STATEMENT', 'AUTO_DEBIT', 'SPLIT_BILLING');

-- CreateEnum
CREATE TYPE "FeeScheduleSource" AS ENUM ('CLINICIAN_SAVE', 'ADMIN_OVERRIDE', 'PLAN_TIER_CHANGE', 'PLATFORM_BAND_REFRESH');

-- CreateEnum
CREATE TYPE "PayoutRecipientType" AS ENUM ('CLINICIAN', 'ADMIN_STAFF', 'PRACTICE_POOL');

-- CreateEnum
CREATE TYPE "PayoutAllocationStatus" AS ENUM ('PENDING', 'SCHEDULED', 'PAID', 'VOIDED', 'CLAWED_BACK');

-- CreateEnum
CREATE TYPE "RevenueAdjustmentKind" AS ENUM ('REFUND', 'CLAIM_DENIAL', 'CLAIM_SHORTPAY', 'PAYOUT_CLAWBACK', 'MANUAL_CORRECTION', 'VOUCHER_SUBSIDY');

-- CreateEnum
CREATE TYPE "ReceivableStatus" AS ENUM ('OPEN', 'INVOICED', 'COLLECTED', 'OVERDUE', 'WRITTEN_OFF');

-- AlterEnum
BEGIN;
CREATE TYPE "SettlementStatus_new" AS ENUM ('OPEN', 'PARTIAL', 'CLAIM_PENDING', 'READY_FOR_PAYOUT', 'PAID_OUT', 'REVERSED');
ALTER TABLE "public"."SettlementRecord" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "SettlementRecord" ALTER COLUMN "status" TYPE "SettlementStatus_new" USING ("status"::text::"SettlementStatus_new");
ALTER TYPE "SettlementStatus" RENAME TO "SettlementStatus_old";
ALTER TYPE "SettlementStatus_new" RENAME TO "SettlementStatus";
DROP TYPE "public"."SettlementStatus_old";
ALTER TABLE "SettlementRecord" ALTER COLUMN "status" SET DEFAULT 'OPEN';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."SettlementRecord" DROP CONSTRAINT "SettlementRecord_claimId_fkey";

-- DropIndex
DROP INDEX "public"."ClientMember_clientId_memberNumber_key";

-- DropIndex
DROP INDEX "public"."SettlementRecord_claimId_idx";

-- DropIndex
DROP INDEX "public"."SettlementRecord_settlementPartyType_settlementPartyId_crea_idx";

-- AlterTable
ALTER TABLE "BillableEvent" ADD COLUMN     "claimFiledAt" TIMESTAMP(3),
ADD COLUMN     "claimReady" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fundingSourceType" "FundingSourceType",
ADD COLUMN     "patientResponsibilityMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "settlementLedgerId" TEXT,
ADD COLUMN     "sponsorOutstandingMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "voucherAmountMinor" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "apiBaseUrl" TEXT,
ADD COLUMN     "claimsSubmissionMode" "ClaimsSubmissionMode" NOT NULL DEFAULT 'MANUAL_REVIEW',
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "eligibilityMode" "EligibilityMode" NOT NULL DEFAULT 'UPLOAD',
ADD COLUMN     "payerMetadata" JSONB,
ADD COLUMN     "requiresConsentForClaims" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresConsentForReports" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "requiresConsentForVitals" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "supportsInPerson" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "supportsTelevisit" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ClientClaim" ADD COLUMN     "appointmentId" TEXT,
ADD COLUMN     "authorizationId" TEXT,
ADD COLUMN     "billingProviderName" TEXT,
ADD COLUMN     "billingProviderPracticeNo" TEXT,
ADD COLUMN     "billingProviderType" "BillingProviderType",
ADD COLUMN     "clientMemberId" TEXT,
ADD COLUMN     "clinicianId" TEXT,
ADD COLUMN     "coveragePlanId" TEXT,
ADD COLUMN     "denialReasonCode" TEXT,
ADD COLUMN     "denialReasonText" TEXT,
ADD COLUMN     "encounterId" TEXT,
ADD COLUMN     "externalClaimRef" TEXT,
ADD COLUMN     "memberResponsibilityMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "patientId" TEXT,
ADD COLUMN     "renderingClinicianHpcsa" TEXT,
ADD COLUMN     "renderingClinicianName" TEXT,
ADD COLUMN     "renderingClinicianPracticeNo" TEXT,
ADD COLUMN     "serviceType" "CoveredServiceType",
ADD COLUMN     "visitMode" "AppointmentVisitMode";

-- AlterTable
ALTER TABLE "ClientClaimLine" ADD COLUMN     "code" TEXT,
ADD COLUMN     "codeLabel" TEXT,
ADD COLUMN     "codeSystem" TEXT,
ADD COLUMN     "icd10Codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "nappiCode" TEXT,
ADD COLUMN     "tariffCode" TEXT;

-- AlterTable
ALTER TABLE "ClientMember" ADD COLUMN     "inPersonEligible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "payerPayload" JSONB,
ADD COLUMN     "principalMemberName" TEXT,
ADD COLUMN     "relationship" TEXT,
ADD COLUMN     "source" "ClientMemberSource" NOT NULL DEFAULT 'PATIENT_SELF_LINK',
ADD COLUMN     "televisitEligible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "verificationState" "ClientMemberVerification" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "CoverageAuthorization" ADD COLUMN     "allowedAmountMinor" INTEGER,
ADD COLUMN     "appointmentId" TEXT,
ADD COLUMN     "clinicianId" TEXT,
ADD COLUMN     "encounterId" TEXT,
ADD COLUMN     "externalDecisionRef" TEXT,
ADD COLUMN     "memberResponsibilityMinor" INTEGER,
ADD COLUMN     "preauthReference" TEXT,
ADD COLUMN     "submissionMode" "ClaimsSubmissionMode",
ADD COLUMN     "visitMode" "AppointmentVisitMode";

-- AlterTable
ALTER TABLE "SettlementRecord" DROP COLUMN "claimId",
DROP COLUMN "grossAmountMinor",
DROP COLUMN "netAmountMinor",
DROP COLUMN "settlementPartyId",
DROP COLUMN "settlementPartyType",
ADD COLUMN     "appointmentId" TEXT,
ADD COLUMN     "billableEventId" TEXT,
ADD COLUMN     "clientClaimId" TEXT,
ADD COLUMN     "clinicianId" TEXT NOT NULL,
ADD COLUMN     "clinicianShareMinor" INTEGER NOT NULL,
ADD COLUMN     "computationVersion" TEXT NOT NULL DEFAULT 'v1',
ADD COLUMN     "coverageAuthorizationId" TEXT,
ADD COLUMN     "encounterId" TEXT,
ADD COLUMN     "grossMinor" INTEGER NOT NULL,
ADD COLUMN     "netClinicianMinor" INTEGER NOT NULL,
ADD COLUMN     "patientId" TEXT,
ADD COLUMN     "patientPaidMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paymentId" TEXT,
ADD COLUMN     "platformShareMinor" INTEGER NOT NULL,
ADD COLUMN     "refundMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sponsorApprovedMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sponsorOutstandingMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "staffShareMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "voucherCoveredMinor" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "status" SET DEFAULT 'OPEN';

-- CreateTable
CREATE TABLE "ClientMemberConsent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "clientMemberId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "scope" "ClientConsentScope" NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientMemberConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientClaimEvidence" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "kind" "ClientClaimEvidenceKind" NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "visibility" "ClientClaimEvidenceVisibility" NOT NULL DEFAULT 'CLAIMS_ONLY',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientClaimEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicianCommercialProfile" (
    "id" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "commercialMode" "ClinicianCommercialMode" NOT NULL,
    "canSetOwnFees" BOOLEAN NOT NULL DEFAULT true,
    "hasOwnPracticeNumber" BOOLEAN NOT NULL DEFAULT false,
    "practiceNumber" TEXT,
    "billingProviderType" "BillingProviderType" NOT NULL,
    "billingProviderName" TEXT,
    "billingProviderPracticeNo" TEXT,
    "acceptsMedicalAid" BOOLEAN NOT NULL DEFAULT false,
    "acceptsCash" BOOLEAN NOT NULL DEFAULT true,
    "acceptsVoucher" BOOLEAN NOT NULL DEFAULT true,
    "feeModel" "FeeModelType" NOT NULL DEFAULT 'CLINICIAN_DEFINED',
    "specialtyBandKey" TEXT,
    "experienceBandKey" TEXT,
    "contractShareModel" "PlatformRecoveryModel" NOT NULL DEFAULT 'PLATFORM_RETENTION',
    "directPayRecoveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicianCommercialProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeScheduleVersion" (
    "id" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "commercialProfileId" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "consultationCents" INTEGER NOT NULL,
    "followupCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "collaborativeFees" JSONB,
    "customServices" JSONB,
    "source" "FeeScheduleSource" NOT NULL DEFAULT 'CLINICIAN_SAVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeScheduleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutAllocation" (
    "id" TEXT NOT NULL,
    "settlementRecordId" TEXT NOT NULL,
    "recipientType" "PayoutRecipientType" NOT NULL,
    "clinicianId" TEXT,
    "adminStaffId" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "scheduledFor" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "status" "PayoutAllocationStatus" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueAdjustment" (
    "id" TEXT NOT NULL,
    "settlementRecordId" TEXT NOT NULL,
    "kind" "RevenueAdjustmentKind" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "reasonCode" TEXT,
    "reasonText" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevenueAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformReceivable" (
    "id" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "settlementRecordId" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "dueDate" TIMESTAMP(3),
    "status" "ReceivableStatus" NOT NULL,
    "reference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformReceivable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientMemberConsent_patientId_scope_granted_idx" ON "ClientMemberConsent"("patientId", "scope", "granted");

-- CreateIndex
CREATE INDEX "ClientMemberConsent_clientMemberId_scope_idx" ON "ClientMemberConsent"("clientMemberId", "scope");

-- CreateIndex
CREATE INDEX "ClientClaimEvidence_claimId_kind_idx" ON "ClientClaimEvidence"("claimId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicianCommercialProfile_clinicianId_key" ON "ClinicianCommercialProfile"("clinicianId");

-- CreateIndex
CREATE INDEX "ClinicianCommercialProfile_clinicianId_idx" ON "ClinicianCommercialProfile"("clinicianId");

-- CreateIndex
CREATE INDEX "FeeScheduleVersion_clinicianId_effectiveFrom_idx" ON "FeeScheduleVersion"("clinicianId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "FeeScheduleVersion_commercialProfileId_idx" ON "FeeScheduleVersion"("commercialProfileId");

-- CreateIndex
CREATE INDEX "PayoutAllocation_settlementRecordId_status_idx" ON "PayoutAllocation"("settlementRecordId", "status");

-- CreateIndex
CREATE INDEX "PayoutAllocation_clinicianId_status_idx" ON "PayoutAllocation"("clinicianId", "status");

-- CreateIndex
CREATE INDEX "PayoutAllocation_adminStaffId_status_idx" ON "PayoutAllocation"("adminStaffId", "status");

-- CreateIndex
CREATE INDEX "RevenueAdjustment_settlementRecordId_kind_idx" ON "RevenueAdjustment"("settlementRecordId", "kind");

-- CreateIndex
CREATE INDEX "PlatformReceivable_clinicianId_status_idx" ON "PlatformReceivable"("clinicianId", "status");

-- CreateIndex
CREATE INDEX "PlatformReceivable_settlementRecordId_idx" ON "PlatformReceivable"("settlementRecordId");

-- CreateIndex
CREATE INDEX "PlatformReceivable_dueDate_status_idx" ON "PlatformReceivable"("dueDate", "status");

-- CreateIndex
CREATE INDEX "BillableEvent_claimReady_createdAt_idx" ON "BillableEvent"("claimReady", "createdAt");

-- CreateIndex
CREATE INDEX "ClientClaim_appointmentId_idx" ON "ClientClaim"("appointmentId");

-- CreateIndex
CREATE INDEX "ClientClaim_encounterId_idx" ON "ClientClaim"("encounterId");

-- CreateIndex
CREATE INDEX "ClientClaim_patientId_idx" ON "ClientClaim"("patientId");

-- CreateIndex
CREATE INDEX "ClientClaim_clientMemberId_idx" ON "ClientClaim"("clientMemberId");

-- CreateIndex
CREATE INDEX "ClientClaim_authorizationId_idx" ON "ClientClaim"("authorizationId");

-- CreateIndex
CREATE INDEX "ClientMember_memberNumber_idx" ON "ClientMember"("memberNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ClientMember_clientId_memberNumber_dependentCode_key" ON "ClientMember"("clientId", "memberNumber", "dependentCode");

-- CreateIndex
CREATE INDEX "CoverageAuthorization_appointmentId_idx" ON "CoverageAuthorization"("appointmentId");

-- CreateIndex
CREATE INDEX "CoverageAuthorization_encounterId_idx" ON "CoverageAuthorization"("encounterId");

-- CreateIndex
CREATE INDEX "CoverageAuthorization_clinicianId_idx" ON "CoverageAuthorization"("clinicianId");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementRecord_billableEventId_key" ON "SettlementRecord"("billableEventId");

-- CreateIndex
CREATE INDEX "SettlementRecord_clientClaimId_idx" ON "SettlementRecord"("clientClaimId");

-- CreateIndex
CREATE INDEX "SettlementRecord_appointmentId_idx" ON "SettlementRecord"("appointmentId");

-- CreateIndex
CREATE INDEX "SettlementRecord_encounterId_idx" ON "SettlementRecord"("encounterId");

-- CreateIndex
CREATE INDEX "SettlementRecord_clinicianId_status_idx" ON "SettlementRecord"("clinicianId", "status");

-- AddForeignKey
ALTER TABLE "ClientClaim" ADD CONSTRAINT "ClientClaim_clientMemberId_fkey" FOREIGN KEY ("clientMemberId") REFERENCES "ClientMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientClaim" ADD CONSTRAINT "ClientClaim_coveragePlanId_fkey" FOREIGN KEY ("coveragePlanId") REFERENCES "CoveragePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientClaim" ADD CONSTRAINT "ClientClaim_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "CoverageAuthorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementRecord" ADD CONSTRAINT "SettlementRecord_clientClaimId_fkey" FOREIGN KEY ("clientClaimId") REFERENCES "ClientClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMemberConsent" ADD CONSTRAINT "ClientMemberConsent_clientMemberId_fkey" FOREIGN KEY ("clientMemberId") REFERENCES "ClientMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientClaimEvidence" ADD CONSTRAINT "ClientClaimEvidence_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ClientClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicianCommercialProfile" ADD CONSTRAINT "ClinicianCommercialProfile_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeScheduleVersion" ADD CONSTRAINT "FeeScheduleVersion_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutAllocation" ADD CONSTRAINT "PayoutAllocation_settlementRecordId_fkey" FOREIGN KEY ("settlementRecordId") REFERENCES "SettlementRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueAdjustment" ADD CONSTRAINT "RevenueAdjustment_settlementRecordId_fkey" FOREIGN KEY ("settlementRecordId") REFERENCES "SettlementRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformReceivable" ADD CONSTRAINT "PlatformReceivable_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
