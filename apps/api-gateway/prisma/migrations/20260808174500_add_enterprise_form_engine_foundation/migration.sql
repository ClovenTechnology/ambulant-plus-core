-- Sprint C2A: enterprise form engine foundation.
-- Additive migration only. No existing table/column is dropped or renamed.
-- Published form versions are immutable by application policy; draft structure is version-bound.

CREATE TYPE "EnterpriseFormStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "EnterpriseFormVersionState" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');
CREATE TYPE "EnterpriseFormAccessMode" AS ENUM ('PUBLIC', 'AUTHENTICATED', 'INVITE_ONLY', 'INTERNAL');
CREATE TYPE "EnterpriseFormFieldType" AS ENUM (
    'SHORT_TEXT', 'LONG_TEXT', 'EMAIL', 'PHONE', 'NUMBER', 'CURRENCY',
    'DATE', 'DATETIME', 'TIME', 'BOOLEAN', 'SINGLE_SELECT', 'MULTI_SELECT',
    'RADIO', 'CHECKBOX', 'CHECKBOX_GROUP', 'FILE_UPLOAD', 'CONSENT', 'URL',
    'ADDRESS', 'COUNTRY', 'RATING', 'MATRIX', 'REPEATER', 'HIDDEN', 'INFORMATION'
);
CREATE TYPE "EnterpriseFormRuleKind" AS ENUM ('VISIBILITY', 'REQUIREMENT', 'NAVIGATION', 'CALCULATION', 'SCORING');
CREATE TYPE "EnterpriseFormTranslationTarget" AS ENUM ('FORM', 'PAGE', 'SECTION', 'FIELD', 'OPTION');
CREATE TYPE "EnterpriseFormSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ABANDONED', 'EXPIRED');
CREATE TYPE "EnterpriseFormFileState" AS ENUM ('PENDING', 'AVAILABLE', 'REJECTED', 'REMOVED');

CREATE TABLE "EnterpriseForm" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "name" VARCHAR(240) NOT NULL,
    "description" TEXT,
    "status" "EnterpriseFormStatus" NOT NULL DEFAULT 'ACTIVE',
    "defaultLocale" VARCHAR(20) NOT NULL DEFAULT 'en',
    "createdByProfileId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "archivedByProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EnterpriseForm_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseFormVersion" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "state" "EnterpriseFormVersionState" NOT NULL DEFAULT 'DRAFT',
    "accessMode" "EnterpriseFormAccessMode" NOT NULL DEFAULT 'PUBLIC',
    "title" VARCHAR(240) NOT NULL,
    "description" TEXT,
    "locale" VARCHAR(20) NOT NULL DEFAULT 'en',
    "fallbackLocale" VARCHAR(20),
    "submitLabel" VARCHAR(120) NOT NULL DEFAULT 'Submit',
    "allowSaveResume" BOOLEAN NOT NULL DEFAULT true,
    "acceptingFrom" TIMESTAMP(3),
    "acceptingUntil" TIMESTAMP(3),
    "retentionDays" INTEGER,
    "branding" JSONB,
    "settings" JSONB,
    "notificationRules" JSONB,
    "antiSpamPolicy" JSONB,
    "createdFromVersionId" TEXT,
    "createdByProfileId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "publishedByProfileId" TEXT,
    "retiredAt" TIMESTAMP(3),
    "retiredByProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EnterpriseFormVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseFormPage" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EnterpriseFormPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseFormSection" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "repeatable" BOOLEAN NOT NULL DEFAULT false,
    "minRepeats" INTEGER,
    "maxRepeats" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EnterpriseFormSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseFormField" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "type" "EnterpriseFormFieldType" NOT NULL,
    "label" VARCHAR(240) NOT NULL,
    "helpText" TEXT,
    "placeholder" VARCHAR(500),
    "order" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" JSONB,
    "validation" JSONB,
    "visibilityLogic" JSONB,
    "calculation" JSONB,
    "scoring" JSONB,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EnterpriseFormField_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseFormFieldOption" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "label" VARCHAR(240) NOT NULL,
    "value" VARCHAR(240) NOT NULL,
    "order" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EnterpriseFormFieldOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseFormRule" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "kind" "EnterpriseFormRuleKind" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "condition" JSONB NOT NULL,
    "effect" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EnterpriseFormRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseFormTranslation" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "locale" VARCHAR(20) NOT NULL,
    "targetType" "EnterpriseFormTranslationTarget" NOT NULL,
    "targetKey" VARCHAR(120) NOT NULL,
    "values" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EnterpriseFormTranslation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseFormSubmission" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" "EnterpriseFormSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "resumeTokenHash" VARCHAR(128),
    "resumeTokenExpiresAt" TIMESTAMP(3),
    "identityEmailNormalized" VARCHAR(320),
    "contextType" VARCHAR(80),
    "contextId" VARCHAR(240),
    "locale" VARCHAR(20) NOT NULL DEFAULT 'en',
    "source" VARCHAR(80),
    "metadata" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSavedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EnterpriseFormSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseFormSubmissionAnswer" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "fieldKey" VARCHAR(120) NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EnterpriseFormSubmissionAnswer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseFormSubmissionFile" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "fieldKey" VARCHAR(120) NOT NULL,
    "objectKey" VARCHAR(512) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "contentType" VARCHAR(160) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" VARCHAR(64),
    "state" "EnterpriseFormFileState" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EnterpriseFormSubmissionFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseFormConsentEvidence" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "fieldKey" VARCHAR(120) NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "consentTextHash" VARCHAR(64) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnterpriseFormConsentEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EnterpriseForm_key_key" ON "EnterpriseForm"("key");
CREATE UNIQUE INDEX "EnterpriseForm_slug_key" ON "EnterpriseForm"("slug");
CREATE INDEX "EnterpriseForm_status_createdAt_idx" ON "EnterpriseForm"("status", "createdAt");
CREATE INDEX "EnterpriseForm_createdByProfileId_createdAt_idx" ON "EnterpriseForm"("createdByProfileId", "createdAt");

CREATE UNIQUE INDEX "EnterpriseFormVersion_formId_versionNumber_key" ON "EnterpriseFormVersion"("formId", "versionNumber");
CREATE INDEX "EnterpriseFormVersion_formId_state_versionNumber_idx" ON "EnterpriseFormVersion"("formId", "state", "versionNumber");
CREATE INDEX "EnterpriseFormVersion_state_acceptingFrom_acceptingUntil_idx" ON "EnterpriseFormVersion"("state", "acceptingFrom", "acceptingUntil");
CREATE INDEX "EnterpriseFormVersion_createdFromVersionId_idx" ON "EnterpriseFormVersion"("createdFromVersionId");
CREATE UNIQUE INDEX "enterprise_form_one_draft_per_form" ON "EnterpriseFormVersion"("formId") WHERE "state" = 'DRAFT';
CREATE UNIQUE INDEX "enterprise_form_one_published_per_form" ON "EnterpriseFormVersion"("formId") WHERE "state" = 'PUBLISHED';

CREATE UNIQUE INDEX "EnterpriseFormPage_versionId_key_key" ON "EnterpriseFormPage"("versionId", "key");
CREATE UNIQUE INDEX "EnterpriseFormPage_versionId_order_key" ON "EnterpriseFormPage"("versionId", "order");
CREATE INDEX "EnterpriseFormPage_versionId_order_idx" ON "EnterpriseFormPage"("versionId", "order");

CREATE UNIQUE INDEX "EnterpriseFormSection_versionId_key_key" ON "EnterpriseFormSection"("versionId", "key");
CREATE UNIQUE INDEX "EnterpriseFormSection_pageId_order_key" ON "EnterpriseFormSection"("pageId", "order");
CREATE INDEX "EnterpriseFormSection_versionId_order_idx" ON "EnterpriseFormSection"("versionId", "order");
CREATE INDEX "EnterpriseFormSection_pageId_order_idx" ON "EnterpriseFormSection"("pageId", "order");

CREATE UNIQUE INDEX "EnterpriseFormField_versionId_key_key" ON "EnterpriseFormField"("versionId", "key");
CREATE UNIQUE INDEX "EnterpriseFormField_sectionId_order_key" ON "EnterpriseFormField"("sectionId", "order");
CREATE INDEX "EnterpriseFormField_versionId_type_idx" ON "EnterpriseFormField"("versionId", "type");
CREATE INDEX "EnterpriseFormField_sectionId_order_idx" ON "EnterpriseFormField"("sectionId", "order");

CREATE UNIQUE INDEX "EnterpriseFormFieldOption_fieldId_key_key" ON "EnterpriseFormFieldOption"("fieldId", "key");
CREATE UNIQUE INDEX "EnterpriseFormFieldOption_fieldId_value_key" ON "EnterpriseFormFieldOption"("fieldId", "value");
CREATE UNIQUE INDEX "EnterpriseFormFieldOption_fieldId_order_key" ON "EnterpriseFormFieldOption"("fieldId", "order");
CREATE INDEX "EnterpriseFormFieldOption_versionId_fieldId_idx" ON "EnterpriseFormFieldOption"("versionId", "fieldId");

CREATE UNIQUE INDEX "EnterpriseFormRule_versionId_key_key" ON "EnterpriseFormRule"("versionId", "key");
CREATE INDEX "EnterpriseFormRule_versionId_kind_priority_idx" ON "EnterpriseFormRule"("versionId", "kind", "priority");

CREATE UNIQUE INDEX "EnterpriseFormTranslation_versionId_locale_targetType_targetKey_key" ON "EnterpriseFormTranslation"("versionId", "locale", "targetType", "targetKey");
CREATE INDEX "EnterpriseFormTranslation_versionId_locale_idx" ON "EnterpriseFormTranslation"("versionId", "locale");

CREATE UNIQUE INDEX "EnterpriseFormSubmission_resumeTokenHash_key" ON "EnterpriseFormSubmission"("resumeTokenHash");
CREATE INDEX "EnterpriseFormSubmission_formId_status_createdAt_idx" ON "EnterpriseFormSubmission"("formId", "status", "createdAt");
CREATE INDEX "EnterpriseFormSubmission_versionId_status_createdAt_idx" ON "EnterpriseFormSubmission"("versionId", "status", "createdAt");
CREATE INDEX "EnterpriseFormSubmission_identityEmailNormalized_createdAt_idx" ON "EnterpriseFormSubmission"("identityEmailNormalized", "createdAt");
CREATE INDEX "EnterpriseFormSubmission_contextType_contextId_idx" ON "EnterpriseFormSubmission"("contextType", "contextId");
CREATE INDEX "EnterpriseFormSubmission_expiresAt_status_idx" ON "EnterpriseFormSubmission"("expiresAt", "status");

CREATE UNIQUE INDEX "EnterpriseFormSubmissionAnswer_submissionId_fieldId_key" ON "EnterpriseFormSubmissionAnswer"("submissionId", "fieldId");
CREATE INDEX "EnterpriseFormSubmissionAnswer_fieldId_idx" ON "EnterpriseFormSubmissionAnswer"("fieldId");

CREATE UNIQUE INDEX "EnterpriseFormSubmissionFile_objectKey_key" ON "EnterpriseFormSubmissionFile"("objectKey");
CREATE INDEX "EnterpriseFormSubmissionFile_submissionId_fieldId_idx" ON "EnterpriseFormSubmissionFile"("submissionId", "fieldId");
CREATE INDEX "EnterpriseFormSubmissionFile_state_createdAt_idx" ON "EnterpriseFormSubmissionFile"("state", "createdAt");

CREATE UNIQUE INDEX "EnterpriseFormConsentEvidence_submissionId_fieldId_key" ON "EnterpriseFormConsentEvidence"("submissionId", "fieldId");
CREATE INDEX "EnterpriseFormConsentEvidence_fieldId_accepted_idx" ON "EnterpriseFormConsentEvidence"("fieldId", "accepted");

ALTER TABLE "EnterpriseFormVersion" ADD CONSTRAINT "EnterpriseFormVersion_versionNumber_check" CHECK ("versionNumber" > 0);
ALTER TABLE "EnterpriseFormVersion" ADD CONSTRAINT "EnterpriseFormVersion_retentionDays_check" CHECK ("retentionDays" IS NULL OR ("retentionDays" >= 1 AND "retentionDays" <= 3650));
ALTER TABLE "EnterpriseFormVersion" ADD CONSTRAINT "EnterpriseFormVersion_submissionWindow_check" CHECK ("acceptingFrom" IS NULL OR "acceptingUntil" IS NULL OR "acceptingUntil" > "acceptingFrom");
ALTER TABLE "EnterpriseFormPage" ADD CONSTRAINT "EnterpriseFormPage_order_check" CHECK ("order" >= 0);
ALTER TABLE "EnterpriseFormSection" ADD CONSTRAINT "EnterpriseFormSection_order_check" CHECK ("order" >= 0);
ALTER TABLE "EnterpriseFormSection" ADD CONSTRAINT "EnterpriseFormSection_repeat_check" CHECK (
  ("repeatable" = false AND "minRepeats" IS NULL AND "maxRepeats" IS NULL) OR
  ("repeatable" = true AND ("minRepeats" IS NULL OR "minRepeats" >= 0) AND ("maxRepeats" IS NULL OR "maxRepeats" >= 1) AND ("minRepeats" IS NULL OR "maxRepeats" IS NULL OR "maxRepeats" >= "minRepeats"))
);
ALTER TABLE "EnterpriseFormField" ADD CONSTRAINT "EnterpriseFormField_order_check" CHECK ("order" >= 0);
ALTER TABLE "EnterpriseFormFieldOption" ADD CONSTRAINT "EnterpriseFormFieldOption_order_check" CHECK ("order" >= 0);
ALTER TABLE "EnterpriseFormSubmissionFile" ADD CONSTRAINT "EnterpriseFormSubmissionFile_sizeBytes_check" CHECK ("sizeBytes" >= 0);

ALTER TABLE "EnterpriseForm"
  ADD CONSTRAINT "EnterpriseForm_createdByProfileId_fkey"
  FOREIGN KEY ("createdByProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnterpriseForm"
  ADD CONSTRAINT "EnterpriseForm_archivedByProfileId_fkey"
  FOREIGN KEY ("archivedByProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EnterpriseFormVersion"
  ADD CONSTRAINT "EnterpriseFormVersion_formId_fkey"
  FOREIGN KEY ("formId") REFERENCES "EnterpriseForm"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnterpriseFormVersion"
  ADD CONSTRAINT "EnterpriseFormVersion_createdFromVersionId_fkey"
  FOREIGN KEY ("createdFromVersionId") REFERENCES "EnterpriseFormVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EnterpriseFormVersion"
  ADD CONSTRAINT "EnterpriseFormVersion_createdByProfileId_fkey"
  FOREIGN KEY ("createdByProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnterpriseFormVersion"
  ADD CONSTRAINT "EnterpriseFormVersion_publishedByProfileId_fkey"
  FOREIGN KEY ("publishedByProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EnterpriseFormVersion"
  ADD CONSTRAINT "EnterpriseFormVersion_retiredByProfileId_fkey"
  FOREIGN KEY ("retiredByProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EnterpriseFormPage"
  ADD CONSTRAINT "EnterpriseFormPage_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "EnterpriseFormVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnterpriseFormSection"
  ADD CONSTRAINT "EnterpriseFormSection_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "EnterpriseFormVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnterpriseFormSection"
  ADD CONSTRAINT "EnterpriseFormSection_pageId_fkey"
  FOREIGN KEY ("pageId") REFERENCES "EnterpriseFormPage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnterpriseFormField"
  ADD CONSTRAINT "EnterpriseFormField_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "EnterpriseFormVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnterpriseFormField"
  ADD CONSTRAINT "EnterpriseFormField_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "EnterpriseFormSection"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnterpriseFormFieldOption"
  ADD CONSTRAINT "EnterpriseFormFieldOption_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "EnterpriseFormVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnterpriseFormFieldOption"
  ADD CONSTRAINT "EnterpriseFormFieldOption_fieldId_fkey"
  FOREIGN KEY ("fieldId") REFERENCES "EnterpriseFormField"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnterpriseFormRule"
  ADD CONSTRAINT "EnterpriseFormRule_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "EnterpriseFormVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnterpriseFormTranslation"
  ADD CONSTRAINT "EnterpriseFormTranslation_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "EnterpriseFormVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnterpriseFormSubmission"
  ADD CONSTRAINT "EnterpriseFormSubmission_formId_fkey"
  FOREIGN KEY ("formId") REFERENCES "EnterpriseForm"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnterpriseFormSubmission"
  ADD CONSTRAINT "EnterpriseFormSubmission_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "EnterpriseFormVersion"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnterpriseFormSubmissionAnswer"
  ADD CONSTRAINT "EnterpriseFormSubmissionAnswer_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "EnterpriseFormSubmission"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnterpriseFormSubmissionAnswer"
  ADD CONSTRAINT "EnterpriseFormSubmissionAnswer_fieldId_fkey"
  FOREIGN KEY ("fieldId") REFERENCES "EnterpriseFormField"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnterpriseFormSubmissionFile"
  ADD CONSTRAINT "EnterpriseFormSubmissionFile_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "EnterpriseFormSubmission"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnterpriseFormSubmissionFile"
  ADD CONSTRAINT "EnterpriseFormSubmissionFile_fieldId_fkey"
  FOREIGN KEY ("fieldId") REFERENCES "EnterpriseFormField"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnterpriseFormConsentEvidence"
  ADD CONSTRAINT "EnterpriseFormConsentEvidence_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "EnterpriseFormSubmission"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnterpriseFormConsentEvidence"
  ADD CONSTRAINT "EnterpriseFormConsentEvidence_fieldId_fkey"
  FOREIGN KEY ("fieldId") REFERENCES "EnterpriseFormField"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
