-- A6-R5-A3D: durable governed Legal publication contract.
-- This migration is committed for later controlled deployment.
-- It does not replace domain-specific consent or Enterprise Finance notice models.

CREATE TYPE "LegalDocumentStatus" AS ENUM (
  'ACTIVE',
  'ARCHIVED'
);

CREATE TYPE "LegalDocumentVersionStatus" AS ENUM (
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
  'SUPERSEDED',
  'RETIRED'
);

CREATE TYPE "LegalAcknowledgementMode" AS ENUM (
  'NONE',
  'NOTICE',
  'REQUIRED',
  'NON_BLOCKING'
);

CREATE TYPE "LegalAcknowledgementAction" AS ENUM (
  'ACCEPTED',
  'DECLINED',
  'WITHDRAWN'
);

CREATE TYPE "LegalPublicationEventType" AS ENUM (
  'DOCUMENT_CREATED',
  'DOCUMENT_UPDATED',
  'VERSION_CREATED',
  'VERSION_UPDATED',
  'SUBMITTED',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
  'SUPERSEDED',
  'RETIRED',
  'ACKNOWLEDGED'
);

CREATE TABLE "LegalDocument" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL DEFAULT 'org-default',
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "ownerDepartment" TEXT NOT NULL DEFAULT 'legal',
  "status" "LegalDocumentStatus" NOT NULL DEFAULT 'ACTIVE',
  "acknowledgementMode" "LegalAcknowledgementMode" NOT NULL DEFAULT 'NONE',
  "audiences" JSONB NOT NULL,
  "applications" JSONB NOT NULL,
  "surfaces" JSONB,
  "currentPublishedVersionId" TEXT,
  "metadata" JSONB,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LegalDocument_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE "LegalDocumentVersion" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL DEFAULT 'org-default',
  "documentId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "versionLabel" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'en-ZA',
  "contentFormat" TEXT NOT NULL DEFAULT 'markdown',
  "content" TEXT NOT NULL,
  "renderedHtml" TEXT,
  "checksum" VARCHAR(128) NOT NULL,
  "status" "LegalDocumentVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "changeSummary" TEXT,
  "authorUserId" TEXT,
  "submittedByUserId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "scheduledByUserId" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "effectiveAt" TIMESTAMP(3),
  "publishedByUserId" TEXT,
  "publishedAt" TIMESTAMP(3),
  "supersededByUserId" TEXT,
  "supersededAt" TIMESTAMP(3),
  "supersededByVersionId" TEXT,
  "retiredByUserId" TEXT,
  "retiredAt" TIMESTAMP(3),
  "retirementReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LegalDocumentVersion_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE "LegalAcknowledgement" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL DEFAULT 'org-default',
  "legalDocumentVersionId" TEXT NOT NULL,
  "documentKeySnapshot" TEXT NOT NULL,
  "versionLabelSnapshot" TEXT,
  "checksumSnapshot" VARCHAR(128) NOT NULL,
  "subjectType" VARCHAR(80) NOT NULL,
  "subjectUserId" TEXT,
  "subjectId" TEXT,
  "application" VARCHAR(120) NOT NULL,
  "surface" VARCHAR(160),
  "action" "LegalAcknowledgementAction" NOT NULL DEFAULT 'ACCEPTED',
  "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locale" TEXT,
  "ipHash" VARCHAR(128),
  "userAgent" TEXT,
  "evidence" JSONB,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LegalAcknowledgement_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE "LegalPublicationEvent" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL DEFAULT 'org-default',
  "documentId" TEXT NOT NULL,
  "versionId" TEXT,
  "eventType" "LegalPublicationEventType" NOT NULL,
  "actorUserId" TEXT,
  "actorRole" TEXT,
  "fromStatus" "LegalDocumentVersionStatus",
  "toStatus" "LegalDocumentVersionStatus",
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LegalPublicationEvent_pkey"
    PRIMARY KEY ("id")
);

ALTER TABLE "TelevisitConsent"
  ADD COLUMN "legalDocumentVersionId" TEXT;

CREATE UNIQUE INDEX "LegalDocument_currentPublishedVersionId_key"
  ON "LegalDocument"("currentPublishedVersionId");

CREATE UNIQUE INDEX "LegalDocument_orgId_key_key"
  ON "LegalDocument"("orgId", "key");

CREATE INDEX "LegalDocument_orgId_status_idx"
  ON "LegalDocument"("orgId", "status");

CREATE INDEX "LegalDocument_category_idx"
  ON "LegalDocument"("category");

CREATE INDEX "LegalDocument_ownerDepartment_idx"
  ON "LegalDocument"("ownerDepartment");

CREATE UNIQUE INDEX "LegalDocumentVersion_documentId_versionNumber_key"
  ON "LegalDocumentVersion"("documentId", "versionNumber");

CREATE UNIQUE INDEX "LegalDocumentVersion_documentId_checksum_key"
  ON "LegalDocumentVersion"("documentId", "checksum");

CREATE INDEX "LegalDocumentVersion_orgId_status_idx"
  ON "LegalDocumentVersion"("orgId", "status");

CREATE INDEX "LegalDocumentVersion_documentId_status_idx"
  ON "LegalDocumentVersion"("documentId", "status");

CREATE INDEX "LegalDocumentVersion_scheduledAt_idx"
  ON "LegalDocumentVersion"("scheduledAt");

CREATE INDEX "LegalDocumentVersion_effectiveAt_idx"
  ON "LegalDocumentVersion"("effectiveAt");

CREATE INDEX "LegalDocumentVersion_publishedAt_idx"
  ON "LegalDocumentVersion"("publishedAt");

CREATE INDEX "LegalDocumentVersion_supersededByVersionId_idx"
  ON "LegalDocumentVersion"("supersededByVersionId");

CREATE UNIQUE INDEX "LegalAcknowledgement_idempotencyKey_key"
  ON "LegalAcknowledgement"("idempotencyKey");

CREATE INDEX "LegalAcknowledgement_orgId_acknowledgedAt_idx"
  ON "LegalAcknowledgement"("orgId", "acknowledgedAt");

CREATE INDEX "LegalAcknowledgement_version_acknowledgedAt_idx"
  ON "LegalAcknowledgement"(
    "legalDocumentVersionId",
    "acknowledgedAt"
  );

CREATE INDEX "LegalAcknowledgement_user_acknowledgedAt_idx"
  ON "LegalAcknowledgement"("subjectUserId", "acknowledgedAt");

CREATE INDEX "LegalAcknowledgement_subject_acknowledgedAt_idx"
  ON "LegalAcknowledgement"(
    "subjectType",
    "subjectId",
    "acknowledgedAt"
  );

CREATE INDEX "LegalAcknowledgement_application_acknowledgedAt_idx"
  ON "LegalAcknowledgement"("application", "acknowledgedAt");

CREATE INDEX "LegalPublicationEvent_orgId_createdAt_idx"
  ON "LegalPublicationEvent"("orgId", "createdAt");

CREATE INDEX "LegalPublicationEvent_documentId_createdAt_idx"
  ON "LegalPublicationEvent"("documentId", "createdAt");

CREATE INDEX "LegalPublicationEvent_versionId_createdAt_idx"
  ON "LegalPublicationEvent"("versionId", "createdAt");

CREATE INDEX "LegalPublicationEvent_eventType_createdAt_idx"
  ON "LegalPublicationEvent"("eventType", "createdAt");

CREATE INDEX "LegalPublicationEvent_actorUserId_createdAt_idx"
  ON "LegalPublicationEvent"("actorUserId", "createdAt");

CREATE INDEX "TelevisitConsent_legalDocumentVersionId_idx"
  ON "TelevisitConsent"("legalDocumentVersionId");

ALTER TABLE "LegalDocumentVersion"
  ADD CONSTRAINT "LegalDocumentVersion_documentId_fkey"
  FOREIGN KEY ("documentId")
  REFERENCES "LegalDocument"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "LegalDocumentVersion"
  ADD CONSTRAINT "LegalDocumentVersion_supersededByVersionId_fkey"
  FOREIGN KEY ("supersededByVersionId")
  REFERENCES "LegalDocumentVersion"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "LegalDocument"
  ADD CONSTRAINT "LegalDocument_currentPublishedVersionId_fkey"
  FOREIGN KEY ("currentPublishedVersionId")
  REFERENCES "LegalDocumentVersion"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "LegalAcknowledgement"
  ADD CONSTRAINT "LegalAcknowledgement_legalDocumentVersionId_fkey"
  FOREIGN KEY ("legalDocumentVersionId")
  REFERENCES "LegalDocumentVersion"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "LegalPublicationEvent"
  ADD CONSTRAINT "LegalPublicationEvent_documentId_fkey"
  FOREIGN KEY ("documentId")
  REFERENCES "LegalDocument"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "LegalPublicationEvent"
  ADD CONSTRAINT "LegalPublicationEvent_versionId_fkey"
  FOREIGN KEY ("versionId")
  REFERENCES "LegalDocumentVersion"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "TelevisitConsent"
  ADD CONSTRAINT "TelevisitConsent_legalDocumentVersionId_fkey"
  FOREIGN KEY ("legalDocumentVersionId")
  REFERENCES "LegalDocumentVersion"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
