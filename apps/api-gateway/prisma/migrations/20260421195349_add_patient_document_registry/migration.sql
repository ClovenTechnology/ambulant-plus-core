/*
  Warnings:

  - You are about to drop the column `criticality` on the `Allergy` table. All the data in the column will be lost.
  - The `severity` column on the `Allergy` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Allergy` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[patientId,substance,reaction]` on the table `Allergy` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Allergy` table without a default value. This is not possible if the table is not empty.
  - Made the column `patientId` on table `Allergy` required. This step will fail if there are existing NULL values in that column.
  - Made the column `reaction` on table `Allergy` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "AllergySeverity" AS ENUM ('Mild', 'Moderate', 'Severe');

-- CreateEnum
CREATE TYPE "AllergyStatus" AS ENUM ('Active', 'Resolved');

-- CreateEnum
CREATE TYPE "AllergyReactionSeverity" AS ENUM ('mild', 'moderate', 'severe');

-- CreateEnum
CREATE TYPE "PatientDocumentStatus" AS ENUM ('PENDING_UPLOAD', 'READY', 'SCANNING', 'CLEAN', 'INFECTED', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('MEDICAL_AID', 'CORPORATE', 'NGO', 'GOVERNMENT', 'SCHOOL', 'PROGRAM_SPONSOR');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "ClientBillingMode" AS ENUM ('CLAIMS', 'WALLET', 'HYBRID');

-- CreateEnum
CREATE TYPE "ClientMemberKind" AS ENUM ('PRINCIPAL', 'DEPENDANT', 'EMPLOYEE', 'CONTRACTOR', 'BENEFICIARY');

-- CreateEnum
CREATE TYPE "ClientMemberStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ClientProgramStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CoverageStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CoverageLimitPeriod" AS ENUM ('PER_VISIT', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'LIFETIME');

-- CreateEnum
CREATE TYPE "CoveredServiceType" AS ENUM ('CONSULT_STANDARD', 'CONSULT_FOLLOWUP', 'CONSULT_PROCEDURE', 'PHYSICAL_VISIT', 'LAB_TEST', 'PHLEB_DRAW', 'LAB_LOGISTICS', 'PHARMACY_ITEM', 'PHARMACY_DISPENSING', 'RIDER_DELIVERY', 'DEVICE_PURCHASE', 'DEVICE_RENTAL', 'DEVICE_ASSIGNMENT', 'DEVICE_MAINTENANCE', 'DEVICE_SWAP');

-- CreateEnum
CREATE TYPE "CoverageDecision" AS ENUM ('COVERED', 'COVERED_WITH_COPAY', 'REQUIRES_AUTHORIZATION', 'NOT_COVERED', 'NOT_ELIGIBLE', 'FALLBACK_TO_SELF_PAY');

-- CreateEnum
CREATE TYPE "AuthorizationStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'PARTIALLY_APPROVED', 'DENIED', 'EXPIRED', 'CANCELLED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "AuthorizationScopeType" AS ENUM ('APPOINTMENT', 'ENCOUNTER', 'LAB_ORDER', 'DRAW', 'ERX_ORDER', 'CAREPORT_ORDER', 'DEVICE_ORDER', 'DELIVERY', 'BUNDLE');

-- CreateEnum
CREATE TYPE "BillingResponsibility" AS ENUM ('CLIENT', 'PATIENT', 'SPLIT', 'PLATFORM');

-- CreateEnum
CREATE TYPE "BillableServiceType" AS ENUM ('CONSULT_STANDARD', 'CONSULT_FOLLOWUP', 'CONSULT_PROCEDURE', 'PHYSICAL_VISIT', 'LAB_TEST', 'PHLEB_DRAW', 'LAB_LOGISTICS', 'PHARMACY_ITEM', 'PHARMACY_DISPENSING', 'RIDER_DELIVERY', 'DEVICE_PURCHASE', 'DEVICE_RENTAL', 'DEVICE_ASSIGNMENT', 'DEVICE_MAINTENANCE', 'DEVICE_SWAP');

-- CreateEnum
CREATE TYPE "ProviderLane" AS ENUM ('CLINICIAN', 'CLINICIAN_STAFF_MEDICAL', 'CLINICIAN_STAFF_NON_MEDICAL', 'LAB', 'PHLEB', 'PHARMACY', 'RIDER', 'PLATFORM', 'INVENTORY');

-- CreateEnum
CREATE TYPE "BillableEventStatus" AS ENUM ('DRAFT', 'READY', 'INVOICED', 'CLAIMED', 'SETTLED', 'VOID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('MEDICAL_AID_CLAIM', 'CORPORATE_CLAIM', 'SPONSOR_INVOICE');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RECEIVED', 'IN_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'RESERVED', 'APPROVED', 'PAID', 'PARTIALLY_PAID', 'FAILED', 'REVERSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SettlementPartyType" AS ENUM ('CLIENT', 'PATIENT', 'PLATFORM');

-- CreateEnum
CREATE TYPE "ClientWalletTransactionType" AS ENUM ('FUNDING', 'RESERVE', 'RELEASE', 'CAPTURE', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ClientWalletStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ConsentScopeKind" AS ENUM ('AGGREGATED_ANALYTICS', 'INDIVIDUAL_VITALS', 'INDIVIDUAL_REPORTS', 'INDIVIDUAL_ENCOUNTERS', 'INDIVIDUAL_MEDICATIONS', 'INDIVIDUAL_DEVICES', 'DEVICE_FLEET', 'BILLING_DISCLOSURE', 'AUTHORIZATION_DISCLOSURE');

-- CreateEnum
CREATE TYPE "ConsentGrantStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SponsoredDeviceOwnershipType" AS ENUM ('PATIENT_OWNED', 'CLIENT_OWNED_ASSIGNED', 'CLIENT_OWNED_POOLED', 'CLIENT_RENTED_TO_MEMBER', 'CLIENT_SPONSORED_PATIENT_OWNED');

-- CreateEnum
CREATE TYPE "SponsoredDeviceProgramStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SponsoredDeviceAssignmentStatus" AS ENUM ('ASSIGNED', 'RETURN_REQUESTED', 'RETURNED', 'REASSIGNED', 'LOST', 'DAMAGED', 'TERMINATED');

-- DropForeignKey
ALTER TABLE "public"."Allergy" DROP CONSTRAINT "Allergy_patientId_fkey";

-- DropIndex
DROP INDEX "public"."Allergy_patientId_idx";

-- DropIndex
DROP INDEX "public"."Allergy_recordedAt_idx";

-- DropIndex
DROP INDEX "public"."Allergy_status_idx";

-- AlterTable
ALTER TABLE "Allergy" DROP COLUMN "criticality",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "patientId" SET NOT NULL,
ALTER COLUMN "reaction" SET NOT NULL,
DROP COLUMN "severity",
ADD COLUMN     "severity" "AllergySeverity" NOT NULL DEFAULT 'Mild',
DROP COLUMN "status",
ADD COLUMN     "status" "AllergyStatus" NOT NULL DEFAULT 'Active';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "clientMemberId" TEXT,
ADD COLUMN     "coverageAuthorizationId" TEXT,
ADD COLUMN     "coverageDecision" TEXT,
ADD COLUMN     "coveragePlanId" TEXT,
ADD COLUMN     "patientCopayMinor" INTEGER,
ADD COLUMN     "sponsorAmountMinor" INTEGER,
ADD COLUMN     "sponsorCurrency" VARCHAR(3),
ADD COLUMN     "sponsorPricingSnapshot" JSONB;

-- AlterTable
ALTER TABLE "CarePortOrder" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "clientMemberId" TEXT,
ADD COLUMN     "coverageAuthorizationId" TEXT,
ADD COLUMN     "coveragePlanId" TEXT,
ADD COLUMN     "patientCopayMinor" INTEGER,
ADD COLUMN     "sponsorAmountMinor" INTEGER,
ADD COLUMN     "sponsorPricingSnapshot" JSONB;

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "billableEventId" TEXT,
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "clientMemberId" TEXT,
ADD COLUMN     "coverageAuthorizationId" TEXT,
ADD COLUMN     "coveragePlanId" TEXT,
ADD COLUMN     "patientCopayMinor" INTEGER,
ADD COLUMN     "sponsorAmountMinor" INTEGER;

-- AlterTable
ALTER TABLE "Draw" ADD COLUMN     "billableEventId" TEXT,
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "clientMemberId" TEXT,
ADD COLUMN     "coverageAuthorizationId" TEXT,
ADD COLUMN     "coveragePlanId" TEXT,
ADD COLUMN     "patientCopayMinor" INTEGER,
ADD COLUMN     "sponsorAmountMinor" INTEGER;

-- AlterTable
ALTER TABLE "Encounter" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "clientMemberId" TEXT,
ADD COLUMN     "coveragePlanId" TEXT,
ADD COLUMN     "sponsorSnapshot" JSONB;

-- AlterTable
ALTER TABLE "MedReachOrderFinancial" ADD COLUMN     "authorizationId" TEXT,
ADD COLUMN     "billableEventLabId" TEXT,
ADD COLUMN     "billableEventLogisticsId" TEXT,
ADD COLUMN     "billableEventPhlebId" TEXT,
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "clientMemberId" TEXT,
ADD COLUMN     "coveragePlanId" TEXT,
ADD COLUMN     "patientCopayMinor" INTEGER,
ADD COLUMN     "sponsorAmountMinor" INTEGER,
ADD COLUMN     "sponsorPricingSnapshot" JSONB;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "billableEventId" TEXT,
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "payerRefId" TEXT,
ADD COLUMN     "payerType" TEXT,
ADD COLUMN     "settlementRecordId" TEXT;

-- AlterTable
ALTER TABLE "UserDevice" ADD COLUMN     "fundingSourceId" TEXT,
ADD COLUMN     "fundingSourceType" TEXT,
ADD COLUMN     "ownershipType" TEXT,
ADD COLUMN     "sponsoredAssignmentId" TEXT,
ADD COLUMN     "sponsoredProgramId" TEXT;

-- CreateTable
CREATE TABLE "AllergyReactionLog" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "suspectedTrigger" TEXT NOT NULL,
    "symptoms" JSONB,
    "severity" "AllergyReactionSeverity" NOT NULL DEFAULT 'mild',
    "medsTaken" TEXT,
    "notes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllergyReactionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientDocument" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "title" TEXT NOT NULL,
    "documentKind" TEXT NOT NULL,
    "sourceApp" TEXT,
    "sourceType" TEXT,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "status" "PatientDocumentStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "linkedRecordType" TEXT,
    "linkedRecordId" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdByRole" TEXT,
    "relationshipId" TEXT,
    "scanReport" JSONB,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "type" "ClientType" NOT NULL,
    "status" "ClientStatus" NOT NULL DEFAULT 'DRAFT',
    "legalName" TEXT NOT NULL,
    "tradingName" TEXT,
    "code" TEXT,
    "billingMode" "ClientBillingMode" NOT NULL DEFAULT 'HYBRID',
    "defaultCurrency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "country" VARCHAR(2),
    "allowsClaims" BOOLEAN NOT NULL DEFAULT true,
    "allowsWalletFunding" BOOLEAN NOT NULL DEFAULT true,
    "allowsHybridFunding" BOOLEAN NOT NULL DEFAULT true,
    "contractStartAt" TIMESTAMP(3),
    "contractEndAt" TIMESTAMP(3),
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "contactsJson" JSONB,
    "configJson" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientProgram" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ClientProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "billingModeOverride" "ClientBillingMode",
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoveragePlan" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "clientId" TEXT NOT NULL,
    "clientProgramId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CoverageStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "annualLimitMinor" INTEGER,
    "monthlyLimitMinor" INTEGER,
    "lifetimeLimitMinor" INTEGER,
    "requiresEligibility" BOOLEAN NOT NULL DEFAULT true,
    "requiresConsent" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoveragePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageServiceRule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "coveragePlanId" TEXT NOT NULL,
    "serviceType" "CoveredServiceType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "decision" "CoverageDecision" NOT NULL DEFAULT 'COVERED',
    "sponsorCapMinor" INTEGER,
    "memberCopayMinor" INTEGER,
    "memberCopayPercent" DECIMAL(5,2),
    "preauthRequired" BOOLEAN NOT NULL DEFAULT false,
    "limitCount" INTEGER,
    "limitMinor" INTEGER,
    "limitPeriod" "CoverageLimitPeriod",
    "allowedVisitModes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverageServiceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientMember" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "clientId" TEXT NOT NULL,
    "clientProgramId" TEXT,
    "coveragePlanId" TEXT,
    "userId" TEXT,
    "patientId" TEXT,
    "memberKind" "ClientMemberKind" NOT NULL,
    "memberStatus" "ClientMemberStatus" NOT NULL DEFAULT 'PENDING',
    "memberNumber" TEXT,
    "employeeNumber" TEXT,
    "dependentCode" TEXT,
    "principalMemberNumber" TEXT,
    "joinedAt" TIMESTAMP(3),
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicianClientContract" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "clientId" TEXT NOT NULL,
    "clinicianUserId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "standardFeeMinor" INTEGER,
    "followupFeeMinor" INTEGER,
    "procedureFeeMinor" INTEGER,
    "sponsorCapStandardMinor" INTEGER,
    "sponsorCapFollowupMinor" INTEGER,
    "sponsorCapProcedureMinor" INTEGER,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicianClientContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageAuthorization" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "clientId" TEXT NOT NULL,
    "coveragePlanId" TEXT,
    "clientMemberId" TEXT,
    "userId" TEXT,
    "patientId" TEXT,
    "scopeType" "AuthorizationScopeType" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "serviceType" "CoveredServiceType" NOT NULL,
    "status" "AuthorizationStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAmountMinor" INTEGER,
    "approvedAmountMinor" INTEGER,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "decisionReason" TEXT,
    "ruleSnapshot" JSONB,
    "metadata" JSONB,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "CoverageAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillableEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "clientId" TEXT,
    "clientMemberId" TEXT,
    "authorizationId" TEXT,
    "encounterId" TEXT,
    "appointmentId" TEXT,
    "labOrderId" TEXT,
    "erxOrderId" TEXT,
    "carePortOrderId" TEXT,
    "deliveryId" TEXT,
    "drawId" TEXT,
    "deviceId" TEXT,
    "patientId" TEXT,
    "userId" TEXT,
    "serviceType" "BillableServiceType" NOT NULL,
    "providerLane" "ProviderLane" NOT NULL,
    "providerId" TEXT,
    "responsibility" "BillingResponsibility" NOT NULL DEFAULT 'SPLIT',
    "status" "BillableEventStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "grossAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "sponsorAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "patientAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "platformAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "providerAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "pricingSnapshot" JSONB,
    "metadata" JSONB,
    "serviceAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillableEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientClaim" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "clientId" TEXT NOT NULL,
    "claimType" "ClaimType" NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "claimNumber" TEXT,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "submittedAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "approvedAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "paidAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "submissionPayload" JSONB,
    "responsePayload" JSONB,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientClaimLine" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "billableEventId" TEXT NOT NULL,
    "submittedAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "approvedAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "paidAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "rejectionReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientClaimLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementRecord" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "clientId" TEXT,
    "claimId" TEXT,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "settlementPartyType" "SettlementPartyType" NOT NULL,
    "settlementPartyId" TEXT,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "grossAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "netAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "remittanceRef" TEXT,
    "payoutRef" TEXT,
    "metadata" JSONB,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementLine" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "billableEventId" TEXT NOT NULL,
    "providerLane" "ProviderLane" NOT NULL,
    "providerId" TEXT,
    "grossAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "netAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientWalletAccount" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "clientId" TEXT NOT NULL,
    "status" "ClientWalletStatus" NOT NULL DEFAULT 'ACTIVE',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "balanceMinor" INTEGER NOT NULL DEFAULT 0,
    "heldMinor" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientWalletAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientWalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "ClientWalletTransactionType" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "refType" TEXT,
    "refId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientWalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientConsentPolicy" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "clientId" TEXT NOT NULL,
    "scope" "ConsentScopeKind" NOT NULL,
    "enabledByDefault" BOOLEAN NOT NULL DEFAULT false,
    "requiresExplicitGrant" BOOLEAN NOT NULL DEFAULT true,
    "policyText" TEXT,
    "policyVersion" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientConsentPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientConsentGrant" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "clientId" TEXT NOT NULL,
    "userId" TEXT,
    "patientId" TEXT,
    "scope" "ConsentScopeKind" NOT NULL,
    "status" "ConsentGrantStatus" NOT NULL DEFAULT 'ACTIVE',
    "purpose" TEXT,
    "grantedVia" TEXT,
    "grantedByUserId" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "ClientConsentGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SponsoredDeviceProgram" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SponsoredDeviceProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "ownershipType" "SponsoredDeviceOwnershipType" NOT NULL,
    "allowsTakeHome" BOOLEAN NOT NULL DEFAULT true,
    "requiresReturnOnExit" BOOLEAN NOT NULL DEFAULT false,
    "allowsReassignment" BOOLEAN NOT NULL DEFAULT false,
    "allowedCatalogSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsoredDeviceProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SponsoredDeviceAssignment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "sponsoredDeviceProgramId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientMemberId" TEXT,
    "userId" TEXT,
    "patientId" TEXT,
    "userDeviceId" TEXT,
    "catalogSlug" TEXT,
    "serialNumber" TEXT,
    "status" "SponsoredDeviceAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedReturnAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "assignmentNotes" TEXT,
    "returnNotes" TEXT,
    "metadata" JSONB,

    CONSTRAINT "SponsoredDeviceAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AllergyReactionLog_patientId_occurredAt_idx" ON "AllergyReactionLog"("patientId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "AllergyReactionLog_patientId_severity_idx" ON "AllergyReactionLog"("patientId", "severity");

-- CreateIndex
CREATE INDEX "AllergyReactionLog_patientId_suspectedTrigger_idx" ON "AllergyReactionLog"("patientId", "suspectedTrigger");

-- CreateIndex
CREATE INDEX "PatientDocument_patientId_createdAt_idx" ON "PatientDocument"("patientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PatientDocument_encounterId_createdAt_idx" ON "PatientDocument"("encounterId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PatientDocument_linkedRecordType_linkedRecordId_idx" ON "PatientDocument"("linkedRecordType", "linkedRecordId");

-- CreateIndex
CREATE INDEX "PatientDocument_documentKind_createdAt_idx" ON "PatientDocument"("documentKind", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PatientDocument_status_createdAt_idx" ON "PatientDocument"("status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Client_code_key" ON "Client"("code");

-- CreateIndex
CREATE INDEX "Client_orgId_type_status_idx" ON "Client"("orgId", "type", "status");

-- CreateIndex
CREATE INDEX "Client_orgId_legalName_idx" ON "Client"("orgId", "legalName");

-- CreateIndex
CREATE INDEX "ClientProgram_orgId_clientId_status_idx" ON "ClientProgram"("orgId", "clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClientProgram_clientId_name_key" ON "ClientProgram"("clientId", "name");

-- CreateIndex
CREATE INDEX "CoveragePlan_orgId_clientId_status_idx" ON "CoveragePlan"("orgId", "clientId", "status");

-- CreateIndex
CREATE INDEX "CoveragePlan_clientProgramId_idx" ON "CoveragePlan"("clientProgramId");

-- CreateIndex
CREATE UNIQUE INDEX "CoveragePlan_clientId_name_key" ON "CoveragePlan"("clientId", "name");

-- CreateIndex
CREATE INDEX "CoverageServiceRule_orgId_serviceType_enabled_idx" ON "CoverageServiceRule"("orgId", "serviceType", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "CoverageServiceRule_coveragePlanId_serviceType_key" ON "CoverageServiceRule"("coveragePlanId", "serviceType");

-- CreateIndex
CREATE INDEX "ClientMember_orgId_clientId_memberStatus_idx" ON "ClientMember"("orgId", "clientId", "memberStatus");

-- CreateIndex
CREATE INDEX "ClientMember_userId_idx" ON "ClientMember"("userId");

-- CreateIndex
CREATE INDEX "ClientMember_patientId_idx" ON "ClientMember"("patientId");

-- CreateIndex
CREATE INDEX "ClientMember_coveragePlanId_idx" ON "ClientMember"("coveragePlanId");

-- CreateIndex
CREATE INDEX "ClientMember_employeeNumber_idx" ON "ClientMember"("employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ClientMember_clientId_memberNumber_key" ON "ClientMember"("clientId", "memberNumber");

-- CreateIndex
CREATE INDEX "ClinicianClientContract_orgId_clientId_active_idx" ON "ClinicianClientContract"("orgId", "clientId", "active");

-- CreateIndex
CREATE INDEX "ClinicianClientContract_clinicianUserId_active_idx" ON "ClinicianClientContract"("clinicianUserId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicianClientContract_clientId_clinicianUserId_effectiveF_key" ON "ClinicianClientContract"("clientId", "clinicianUserId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "CoverageAuthorization_orgId_clientId_status_requestedAt_idx" ON "CoverageAuthorization"("orgId", "clientId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "CoverageAuthorization_scopeType_scopeId_idx" ON "CoverageAuthorization"("scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "CoverageAuthorization_patientId_requestedAt_idx" ON "CoverageAuthorization"("patientId", "requestedAt");

-- CreateIndex
CREATE INDEX "CoverageAuthorization_clientMemberId_idx" ON "CoverageAuthorization"("clientMemberId");

-- CreateIndex
CREATE INDEX "CoverageAuthorization_coveragePlanId_idx" ON "CoverageAuthorization"("coveragePlanId");

-- CreateIndex
CREATE INDEX "BillableEvent_orgId_status_createdAt_idx" ON "BillableEvent"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BillableEvent_clientId_createdAt_idx" ON "BillableEvent"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "BillableEvent_patientId_createdAt_idx" ON "BillableEvent"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "BillableEvent_serviceType_providerLane_createdAt_idx" ON "BillableEvent"("serviceType", "providerLane", "createdAt");

-- CreateIndex
CREATE INDEX "BillableEvent_encounterId_idx" ON "BillableEvent"("encounterId");

-- CreateIndex
CREATE INDEX "BillableEvent_appointmentId_idx" ON "BillableEvent"("appointmentId");

-- CreateIndex
CREATE INDEX "BillableEvent_labOrderId_idx" ON "BillableEvent"("labOrderId");

-- CreateIndex
CREATE INDEX "BillableEvent_drawId_idx" ON "BillableEvent"("drawId");

-- CreateIndex
CREATE INDEX "BillableEvent_deliveryId_idx" ON "BillableEvent"("deliveryId");

-- CreateIndex
CREATE INDEX "BillableEvent_carePortOrderId_idx" ON "BillableEvent"("carePortOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientClaim_claimNumber_key" ON "ClientClaim"("claimNumber");

-- CreateIndex
CREATE INDEX "ClientClaim_orgId_clientId_status_createdAt_idx" ON "ClientClaim"("orgId", "clientId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ClientClaim_claimType_status_createdAt_idx" ON "ClientClaim"("claimType", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ClientClaimLine_billableEventId_idx" ON "ClientClaimLine"("billableEventId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientClaimLine_claimId_billableEventId_key" ON "ClientClaimLine"("claimId", "billableEventId");

-- CreateIndex
CREATE INDEX "SettlementRecord_orgId_status_createdAt_idx" ON "SettlementRecord"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SettlementRecord_clientId_createdAt_idx" ON "SettlementRecord"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "SettlementRecord_claimId_idx" ON "SettlementRecord"("claimId");

-- CreateIndex
CREATE INDEX "SettlementRecord_settlementPartyType_settlementPartyId_crea_idx" ON "SettlementRecord"("settlementPartyType", "settlementPartyId", "createdAt");

-- CreateIndex
CREATE INDEX "SettlementLine_billableEventId_idx" ON "SettlementLine"("billableEventId");

-- CreateIndex
CREATE INDEX "SettlementLine_providerLane_providerId_idx" ON "SettlementLine"("providerLane", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementLine_settlementId_billableEventId_providerLane_key" ON "SettlementLine"("settlementId", "billableEventId", "providerLane");

-- CreateIndex
CREATE UNIQUE INDEX "ClientWalletAccount_clientId_key" ON "ClientWalletAccount"("clientId");

-- CreateIndex
CREATE INDEX "ClientWalletAccount_orgId_status_idx" ON "ClientWalletAccount"("orgId", "status");

-- CreateIndex
CREATE INDEX "ClientWalletTransaction_walletId_createdAt_idx" ON "ClientWalletTransaction"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "ClientWalletTransaction_type_createdAt_idx" ON "ClientWalletTransaction"("type", "createdAt");

-- CreateIndex
CREATE INDEX "ClientWalletTransaction_refType_refId_idx" ON "ClientWalletTransaction"("refType", "refId");

-- CreateIndex
CREATE INDEX "ClientConsentPolicy_orgId_clientId_scope_idx" ON "ClientConsentPolicy"("orgId", "clientId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "ClientConsentPolicy_clientId_scope_policyVersion_key" ON "ClientConsentPolicy"("clientId", "scope", "policyVersion");

-- CreateIndex
CREATE INDEX "ClientConsentGrant_orgId_clientId_scope_status_idx" ON "ClientConsentGrant"("orgId", "clientId", "scope", "status");

-- CreateIndex
CREATE INDEX "ClientConsentGrant_patientId_scope_status_idx" ON "ClientConsentGrant"("patientId", "scope", "status");

-- CreateIndex
CREATE INDEX "ClientConsentGrant_userId_scope_status_idx" ON "ClientConsentGrant"("userId", "scope", "status");

-- CreateIndex
CREATE INDEX "SponsoredDeviceProgram_orgId_clientId_status_idx" ON "SponsoredDeviceProgram"("orgId", "clientId", "status");

-- CreateIndex
CREATE INDEX "SponsoredDeviceAssignment_orgId_clientId_status_idx" ON "SponsoredDeviceAssignment"("orgId", "clientId", "status");

-- CreateIndex
CREATE INDEX "SponsoredDeviceAssignment_clientMemberId_idx" ON "SponsoredDeviceAssignment"("clientMemberId");

-- CreateIndex
CREATE INDEX "SponsoredDeviceAssignment_userId_idx" ON "SponsoredDeviceAssignment"("userId");

-- CreateIndex
CREATE INDEX "SponsoredDeviceAssignment_patientId_idx" ON "SponsoredDeviceAssignment"("patientId");

-- CreateIndex
CREATE INDEX "SponsoredDeviceAssignment_userDeviceId_idx" ON "SponsoredDeviceAssignment"("userDeviceId");

-- CreateIndex
CREATE INDEX "Allergy_patientId_status_idx" ON "Allergy"("patientId", "status");

-- CreateIndex
CREATE INDEX "Allergy_patientId_recordedAt_idx" ON "Allergy"("patientId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "Allergy_patientId_severity_idx" ON "Allergy"("patientId", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "Allergy_patientId_substance_reaction_key" ON "Allergy"("patientId", "substance", "reaction");

-- CreateIndex
CREATE INDEX "Appointment_clientId_startsAt_idx" ON "Appointment"("clientId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_clientMemberId_startsAt_idx" ON "Appointment"("clientMemberId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_coverageAuthorizationId_idx" ON "Appointment"("coverageAuthorizationId");

-- CreateIndex
CREATE INDEX "CarePortOrder_clientId_createdAt_idx" ON "CarePortOrder"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "CarePortOrder_clientMemberId_createdAt_idx" ON "CarePortOrder"("clientMemberId", "createdAt");

-- CreateIndex
CREATE INDEX "CarePortOrder_coverageAuthorizationId_idx" ON "CarePortOrder"("coverageAuthorizationId");

-- CreateIndex
CREATE INDEX "Delivery_clientId_idx" ON "Delivery"("clientId");

-- CreateIndex
CREATE INDEX "Delivery_clientMemberId_idx" ON "Delivery"("clientMemberId");

-- CreateIndex
CREATE INDEX "Delivery_coverageAuthorizationId_idx" ON "Delivery"("coverageAuthorizationId");

-- CreateIndex
CREATE INDEX "Delivery_billableEventId_idx" ON "Delivery"("billableEventId");

-- CreateIndex
CREATE INDEX "Draw_clientId_idx" ON "Draw"("clientId");

-- CreateIndex
CREATE INDEX "Draw_clientMemberId_idx" ON "Draw"("clientMemberId");

-- CreateIndex
CREATE INDEX "Draw_coverageAuthorizationId_idx" ON "Draw"("coverageAuthorizationId");

-- CreateIndex
CREATE INDEX "Draw_billableEventId_idx" ON "Draw"("billableEventId");

-- CreateIndex
CREATE INDEX "Encounter_clientId_idx" ON "Encounter"("clientId");

-- CreateIndex
CREATE INDEX "Encounter_clientMemberId_idx" ON "Encounter"("clientMemberId");

-- CreateIndex
CREATE INDEX "MedReachOrderFinancial_clientId_createdAt_idx" ON "MedReachOrderFinancial"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "MedReachOrderFinancial_clientMemberId_createdAt_idx" ON "MedReachOrderFinancial"("clientMemberId", "createdAt");

-- CreateIndex
CREATE INDEX "MedReachOrderFinancial_authorizationId_idx" ON "MedReachOrderFinancial"("authorizationId");

-- CreateIndex
CREATE INDEX "Payment_clientId_idx" ON "Payment"("clientId");

-- CreateIndex
CREATE INDEX "Payment_billableEventId_idx" ON "Payment"("billableEventId");

-- CreateIndex
CREATE INDEX "Payment_settlementRecordId_idx" ON "Payment"("settlementRecordId");

-- CreateIndex
CREATE INDEX "UserDevice_fundingSourceType_fundingSourceId_idx" ON "UserDevice"("fundingSourceType", "fundingSourceId");

-- CreateIndex
CREATE INDEX "UserDevice_sponsoredProgramId_idx" ON "UserDevice"("sponsoredProgramId");

-- CreateIndex
CREATE INDEX "UserDevice_sponsoredAssignmentId_idx" ON "UserDevice"("sponsoredAssignmentId");

-- AddForeignKey
ALTER TABLE "Allergy" ADD CONSTRAINT "Allergy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllergyReactionLog" ADD CONSTRAINT "AllergyReactionLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientDocument" ADD CONSTRAINT "PatientDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientDocument" ADD CONSTRAINT "PatientDocument_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProgram" ADD CONSTRAINT "ClientProgram_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoveragePlan" ADD CONSTRAINT "CoveragePlan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoveragePlan" ADD CONSTRAINT "CoveragePlan_clientProgramId_fkey" FOREIGN KEY ("clientProgramId") REFERENCES "ClientProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageServiceRule" ADD CONSTRAINT "CoverageServiceRule_coveragePlanId_fkey" FOREIGN KEY ("coveragePlanId") REFERENCES "CoveragePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMember" ADD CONSTRAINT "ClientMember_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMember" ADD CONSTRAINT "ClientMember_clientProgramId_fkey" FOREIGN KEY ("clientProgramId") REFERENCES "ClientProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMember" ADD CONSTRAINT "ClientMember_coveragePlanId_fkey" FOREIGN KEY ("coveragePlanId") REFERENCES "CoveragePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicianClientContract" ADD CONSTRAINT "ClinicianClientContract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageAuthorization" ADD CONSTRAINT "CoverageAuthorization_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageAuthorization" ADD CONSTRAINT "CoverageAuthorization_coveragePlanId_fkey" FOREIGN KEY ("coveragePlanId") REFERENCES "CoveragePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageAuthorization" ADD CONSTRAINT "CoverageAuthorization_clientMemberId_fkey" FOREIGN KEY ("clientMemberId") REFERENCES "ClientMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillableEvent" ADD CONSTRAINT "BillableEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillableEvent" ADD CONSTRAINT "BillableEvent_clientMemberId_fkey" FOREIGN KEY ("clientMemberId") REFERENCES "ClientMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillableEvent" ADD CONSTRAINT "BillableEvent_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "CoverageAuthorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientClaim" ADD CONSTRAINT "ClientClaim_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientClaimLine" ADD CONSTRAINT "ClientClaimLine_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ClientClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientClaimLine" ADD CONSTRAINT "ClientClaimLine_billableEventId_fkey" FOREIGN KEY ("billableEventId") REFERENCES "BillableEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementRecord" ADD CONSTRAINT "SettlementRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementRecord" ADD CONSTRAINT "SettlementRecord_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ClientClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementLine" ADD CONSTRAINT "SettlementLine_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "SettlementRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementLine" ADD CONSTRAINT "SettlementLine_billableEventId_fkey" FOREIGN KEY ("billableEventId") REFERENCES "BillableEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientWalletAccount" ADD CONSTRAINT "ClientWalletAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientWalletTransaction" ADD CONSTRAINT "ClientWalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ClientWalletAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientConsentPolicy" ADD CONSTRAINT "ClientConsentPolicy_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientConsentGrant" ADD CONSTRAINT "ClientConsentGrant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsoredDeviceProgram" ADD CONSTRAINT "SponsoredDeviceProgram_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsoredDeviceAssignment" ADD CONSTRAINT "SponsoredDeviceAssignment_sponsoredDeviceProgramId_fkey" FOREIGN KEY ("sponsoredDeviceProgramId") REFERENCES "SponsoredDeviceProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsoredDeviceAssignment" ADD CONSTRAINT "SponsoredDeviceAssignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsoredDeviceAssignment" ADD CONSTRAINT "SponsoredDeviceAssignment_clientMemberId_fkey" FOREIGN KEY ("clientMemberId") REFERENCES "ClientMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
