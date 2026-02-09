/*
  Warnings:

  - The `meta` column on the `Payment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `payload` column on the `RuntimeEvent` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `durationMin` on the `Televisit` table. All the data in the column will be lost.
  - You are about to drop the column `joinCloseLagSec` on the `Televisit` table. All the data in the column will be lost.
  - You are about to drop the column `joinOpenLeadSec` on the `Televisit` table. All the data in the column will be lost.
  - You are about to drop the column `startsAtMs` on the `Televisit` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Televisit` table. All the data in the column will be lost.
  - You are about to drop the `Ticket` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[roomId]` on the table `Televisit` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `joinClosesAt` to the `Televisit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `joinOpensAt` to the `Televisit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roomId` to the `Televisit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scheduledEndAt` to the `Televisit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scheduledStartAt` to the `Televisit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Televisit` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ClinicianFeeKind" AS ENUM ('STANDARD', 'FOLLOWUP', 'PROCEDURE');

-- CreateEnum
CREATE TYPE "TelevisitStatus" AS ENUM ('planned', 'live', 'ended', 'cancelled', 'archived');

-- CreateEnum
CREATE TYPE "TelevisitRole" AS ENUM ('patient', 'clinician', 'staff', 'observer', 'admin');

-- CreateEnum
CREATE TYPE "PresenceActorType" AS ENUM ('PATIENT', 'CLINICIAN', 'PHLEB', 'RIDER', 'SHOPPER', 'ADMIN', 'CLINICIAN_STAFF_MEDICAL', 'CLINICIAN_STAFF_NON_MEDICAL');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('PATIENT', 'CLINICIAN', 'PHLEB', 'RIDER', 'SHOPPER', 'ADMIN', 'CLINICIAN_STAFF_MEDICAL', 'CLINICIAN_STAFF_NON_MEDICAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "OrgRoleRequestStatus" AS ENUM ('pending', 'approved', 'denied');

-- CreateEnum
CREATE TYPE "FamilyRelationType" AS ENUM ('SELF', 'SPOUSE', 'PARTNER', 'PARENT', 'CHILD', 'GUARDIAN', 'DEPENDANT', 'FRIEND', 'CARE_ALLY', 'OTHER');

-- CreateEnum
CREATE TYPE "FamilyRelationDirection" AS ENUM ('HOST_TO_SUBJECT', 'MUTUAL');

-- CreateEnum
CREATE TYPE "FamilyRelationshipStatus" AS ENUM ('PENDING_HOST', 'PENDING_SUBJECT', 'ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FamilyInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FxRateSource" AS ENUM ('manual', 'auto');

-- CreateEnum
CREATE TYPE "FxRateStatus" AS ENUM ('active', 'superseded', 'archived');

-- CreateEnum
CREATE TYPE "WalletScope" AS ENUM ('SHOP', 'PLAN', 'APPOINTMENT');

-- CreateEnum
CREATE TYPE "WalletHoldStatus" AS ENUM ('HELD', 'CAPTURED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WalletEntryKind" AS ENUM ('CREDIT', 'DEBIT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "VoucherKind" AS ENUM ('CREDIT', 'PLAN_INTENT', 'FREE_CONSULT');

-- CreateEnum
CREATE TYPE "VoucherSponsorType" AS ENUM ('PLATFORM', 'CLINICIAN');

-- CreateEnum
CREATE TYPE "SurgicalCaseStatus" AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "SurgicalPriority" AS ENUM ('routine', 'urgent', 'emergency');

-- CreateEnum
CREATE TYPE "ShopChannel" AS ENUM ('CLINICIAN', 'PATIENT', 'MEDREACH', 'CAREPORT');

-- CreateEnum
CREATE TYPE "ShopOrderStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "RoleRequestStatus" AS ENUM ('pending', 'approved', 'denied');

-- AlterTable
ALTER TABLE "ClinicianProfile" ADD COLUMN     "acceptedSchemes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "acceptsMedicalAid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "practiceName" TEXT,
ADD COLUMN     "practiceNumber" TEXT,
ADD COLUMN     "regulatorBody" TEXT,
ADD COLUMN     "regulatorRegistration" TEXT;

-- AlterTable
ALTER TABLE "Delivery" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Draw" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "PatientProfile" ADD COLUMN     "gender" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "meta",
ADD COLUMN     "meta" JSONB;

-- AlterTable
ALTER TABLE "Payout" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "RuntimeEvent" ADD COLUMN     "severity" TEXT,
DROP COLUMN "payload",
ADD COLUMN     "payload" JSONB;

-- AlterTable
ALTER TABLE "Televisit" DROP COLUMN "durationMin",
DROP COLUMN "joinCloseLagSec",
DROP COLUMN "joinOpenLeadSec",
DROP COLUMN "startsAtMs",
DROP COLUMN "title",
ADD COLUMN     "appointmentId" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "encounterId" TEXT,
ADD COLUMN     "joinClosesAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "joinOpensAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "orgId" TEXT NOT NULL DEFAULT 'org-default',
ADD COLUMN     "roomId" TEXT NOT NULL,
ADD COLUMN     "scheduledEndAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "scheduledStartAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "status" "TelevisitStatus" NOT NULL DEFAULT 'planned',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "public"."Ticket";

-- CreateTable
CREATE TABLE "OrganizationSettings" (
    "orgId" TEXT NOT NULL,
    "defaultCountry" VARCHAR(2) NOT NULL DEFAULT 'ZA',
    "defaultLocale" VARCHAR(12) NOT NULL DEFAULT 'en-ZA',
    "defaultCurrency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "supportedLocales" TEXT[] DEFAULT ARRAY['en-ZA', 'fr-FR', 'pt-PT', 'af-ZA']::TEXT[],
    "supportedCurrencies" TEXT[] DEFAULT ARRAY['ZAR', 'USD', 'EUR']::TEXT[],
    "weekStartsOn" TEXT NOT NULL DEFAULT 'monday',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "OrganizationSettings_pkey" PRIMARY KEY ("orgId")
);

-- CreateTable
CREATE TABLE "UserLocalePreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "country" VARCHAR(2),
    "locale" VARCHAR(12),
    "currency" VARCHAR(3),
    "timezone" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',

    CONSTRAINT "UserLocalePreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicianFee" (
    "id" TEXT NOT NULL,
    "clinicianUserId" TEXT NOT NULL,
    "kind" "ClinicianFeeKind" NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicianFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelevisitJoinTicket" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "role" "TelevisitRole" NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "ipHash" VARCHAR(128),
    "userAgent" TEXT,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',

    CONSTRAINT "TelevisitJoinTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelevisitConsent" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "role" "TelevisitRole" NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "consentDocHash" VARCHAR(128) NOT NULL,
    "scopes" JSONB NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locale" TEXT,
    "ipHash" VARCHAR(128),
    "userAgent" TEXT,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',

    CONSTRAINT "TelevisitConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthCredential" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "actorType" "PresenceActorType" NOT NULL DEFAULT 'PATIENT',
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "requestedByIp" TEXT,
    "requestedByUa" TEXT,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresenceSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorType" "PresenceActorType" NOT NULL,
    "actorRefId" TEXT,
    "app" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "ipCountry" TEXT,
    "ipCity" TEXT,
    "userAgent" TEXT,
    "meta" JSONB,

    CONSTRAINT "PresenceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "actorType" "AuditActorType" NOT NULL,
    "actorRefId" TEXT,
    "app" TEXT NOT NULL,
    "sessionId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "description" TEXT,
    "ip" TEXT,
    "ipCountry" TEXT,
    "ipCity" TEXT,
    "userAgent" TEXT,
    "meta" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgDepartment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgDesignation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgDesignation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgRole" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgRoleScope" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgRoleScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgUser" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "externalUserId" TEXT NOT NULL,
    "email" VARCHAR(320),
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "departmentId" TEXT,
    "designationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgUserRole" (
    "id" TEXT NOT NULL,
    "orgUserId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "grantedBy" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "OrgUserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgDesignationRole" (
    "id" TEXT NOT NULL,
    "designationId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgDesignationRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgRoleRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "status" "OrgRoleRequestStatus" NOT NULL DEFAULT 'pending',
    "requesterEmail" VARCHAR(320) NOT NULL,
    "requesterName" TEXT,
    "orgUserId" TEXT,
    "departmentId" TEXT,
    "designationId" TEXT,
    "reason" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgRoleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgRoleRequestRole" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "OrgRoleRequestRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalAidPolicy" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "schemeName" TEXT NOT NULL,
    "planName" TEXT,
    "membershipNumber" TEXT NOT NULL,
    "dependentCode" TEXT,
    "principalName" TEXT,
    "coversTelemedicine" BOOLEAN NOT NULL DEFAULT true,
    "telemedicineCoverType" TEXT NOT NULL DEFAULT 'full',
    "coPaymentType" TEXT,
    "coPaymentValue" INTEGER,
    "notes" TEXT,
    "comFileOriginalName" TEXT,
    "comFileStoredAs" TEXT,
    "hasCom" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalAidPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyRelationship" (
    "id" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "subjectPatientId" TEXT NOT NULL,
    "subjectUserId" TEXT,
    "relationType" "FamilyRelationType" NOT NULL,
    "direction" "FamilyRelationDirection" NOT NULL,
    "status" "FamilyRelationshipStatus" NOT NULL DEFAULT 'ACTIVE',
    "permissions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,

    CONSTRAINT "FamilyRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyInvitation" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "relationType" "FamilyRelationType" NOT NULL,
    "direction" "FamilyRelationDirection" NOT NULL DEFAULT 'HOST_TO_SUBJECT',
    "subjectPatientId" TEXT,
    "subjectName" TEXT,
    "subjectDob" TIMESTAMP(3),
    "subjectCategory" TEXT,
    "invitedEmail" TEXT,
    "invitedPhone" TEXT,
    "status" "FamilyInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL,
    "base" VARCHAR(3) NOT NULL,
    "quote" VARCHAR(3) NOT NULL,
    "rate" DECIMAL(20,10) NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "source" "FxRateSource" NOT NULL DEFAULT 'manual',
    "status" "FxRateStatus" NOT NULL DEFAULT 'active',
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FxAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "base" VARCHAR(3) NOT NULL,
    "note" TEXT,
    "requestId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "changesJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FxAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "balanceZar" INTEGER NOT NULL DEFAULT 0,
    "heldZar" INTEGER NOT NULL DEFAULT 0,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletEntry" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "kind" "WalletEntryKind" NOT NULL,
    "scope" "WalletScope",
    "amountZar" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "sponsorType" "VoucherSponsorType",
    "sponsorId" TEXT,
    "voucherId" TEXT,
    "holdId" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "txRef" TEXT,
    "meta" JSONB,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletHold" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "scope" "WalletScope" NOT NULL,
    "amountZar" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "status" "WalletHoldStatus" NOT NULL DEFAULT 'HELD',
    "txRef" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',

    CONSTRAINT "WalletHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeLast4" TEXT NOT NULL,
    "kind" "VoucherKind" NOT NULL,
    "valueZar" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "sponsorType" "VoucherSponsorType" NOT NULL,
    "sponsorId" TEXT,
    "constraints" JSONB,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "sponsorHoldId" TEXT,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoucherCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherRedemption" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creditedZar" INTEGER NOT NULL,
    "walletEntryId" TEXT,
    "meta" JSONB,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoToken" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'consult',
    "description" TEXT,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "patientId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalFinding" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "clinicianId" TEXT,
    "specialty" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "note" TEXT,
    "severity" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "location" JSONB NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',

    CONSTRAINT "ClinicalFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalEvidence" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "clinicianId" TEXT,
    "specialty" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "findingId" TEXT,
    "location" JSONB NOT NULL,
    "source" JSONB NOT NULL,
    "media" JSONB NOT NULL,
    "capturedAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',

    CONSTRAINT "ClinicalEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalAnnotation" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "clinicianId" TEXT,
    "specialty" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "findingId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "location" JSONB NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',

    CONSTRAINT "ClinicalAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalArtifact" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "clinicianId" TEXT,
    "specialty" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "payload" JSONB NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',

    CONSTRAINT "ClinicalArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurgicalCase" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT,
    "specialtyDomain" TEXT NOT NULL,
    "priority" "SurgicalPriority" NOT NULL DEFAULT 'routine',
    "status" "SurgicalCaseStatus" NOT NULL DEFAULT 'planned',
    "preOpDiagnosis" TEXT,
    "indication" TEXT,
    "risksNotes" TEXT,
    "allergyNotes" TEXT,
    "medicationNotes" TEXT,
    "checklist" JSONB,
    "procedureNote" JSONB,
    "postOpPlan" JSONB,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurgicalCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurgicalProcedureEvent" (
    "id" TEXT NOT NULL,
    "surgicalCaseId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "payload" JSONB,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurgicalProcedureEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopProduct" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'merch',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fallbackImage" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "unitAmountZar" INTEGER,
    "saleAmountZar" INTEGER,
    "allowBackorder" BOOLEAN NOT NULL DEFAULT false,
    "maxQtyPerOrder" INTEGER NOT NULL DEFAULT 99,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "unitAmountZar" INTEGER NOT NULL,
    "saleUnitAmountZar" INTEGER,
    "imageUrl" TEXT,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "stockQty" INTEGER,
    "allowBackorder" BOOLEAN,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopProductChannel" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "channel" "ShopChannel" NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',

    CONSTRAINT "ShopProductChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopVariantChannel" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "channel" "ShopChannel" NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',

    CONSTRAINT "ShopVariantChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopInventoryMovement" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',

    CONSTRAINT "ShopInventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopOrder" (
    "id" TEXT NOT NULL,
    "status" "ShopOrderStatus" NOT NULL DEFAULT 'PENDING',
    "channel" "ShopChannel" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "subtotalZar" INTEGER NOT NULL DEFAULT 0,
    "shippingZar" INTEGER NOT NULL DEFAULT 0,
    "discountZar" INTEGER NOT NULL DEFAULT 0,
    "totalZar" INTEGER NOT NULL DEFAULT 0,
    "promoCode" TEXT,
    "customerEmail" TEXT,
    "shippingAddress" JSONB,
    "provider" TEXT NOT NULL DEFAULT 'paystack',
    "sessionId" TEXT,
    "receiptUrl" TEXT,
    "providerMeta" JSONB,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "ShopOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "unitAmountZar" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',

    CONSTRAINT "ShopOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Designation" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Designation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleScope" (
    "roleId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,

    CONSTRAINT "RoleScope_pkey" PRIMARY KEY ("roleId","scope")
);

-- CreateTable
CREATE TABLE "DesignationRole" (
    "designationId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "DesignationRole_pkey" PRIMARY KEY ("designationId","roleId")
);

-- CreateTable
CREATE TABLE "AdminUserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "departmentId" TEXT,
    "designationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "departmentId" TEXT,
    "designationId" TEXT,
    "status" "RoleRequestStatus" NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleRequestRole" (
    "roleRequestId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "RoleRequestRole_pkey" PRIMARY KEY ("roleRequestId","roleId")
);

-- CreateTable
CREATE TABLE "EncounterDiagnosis" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT,
    "icd10" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "syndrome" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EncounterDiagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabResult" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT,
    "loincCode" TEXT,
    "name" TEXT NOT NULL,
    "isPositive" BOOLEAN,
    "valueNum" DOUBLE PRECISION,
    "unit" TEXT,
    "flag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Icd10SyndromeMap" (
    "id" TEXT NOT NULL,
    "codeFrom" TEXT NOT NULL,
    "codeTo" TEXT NOT NULL,
    "syndrome" TEXT NOT NULL,
    "comment" TEXT,

    CONSTRAINT "Icd10SyndromeMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PopulationStat" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT,
    "district" TEXT,
    "postalCode" TEXT,
    "year" INTEGER NOT NULL,
    "population" INTEGER NOT NULL,

    CONSTRAINT "PopulationStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicianOnboarding" (
    "id" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentPlan" TEXT,
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "nextPaymentAt" TIMESTAMP(3),
    "trainingSlotId" TEXT,
    "trainingNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicianOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicianTrainingSlot" (
    "id" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "mode" TEXT NOT NULL DEFAULT 'virtual',
    "meetingUrl" TEXT,
    "trainerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicianTrainingSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicianDispatch" (
    "id" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "courier" TEXT NOT NULL,
    "trackingCode" TEXT NOT NULL,
    "trackingUrl" TEXT,
    "etaDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'prepared',
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "notes" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "notifiedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicianDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicianDispatchItem" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "deviceId" TEXT,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "isShipped" BOOLEAN NOT NULL DEFAULT true,
    "sku" VARCHAR(64),
    "serialNumber" VARCHAR(128),

    CONSTRAINT "ClinicianDispatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsightCoreHeatmap" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT,
    "district" TEXT,
    "postalCode" TEXT,
    "syndrome" TEXT NOT NULL,
    "ageBand" TEXT,
    "gender" TEXT,
    "encounterCount" INTEGER NOT NULL DEFAULT 0,
    "finalDiagnosisCount" INTEGER NOT NULL DEFAULT 0,
    "ruledOutCount" INTEGER NOT NULL DEFAULT 0,
    "distinctPatients" INTEGER NOT NULL DEFAULT 0,
    "positiveLabCount" INTEGER NOT NULL DEFAULT 0,
    "alertCount" INTEGER NOT NULL DEFAULT 0,
    "population" INTEGER,
    "incidencePer100k" DOUBLE PRECISION,
    "alertRatePer100k" DOUBLE PRECISION,
    "riskScore" DOUBLE PRECISION,
    "trendVsPrevWeek" DOUBLE PRECISION,
    "zScore" DOUBLE PRECISION,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsightCoreHeatmap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserLocalePreference_userId_key" ON "UserLocalePreference"("userId");

-- CreateIndex
CREATE INDEX "UserLocalePreference_orgId_idx" ON "UserLocalePreference"("orgId");

-- CreateIndex
CREATE INDEX "ClinicianFee_clinicianUserId_kind_currency_active_idx" ON "ClinicianFee"("clinicianUserId", "kind", "currency", "active");

-- CreateIndex
CREATE INDEX "ClinicianFee_orgId_idx" ON "ClinicianFee"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "TelevisitJoinTicket_tokenHash_key" ON "TelevisitJoinTicket"("tokenHash");

-- CreateIndex
CREATE INDEX "TelevisitJoinTicket_visitId_uid_role_idx" ON "TelevisitJoinTicket"("visitId", "uid", "role");

-- CreateIndex
CREATE INDEX "TelevisitJoinTicket_expiresAt_idx" ON "TelevisitJoinTicket"("expiresAt");

-- CreateIndex
CREATE INDEX "TelevisitJoinTicket_orgId_idx" ON "TelevisitJoinTicket"("orgId");

-- CreateIndex
CREATE INDEX "TelevisitConsent_visitId_uid_role_idx" ON "TelevisitConsent"("visitId", "uid", "role");

-- CreateIndex
CREATE INDEX "TelevisitConsent_orgId_idx" ON "TelevisitConsent"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "TelevisitConsent_visitId_uid_role_consentVersion_key" ON "TelevisitConsent"("visitId", "uid", "role", "consentVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AuthCredential_email_key" ON "AuthCredential"("email");

-- CreateIndex
CREATE INDEX "AuthCredential_actorType_idx" ON "AuthCredential"("actorType");

-- CreateIndex
CREATE INDEX "AuthCredential_orgId_idx" ON "AuthCredential"("orgId");

-- CreateIndex
CREATE INDEX "AuthCredential_email_disabled_idx" ON "AuthCredential"("email", "disabled");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_email_expiresAt_idx" ON "PasswordResetToken"("email", "expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_orgId_createdAt_idx" ON "PasswordResetToken"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "PresenceSession_actorType_lastSeenAt_idx" ON "PresenceSession"("actorType", "lastSeenAt");

-- CreateIndex
CREATE INDEX "PresenceSession_userId_startedAt_idx" ON "PresenceSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "PresenceSession_actorType_app_lastSeenAt_idx" ON "PresenceSession"("actorType", "app", "lastSeenAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorType_createdAt_idx" ON "AuditLog"("actorType", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "OrgDepartment_orgId_active_idx" ON "OrgDepartment"("orgId", "active");

-- CreateIndex
CREATE INDEX "OrgDepartment_orgId_name_idx" ON "OrgDepartment"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "OrgDepartment_orgId_name_key" ON "OrgDepartment"("orgId", "name");

-- CreateIndex
CREATE INDEX "OrgDesignation_orgId_departmentId_active_idx" ON "OrgDesignation"("orgId", "departmentId", "active");

-- CreateIndex
CREATE INDEX "OrgDesignation_departmentId_idx" ON "OrgDesignation"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgDesignation_orgId_departmentId_name_key" ON "OrgDesignation"("orgId", "departmentId", "name");

-- CreateIndex
CREATE INDEX "OrgRole_orgId_active_idx" ON "OrgRole"("orgId", "active");

-- CreateIndex
CREATE INDEX "OrgRole_orgId_name_idx" ON "OrgRole"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "OrgRole_orgId_name_key" ON "OrgRole"("orgId", "name");

-- CreateIndex
CREATE INDEX "OrgRoleScope_scope_idx" ON "OrgRoleScope"("scope");

-- CreateIndex
CREATE INDEX "OrgRoleScope_roleId_idx" ON "OrgRoleScope"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgRoleScope_roleId_scope_key" ON "OrgRoleScope"("roleId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "OrgUser_externalUserId_key" ON "OrgUser"("externalUserId");

-- CreateIndex
CREATE INDEX "OrgUser_orgId_active_idx" ON "OrgUser"("orgId", "active");

-- CreateIndex
CREATE INDEX "OrgUser_orgId_email_idx" ON "OrgUser"("orgId", "email");

-- CreateIndex
CREATE INDEX "OrgUser_departmentId_idx" ON "OrgUser"("departmentId");

-- CreateIndex
CREATE INDEX "OrgUser_designationId_idx" ON "OrgUser"("designationId");

-- CreateIndex
CREATE INDEX "OrgUserRole_roleId_idx" ON "OrgUserRole"("roleId");

-- CreateIndex
CREATE INDEX "OrgUserRole_orgUserId_idx" ON "OrgUserRole"("orgUserId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgUserRole_orgUserId_roleId_key" ON "OrgUserRole"("orgUserId", "roleId");

-- CreateIndex
CREATE INDEX "OrgDesignationRole_roleId_idx" ON "OrgDesignationRole"("roleId");

-- CreateIndex
CREATE INDEX "OrgDesignationRole_designationId_idx" ON "OrgDesignationRole"("designationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgDesignationRole_designationId_roleId_key" ON "OrgDesignationRole"("designationId", "roleId");

-- CreateIndex
CREATE INDEX "OrgRoleRequest_orgId_status_createdAt_idx" ON "OrgRoleRequest"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "OrgRoleRequest_requesterEmail_idx" ON "OrgRoleRequest"("requesterEmail");

-- CreateIndex
CREATE INDEX "OrgRoleRequest_orgUserId_idx" ON "OrgRoleRequest"("orgUserId");

-- CreateIndex
CREATE INDEX "OrgRoleRequestRole_roleId_idx" ON "OrgRoleRequestRole"("roleId");

-- CreateIndex
CREATE INDEX "OrgRoleRequestRole_requestId_idx" ON "OrgRoleRequestRole"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgRoleRequestRole_requestId_roleId_key" ON "OrgRoleRequestRole"("requestId", "roleId");

-- CreateIndex
CREATE INDEX "MedicalAidPolicy_patientId_idx" ON "MedicalAidPolicy"("patientId");

-- CreateIndex
CREATE INDEX "MedicalAidPolicy_schemeName_idx" ON "MedicalAidPolicy"("schemeName");

-- CreateIndex
CREATE INDEX "MedicalAidPolicy_membershipNumber_idx" ON "MedicalAidPolicy"("membershipNumber");

-- CreateIndex
CREATE INDEX "MedicalAidPolicy_patientId_isDefault_idx" ON "MedicalAidPolicy"("patientId", "isDefault");

-- CreateIndex
CREATE INDEX "FamilyRelationship_hostUserId_idx" ON "FamilyRelationship"("hostUserId");

-- CreateIndex
CREATE INDEX "FamilyRelationship_subjectPatientId_idx" ON "FamilyRelationship"("subjectPatientId");

-- CreateIndex
CREATE INDEX "FamilyRelationship_subjectUserId_idx" ON "FamilyRelationship"("subjectUserId");

-- CreateIndex
CREATE INDEX "FamilyRelationship_status_idx" ON "FamilyRelationship"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyInvitation_token_key" ON "FamilyInvitation"("token");

-- CreateIndex
CREATE INDEX "FamilyInvitation_hostUserId_idx" ON "FamilyInvitation"("hostUserId");

-- CreateIndex
CREATE INDEX "FamilyInvitation_invitedEmail_idx" ON "FamilyInvitation"("invitedEmail");

-- CreateIndex
CREATE INDEX "FamilyInvitation_status_idx" ON "FamilyInvitation"("status");

-- CreateIndex
CREATE INDEX "FamilyInvitation_expiresAt_idx" ON "FamilyInvitation"("expiresAt");

-- CreateIndex
CREATE INDEX "FxRate_base_quote_status_asOf_idx" ON "FxRate"("base", "quote", "status", "asOf");

-- CreateIndex
CREATE INDEX "FxRate_base_quote_source_asOf_idx" ON "FxRate"("base", "quote", "source", "asOf");

-- CreateIndex
CREATE INDEX "FxAuditLog_base_createdAt_idx" ON "FxAuditLog"("base", "createdAt");

-- CreateIndex
CREATE INDEX "FxAuditLog_actorEmail_createdAt_idx" ON "FxAuditLog"("actorEmail", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WalletAccount_userId_key" ON "WalletAccount"("userId");

-- CreateIndex
CREATE INDEX "WalletAccount_orgId_idx" ON "WalletAccount"("orgId");

-- CreateIndex
CREATE INDEX "WalletEntry_accountId_createdAt_idx" ON "WalletEntry"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletEntry_txRef_idx" ON "WalletEntry"("txRef");

-- CreateIndex
CREATE INDEX "WalletEntry_voucherId_idx" ON "WalletEntry"("voucherId");

-- CreateIndex
CREATE INDEX "WalletEntry_orgId_idx" ON "WalletEntry"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletHold_txRef_key" ON "WalletHold"("txRef");

-- CreateIndex
CREATE INDEX "WalletHold_accountId_status_idx" ON "WalletHold"("accountId", "status");

-- CreateIndex
CREATE INDEX "WalletHold_orgId_idx" ON "WalletHold"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherCode_codeHash_key" ON "VoucherCode"("codeHash");

-- CreateIndex
CREATE INDEX "VoucherCode_active_expiresAt_idx" ON "VoucherCode"("active", "expiresAt");

-- CreateIndex
CREATE INDEX "VoucherCode_kind_idx" ON "VoucherCode"("kind");

-- CreateIndex
CREATE INDEX "VoucherCode_sponsorType_sponsorId_idx" ON "VoucherCode"("sponsorType", "sponsorId");

-- CreateIndex
CREATE INDEX "VoucherCode_orgId_idx" ON "VoucherCode"("orgId");

-- CreateIndex
CREATE INDEX "VoucherRedemption_voucherId_redeemedAt_idx" ON "VoucherRedemption"("voucherId", "redeemedAt");

-- CreateIndex
CREATE INDEX "VoucherRedemption_userId_redeemedAt_idx" ON "VoucherRedemption"("userId", "redeemedAt");

-- CreateIndex
CREATE INDEX "VoucherRedemption_orgId_idx" ON "VoucherRedemption"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "PromoToken_code_key" ON "PromoToken"("code");

-- CreateIndex
CREATE INDEX "PromoToken_code_idx" ON "PromoToken"("code");

-- CreateIndex
CREATE INDEX "PromoToken_active_expiresAt_idx" ON "PromoToken"("active", "expiresAt");

-- CreateIndex
CREATE INDEX "ClinicalFinding_orgId_idx" ON "ClinicalFinding"("orgId");

-- CreateIndex
CREATE INDEX "ClinicalFinding_encounterId_updatedAt_idx" ON "ClinicalFinding"("encounterId", "updatedAt");

-- CreateIndex
CREATE INDEX "ClinicalFinding_patientId_updatedAt_idx" ON "ClinicalFinding"("patientId", "updatedAt");

-- CreateIndex
CREATE INDEX "ClinicalFinding_specialty_updatedAt_idx" ON "ClinicalFinding"("specialty", "updatedAt");

-- CreateIndex
CREATE INDEX "ClinicalEvidence_orgId_idx" ON "ClinicalEvidence"("orgId");

-- CreateIndex
CREATE INDEX "ClinicalEvidence_encounterId_updatedAt_idx" ON "ClinicalEvidence"("encounterId", "updatedAt");

-- CreateIndex
CREATE INDEX "ClinicalEvidence_patientId_updatedAt_idx" ON "ClinicalEvidence"("patientId", "updatedAt");

-- CreateIndex
CREATE INDEX "ClinicalEvidence_findingId_updatedAt_idx" ON "ClinicalEvidence"("findingId", "updatedAt");

-- CreateIndex
CREATE INDEX "ClinicalEvidence_specialty_updatedAt_idx" ON "ClinicalEvidence"("specialty", "updatedAt");

-- CreateIndex
CREATE INDEX "ClinicalAnnotation_orgId_idx" ON "ClinicalAnnotation"("orgId");

-- CreateIndex
CREATE INDEX "ClinicalAnnotation_encounterId_createdAt_idx" ON "ClinicalAnnotation"("encounterId", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalAnnotation_patientId_createdAt_idx" ON "ClinicalAnnotation"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalAnnotation_evidenceId_createdAt_idx" ON "ClinicalAnnotation"("evidenceId", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalAnnotation_specialty_createdAt_idx" ON "ClinicalAnnotation"("specialty", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalArtifact_orgId_idx" ON "ClinicalArtifact"("orgId");

-- CreateIndex
CREATE INDEX "ClinicalArtifact_encounterId_updatedAt_idx" ON "ClinicalArtifact"("encounterId", "updatedAt");

-- CreateIndex
CREATE INDEX "ClinicalArtifact_patientId_updatedAt_idx" ON "ClinicalArtifact"("patientId", "updatedAt");

-- CreateIndex
CREATE INDEX "ClinicalArtifact_specialty_kind_updatedAt_idx" ON "ClinicalArtifact"("specialty", "kind", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalArtifact_orgId_encounterId_specialty_kind_key" ON "ClinicalArtifact"("orgId", "encounterId", "specialty", "kind");

-- CreateIndex
CREATE INDEX "SurgicalCase_encounterId_idx" ON "SurgicalCase"("encounterId");

-- CreateIndex
CREATE INDEX "SurgicalCase_patientId_idx" ON "SurgicalCase"("patientId");

-- CreateIndex
CREATE INDEX "SurgicalCase_clinicianId_idx" ON "SurgicalCase"("clinicianId");

-- CreateIndex
CREATE INDEX "SurgicalCase_specialtyDomain_priority_status_idx" ON "SurgicalCase"("specialtyDomain", "priority", "status");

-- CreateIndex
CREATE INDEX "SurgicalCase_orgId_createdAt_idx" ON "SurgicalCase"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "SurgicalProcedureEvent_surgicalCaseId_occurredAt_idx" ON "SurgicalProcedureEvent"("surgicalCaseId", "occurredAt");

-- CreateIndex
CREATE INDEX "SurgicalProcedureEvent_encounterId_occurredAt_idx" ON "SurgicalProcedureEvent"("encounterId", "occurredAt");

-- CreateIndex
CREATE INDEX "SurgicalProcedureEvent_patientId_occurredAt_idx" ON "SurgicalProcedureEvent"("patientId", "occurredAt");

-- CreateIndex
CREATE INDEX "SurgicalProcedureEvent_eventType_occurredAt_idx" ON "SurgicalProcedureEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "SurgicalProcedureEvent_orgId_occurredAt_idx" ON "SurgicalProcedureEvent"("orgId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopProduct_slug_key" ON "ShopProduct"("slug");

-- CreateIndex
CREATE INDEX "ShopProduct_orgId_idx" ON "ShopProduct"("orgId");

-- CreateIndex
CREATE INDEX "ShopProduct_active_updatedAt_idx" ON "ShopProduct"("active", "updatedAt");

-- CreateIndex
CREATE INDEX "ShopProduct_type_idx" ON "ShopProduct"("type");

-- CreateIndex
CREATE UNIQUE INDEX "ShopVariant_sku_key" ON "ShopVariant"("sku");

-- CreateIndex
CREATE INDEX "ShopVariant_productId_idx" ON "ShopVariant"("productId");

-- CreateIndex
CREATE INDEX "ShopVariant_orgId_idx" ON "ShopVariant"("orgId");

-- CreateIndex
CREATE INDEX "ShopVariant_active_idx" ON "ShopVariant"("active");

-- CreateIndex
CREATE INDEX "ShopVariant_inStock_idx" ON "ShopVariant"("inStock");

-- CreateIndex
CREATE INDEX "ShopProductChannel_channel_idx" ON "ShopProductChannel"("channel");

-- CreateIndex
CREATE INDEX "ShopProductChannel_orgId_idx" ON "ShopProductChannel"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopProductChannel_productId_channel_key" ON "ShopProductChannel"("productId", "channel");

-- CreateIndex
CREATE INDEX "ShopVariantChannel_channel_idx" ON "ShopVariantChannel"("channel");

-- CreateIndex
CREATE INDEX "ShopVariantChannel_orgId_idx" ON "ShopVariantChannel"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopVariantChannel_variantId_channel_key" ON "ShopVariantChannel"("variantId", "channel");

-- CreateIndex
CREATE INDEX "ShopInventoryMovement_variantId_createdAt_idx" ON "ShopInventoryMovement"("variantId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopInventoryMovement_orgId_createdAt_idx" ON "ShopInventoryMovement"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopOrder_sessionId_key" ON "ShopOrder"("sessionId");

-- CreateIndex
CREATE INDEX "ShopOrder_status_createdAt_idx" ON "ShopOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ShopOrder_channel_createdAt_idx" ON "ShopOrder"("channel", "createdAt");

-- CreateIndex
CREATE INDEX "ShopOrder_orgId_createdAt_idx" ON "ShopOrder"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopOrderItem_orderId_idx" ON "ShopOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "ShopOrderItem_productId_idx" ON "ShopOrderItem"("productId");

-- CreateIndex
CREATE INDEX "ShopOrderItem_sku_idx" ON "ShopOrderItem"("sku");

-- CreateIndex
CREATE INDEX "ShopOrderItem_orgId_idx" ON "ShopOrderItem"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Designation_departmentId_name_key" ON "Designation"("departmentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "RoleScope_scope_idx" ON "RoleScope"("scope");

-- CreateIndex
CREATE INDEX "DesignationRole_roleId_idx" ON "DesignationRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUserProfile_userId_key" ON "AdminUserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUserProfile_email_key" ON "AdminUserProfile"("email");

-- CreateIndex
CREATE INDEX "AdminUserProfile_departmentId_idx" ON "AdminUserProfile"("departmentId");

-- CreateIndex
CREATE INDEX "AdminUserProfile_designationId_idx" ON "AdminUserProfile"("designationId");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE INDEX "UserRole_adminUserId_idx" ON "UserRole"("adminUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_adminUserId_roleId_key" ON "UserRole"("adminUserId", "roleId");

-- CreateIndex
CREATE INDEX "RoleRequestRole_roleId_idx" ON "RoleRequestRole"("roleId");

-- CreateIndex
CREATE INDEX "EncounterDiagnosis_encounterId_idx" ON "EncounterDiagnosis"("encounterId");

-- CreateIndex
CREATE INDEX "EncounterDiagnosis_patientId_idx" ON "EncounterDiagnosis"("patientId");

-- CreateIndex
CREATE INDEX "EncounterDiagnosis_clinicianId_idx" ON "EncounterDiagnosis"("clinicianId");

-- CreateIndex
CREATE INDEX "EncounterDiagnosis_icd10_idx" ON "EncounterDiagnosis"("icd10");

-- CreateIndex
CREATE INDEX "EncounterDiagnosis_kind_idx" ON "EncounterDiagnosis"("kind");

-- CreateIndex
CREATE INDEX "EncounterDiagnosis_status_idx" ON "EncounterDiagnosis"("status");

-- CreateIndex
CREATE INDEX "EncounterDiagnosis_syndrome_idx" ON "EncounterDiagnosis"("syndrome");

-- CreateIndex
CREATE INDEX "EncounterDiagnosis_createdAt_idx" ON "EncounterDiagnosis"("createdAt");

-- CreateIndex
CREATE INDEX "EncounterDiagnosis_syndrome_createdAt_idx" ON "EncounterDiagnosis"("syndrome", "createdAt");

-- CreateIndex
CREATE INDEX "LabResult_encounterId_idx" ON "LabResult"("encounterId");

-- CreateIndex
CREATE INDEX "LabResult_patientId_idx" ON "LabResult"("patientId");

-- CreateIndex
CREATE INDEX "LabResult_loincCode_idx" ON "LabResult"("loincCode");

-- CreateIndex
CREATE INDEX "LabResult_createdAt_idx" ON "LabResult"("createdAt");

-- CreateIndex
CREATE INDEX "Icd10SyndromeMap_codeFrom_codeTo_idx" ON "Icd10SyndromeMap"("codeFrom", "codeTo");

-- CreateIndex
CREATE INDEX "Icd10SyndromeMap_syndrome_idx" ON "Icd10SyndromeMap"("syndrome");

-- CreateIndex
CREATE INDEX "PopulationStat_country_region_district_postalCode_year_idx" ON "PopulationStat"("country", "region", "district", "postalCode", "year");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicianOnboarding_clinicianId_key" ON "ClinicianOnboarding"("clinicianId");

-- CreateIndex
CREATE INDEX "ClinicianOnboarding_status_idx" ON "ClinicianOnboarding"("status");

-- CreateIndex
CREATE INDEX "ClinicianTrainingSlot_startsAt_idx" ON "ClinicianTrainingSlot"("startsAt");

-- CreateIndex
CREATE INDEX "ClinicianTrainingSlot_mode_idx" ON "ClinicianTrainingSlot"("mode");

-- CreateIndex
CREATE INDEX "ClinicianDispatch_clinicianId_idx" ON "ClinicianDispatch"("clinicianId");

-- CreateIndex
CREATE INDEX "ClinicianDispatch_courier_trackingCode_idx" ON "ClinicianDispatch"("courier", "trackingCode");

-- CreateIndex
CREATE INDEX "ClinicianDispatch_status_idx" ON "ClinicianDispatch"("status");

-- CreateIndex
CREATE INDEX "ClinicianDispatch_notifiedAt_idx" ON "ClinicianDispatch"("notifiedAt");

-- CreateIndex
CREATE INDEX "ClinicianDispatch_notifiedByUserId_idx" ON "ClinicianDispatch"("notifiedByUserId");

-- CreateIndex
CREATE INDEX "ClinicianDispatchItem_dispatchId_idx" ON "ClinicianDispatchItem"("dispatchId");

-- CreateIndex
CREATE INDEX "ClinicianDispatchItem_kind_idx" ON "ClinicianDispatchItem"("kind");

-- CreateIndex
CREATE INDEX "ClinicianDispatchItem_sku_idx" ON "ClinicianDispatchItem"("sku");

-- CreateIndex
CREATE INDEX "ClinicianDispatchItem_serialNumber_idx" ON "ClinicianDispatchItem"("serialNumber");

-- CreateIndex
CREATE INDEX "InsightCoreHeatmap_weekStart_country_region_district_syndro_idx" ON "InsightCoreHeatmap"("weekStart", "country", "region", "district", "syndrome");

-- CreateIndex
CREATE INDEX "InsightCoreHeatmap_country_region_district_weekStart_idx" ON "InsightCoreHeatmap"("country", "region", "district", "weekStart");

-- CreateIndex
CREATE INDEX "InsightCoreHeatmap_syndrome_weekStart_idx" ON "InsightCoreHeatmap"("syndrome", "weekStart");

-- CreateIndex
CREATE INDEX "InsightCoreHeatmap_riskScore_idx" ON "InsightCoreHeatmap"("riskScore");

-- CreateIndex
CREATE INDEX "InsightCoreHeatmap_alertCount_idx" ON "InsightCoreHeatmap"("alertCount");

-- CreateIndex
CREATE INDEX "PatientProfile_city_idx" ON "PatientProfile"("city");

-- CreateIndex
CREATE INDEX "PatientProfile_postalCode_idx" ON "PatientProfile"("postalCode");

-- CreateIndex
CREATE INDEX "RuntimeEvent_patientId_ts_idx" ON "RuntimeEvent"("patientId", "ts");

-- CreateIndex
CREATE INDEX "RuntimeEvent_encounterId_ts_idx" ON "RuntimeEvent"("encounterId", "ts");

-- CreateIndex
CREATE INDEX "RuntimeEvent_kind_severity_ts_idx" ON "RuntimeEvent"("kind", "severity", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "Televisit_roomId_key" ON "Televisit"("roomId");

-- CreateIndex
CREATE INDEX "Televisit_status_scheduledStartAt_idx" ON "Televisit"("status", "scheduledStartAt");

-- CreateIndex
CREATE INDEX "Televisit_roomId_joinOpensAt_joinClosesAt_idx" ON "Televisit"("roomId", "joinOpensAt", "joinClosesAt");

-- CreateIndex
CREATE INDEX "Televisit_orgId_idx" ON "Televisit"("orgId");

-- AddForeignKey
ALTER TABLE "ClinicianFee" ADD CONSTRAINT "ClinicianFee_clinicianUserId_fkey" FOREIGN KEY ("clinicianUserId") REFERENCES "ClinicianProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelevisitJoinTicket" ADD CONSTRAINT "TelevisitJoinTicket_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Televisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelevisitConsent" ADD CONSTRAINT "TelevisitConsent_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Televisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgDesignation" ADD CONSTRAINT "OrgDesignation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "OrgDepartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgRoleScope" ADD CONSTRAINT "OrgRoleScope_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "OrgRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUser" ADD CONSTRAINT "OrgUser_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "OrgDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUser" ADD CONSTRAINT "OrgUser_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "OrgDesignation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUserRole" ADD CONSTRAINT "OrgUserRole_orgUserId_fkey" FOREIGN KEY ("orgUserId") REFERENCES "OrgUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUserRole" ADD CONSTRAINT "OrgUserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "OrgRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgDesignationRole" ADD CONSTRAINT "OrgDesignationRole_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "OrgDesignation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgDesignationRole" ADD CONSTRAINT "OrgDesignationRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "OrgRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgRoleRequest" ADD CONSTRAINT "OrgRoleRequest_orgUserId_fkey" FOREIGN KEY ("orgUserId") REFERENCES "OrgUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgRoleRequest" ADD CONSTRAINT "OrgRoleRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "OrgDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgRoleRequest" ADD CONSTRAINT "OrgRoleRequest_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "OrgDesignation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgRoleRequestRole" ADD CONSTRAINT "OrgRoleRequestRole_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "OrgRoleRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgRoleRequestRole" ADD CONSTRAINT "OrgRoleRequestRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "OrgRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalAidPolicy" ADD CONSTRAINT "MedicalAidPolicy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyRelationship" ADD CONSTRAINT "FamilyRelationship_subjectPatientId_fkey" FOREIGN KEY ("subjectPatientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyInvitation" ADD CONSTRAINT "FamilyInvitation_subjectPatientId_fkey" FOREIGN KEY ("subjectPatientId") REFERENCES "PatientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "WalletAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletHold" ADD CONSTRAINT "WalletHold_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "WalletAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherRedemption" ADD CONSTRAINT "VoucherRedemption_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "VoucherCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalFinding" ADD CONSTRAINT "ClinicalFinding_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvidence" ADD CONSTRAINT "ClinicalEvidence_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "ClinicalFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvidence" ADD CONSTRAINT "ClinicalEvidence_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalAnnotation" ADD CONSTRAINT "ClinicalAnnotation_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "ClinicalEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalAnnotation" ADD CONSTRAINT "ClinicalAnnotation_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "ClinicalFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalArtifact" ADD CONSTRAINT "ClinicalArtifact_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurgicalCase" ADD CONSTRAINT "SurgicalCase_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurgicalProcedureEvent" ADD CONSTRAINT "SurgicalProcedureEvent_surgicalCaseId_fkey" FOREIGN KEY ("surgicalCaseId") REFERENCES "SurgicalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurgicalProcedureEvent" ADD CONSTRAINT "SurgicalProcedureEvent_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopVariant" ADD CONSTRAINT "ShopVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopProductChannel" ADD CONSTRAINT "ShopProductChannel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopVariantChannel" ADD CONSTRAINT "ShopVariantChannel_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ShopVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopInventoryMovement" ADD CONSTRAINT "ShopInventoryMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ShopVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrderItem" ADD CONSTRAINT "ShopOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Designation" ADD CONSTRAINT "Designation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleScope" ADD CONSTRAINT "RoleScope_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignationRole" ADD CONSTRAINT "DesignationRole_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignationRole" ADD CONSTRAINT "DesignationRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUserProfile" ADD CONSTRAINT "AdminUserProfile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUserProfile" ADD CONSTRAINT "AdminUserProfile_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleRequest" ADD CONSTRAINT "RoleRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleRequest" ADD CONSTRAINT "RoleRequest_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleRequestRole" ADD CONSTRAINT "RoleRequestRole_roleRequestId_fkey" FOREIGN KEY ("roleRequestId") REFERENCES "RoleRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleRequestRole" ADD CONSTRAINT "RoleRequestRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncounterDiagnosis" ADD CONSTRAINT "EncounterDiagnosis_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "LabOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicianOnboarding" ADD CONSTRAINT "ClinicianOnboarding_trainingSlotId_fkey" FOREIGN KEY ("trainingSlotId") REFERENCES "ClinicianTrainingSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicianDispatch" ADD CONSTRAINT "ClinicianDispatch_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "ClinicianOnboarding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicianDispatchItem" ADD CONSTRAINT "ClinicianDispatchItem_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "ClinicianDispatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
