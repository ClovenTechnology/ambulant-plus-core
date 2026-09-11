-- A7-C1 Platform Compliance Credential & Renewal Foundation
-- Additive only: this migration does not change existing onboarding gates or automatically
-- suspend any existing user/partner. Category-specific enforcement is deferred.

CREATE TABLE "ComplianceControlRule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "code" VARCHAR(160) NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "description" TEXT,
    "authorityClass" VARCHAR(80) NOT NULL DEFAULT 'AMBULANT_POLICY',
    "enforcementClass" VARCHAR(80) NOT NULL DEFAULT 'INFORMATIONAL',
    "enforcementPoint" VARCHAR(80) NOT NULL DEFAULT 'RENEWAL_GATE',
    "enforcementScope" VARCHAR(240),
    "applicability" JSONB,
    "jurisdiction" VARCHAR(8) NOT NULL DEFAULT 'ZA',
    "sourceAuthority" VARCHAR(160),
    "sourceVersion" VARCHAR(160),
    "sourceProvision" VARCHAR(240),
    "primarySource" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "lastLegallyReviewedAt" TIMESTAMP(3),
    "nextLegalReviewAt" TIMESTAMP(3),
    "status" VARCHAR(80) NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ComplianceControlRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceCredential" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "holderType" VARCHAR(80) NOT NULL,
    "holderSubtype" VARCHAR(120),
    "holderId" VARCHAR(191) NOT NULL,
    "holderName" VARCHAR(240) NOT NULL,
    "holderEmail" VARCHAR(320),
    "credentialType" VARCHAR(120) NOT NULL,
    "credentialLabel" VARCHAR(240) NOT NULL,
    "credentialNumber" VARCHAR(240),
    "issuingAuthority" VARCHAR(240),
    "controlCode" VARCHAR(160),
    "authorityClass" VARCHAR(80) NOT NULL DEFAULT 'AMBULANT_POLICY',
    "enforcementClass" VARCHAR(80) NOT NULL DEFAULT 'INFORMATIONAL',
    "enforcementPoint" VARCHAR(80) NOT NULL DEFAULT 'RENEWAL_GATE',
    "enforcementScope" VARCHAR(240),
    "jurisdiction" VARCHAR(8) NOT NULL DEFAULT 'ZA',
    "applicability" JSONB,
    "issuedAt" TIMESTAMP(3),
    "effectiveFrom" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "state" VARCHAR(80) NOT NULL DEFAULT 'VALID',
    "verificationMethod" VARCHAR(120),
    "sourceRef" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "evidenceHash" VARCHAR(128),
    "documentId" VARCHAR(191),
    "reminderDays" INTEGER[] NOT NULL DEFAULT ARRAY[30,14,7,1]::INTEGER[],
    "autoRemindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastReminderAt" TIMESTAMP(3),
    "nextReminderAt" TIMESTAMP(3),
    "riskLevel" VARCHAR(40),
    "overrideStatus" VARCHAR(80),
    "overrideReason" TEXT,
    "overrideApproverId" TEXT,
    "metadata" JSONB,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ComplianceCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceRenewalReminder" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "subjectKey" VARCHAR(400) NOT NULL,
    "credentialId" TEXT,
    "holderType" VARCHAR(80) NOT NULL,
    "holderId" VARCHAR(191) NOT NULL,
    "holderName" VARCHAR(240) NOT NULL,
    "recipientEmail" VARCHAR(320),
    "credentialType" VARCHAR(120) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "reminderKind" VARCHAR(80) NOT NULL DEFAULT 'SCHEDULED',
    "thresholdDays" INTEGER,
    "channel" VARCHAR(40) NOT NULL DEFAULT 'EMAIL',
    "status" VARCHAR(80) NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "triggeredByUserId" TEXT,
    "lastError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ComplianceRenewalReminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ComplianceControlRule_orgId_code_key" ON "ComplianceControlRule"("orgId", "code");
CREATE INDEX "ComplianceControlRule_orgId_status_idx" ON "ComplianceControlRule"("orgId", "status");
CREATE INDEX "ComplianceControlRule_authorityClass_enforcementClass_idx" ON "ComplianceControlRule"("authorityClass", "enforcementClass");
CREATE INDEX "ComplianceControlRule_effectiveFrom_effectiveTo_idx" ON "ComplianceControlRule"("effectiveFrom", "effectiveTo");
CREATE INDEX "ComplianceControlRule_nextLegalReviewAt_idx" ON "ComplianceControlRule"("nextLegalReviewAt");

CREATE INDEX "ComplianceCredential_orgId_expiresAt_idx" ON "ComplianceCredential"("orgId", "expiresAt");
CREATE INDEX "ComplianceCredential_orgId_holderType_holderSubtype_idx" ON "ComplianceCredential"("orgId", "holderType", "holderSubtype");
CREATE INDEX "ComplianceCredential_holderType_holderId_idx" ON "ComplianceCredential"("holderType", "holderId");
CREATE INDEX "ComplianceCredential_credentialType_expiresAt_idx" ON "ComplianceCredential"("credentialType", "expiresAt");
CREATE INDEX "ComplianceCredential_state_expiresAt_idx" ON "ComplianceCredential"("state", "expiresAt");
CREATE INDEX "ComplianceCredential_nextReviewAt_idx" ON "ComplianceCredential"("nextReviewAt");

CREATE UNIQUE INDEX "compliance_reminder_dedupe" ON "ComplianceRenewalReminder"("subjectKey", "dueAt", "reminderKind", "thresholdDays", "channel");
CREATE INDEX "ComplianceRenewalReminder_orgId_status_scheduledAt_idx" ON "ComplianceRenewalReminder"("orgId", "status", "scheduledAt");
CREATE INDEX "ComplianceRenewalReminder_credentialId_createdAt_idx" ON "ComplianceRenewalReminder"("credentialId", "createdAt");
CREATE INDEX "ComplianceRenewalReminder_dueAt_status_idx" ON "ComplianceRenewalReminder"("dueAt", "status");
CREATE INDEX "ComplianceRenewalReminder_holderType_holderId_idx" ON "ComplianceRenewalReminder"("holderType", "holderId");

ALTER TABLE "ComplianceRenewalReminder"
ADD CONSTRAINT "ComplianceRenewalReminder_credentialId_fkey"
FOREIGN KEY ("credentialId") REFERENCES "ComplianceCredential"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
