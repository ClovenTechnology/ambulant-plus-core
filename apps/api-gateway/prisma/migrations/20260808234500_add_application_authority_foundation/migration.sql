CREATE TYPE "ApplicationSource" AS ENUM (
  'ENTERPRISE_FORM'
);

CREATE TYPE "ApplicationStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'DOCUMENTS_REQUESTED',
  'INTERVIEW_INVITED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEWED',
  'SUCCESSFUL',
  'OFFERED',
  'ONBOARDING',
  'DECLINED',
  'WITHDRAWN',
  'EXPIRED'
);

CREATE TABLE "Application" (
  "id" TEXT NOT NULL,
  "referenceCode" VARCHAR(40) NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "formSubmissionId" TEXT NOT NULL,
  "formVersionId" TEXT NOT NULL,
  "source" "ApplicationSource" NOT NULL DEFAULT 'ENTERPRISE_FORM',
  "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
  "applicantEmailNormalized" VARCHAR(320),
  "assignedReviewerProfileId" TEXT,
  "statusReason" VARCHAR(1000),
  "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP(3),
  "lastReviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationStatusEvent" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "fromStatus" "ApplicationStatus",
  "toStatus" "ApplicationStatus" NOT NULL,
  "actorType" "AuditActorType" NOT NULL,
  "actorRefId" VARCHAR(240),
  "reason" VARCHAR(1000),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationStatusEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Application_referenceCode_key" ON "Application"("referenceCode");
CREATE UNIQUE INDEX "Application_formSubmissionId_key" ON "Application"("formSubmissionId");
CREATE INDEX "Application_opportunityId_status_createdAt_idx" ON "Application"("opportunityId", "status", "createdAt");
CREATE INDEX "Application_status_submittedAt_idx" ON "Application"("status", "submittedAt");
CREATE INDEX "Application_applicantEmailNormalized_opportunityId_createdAt_idx" ON "Application"("applicantEmailNormalized", "opportunityId", "createdAt");
CREATE INDEX "Application_assignedReviewerProfileId_status_createdAt_idx" ON "Application"("assignedReviewerProfileId", "status", "createdAt");
CREATE INDEX "Application_formVersionId_status_createdAt_idx" ON "Application"("formVersionId", "status", "createdAt");
CREATE INDEX "ApplicationStatusEvent_applicationId_createdAt_idx" ON "ApplicationStatusEvent"("applicationId", "createdAt");
CREATE INDEX "ApplicationStatusEvent_toStatus_createdAt_idx" ON "ApplicationStatusEvent"("toStatus", "createdAt");
CREATE INDEX "ApplicationStatusEvent_actorType_createdAt_idx" ON "ApplicationStatusEvent"("actorType", "createdAt");

ALTER TABLE "Application"
  ADD CONSTRAINT "Application_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Application"
  ADD CONSTRAINT "Application_formSubmissionId_fkey"
  FOREIGN KEY ("formSubmissionId") REFERENCES "EnterpriseFormSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Application"
  ADD CONSTRAINT "Application_formVersionId_fkey"
  FOREIGN KEY ("formVersionId") REFERENCES "EnterpriseFormVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Application"
  ADD CONSTRAINT "Application_assignedReviewerProfileId_fkey"
  FOREIGN KEY ("assignedReviewerProfileId") REFERENCES "AdminUserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ApplicationStatusEvent"
  ADD CONSTRAINT "ApplicationStatusEvent_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
