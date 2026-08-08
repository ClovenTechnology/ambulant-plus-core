CREATE TYPE "OpportunityType" AS ENUM (
  'CAREER_JOB',
  'INTERNSHIP_GRADUATE',
  'ONBOARDING',
  'PARTNERSHIP',
  'FRANCHISE',
  'VENDOR_PROVIDER',
  'RESEARCH_PILOT',
  'CUSTOM'
);

CREATE TYPE "OpportunityStatus" AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'PAUSED',
  'CLOSED',
  'ARCHIVED'
);

CREATE TYPE "OpportunityVisibility" AS ENUM (
  'PUBLIC',
  'UNLISTED',
  'INTERNAL'
);

CREATE TYPE "OpportunityApplicationMode" AS ENUM (
  'ENTERPRISE_FORM',
  'EXTERNAL_URL',
  'NONE'
);

CREATE TYPE "OpportunityLocationMode" AS ENUM (
  'REMOTE',
  'HYBRID',
  'ONSITE',
  'FLEXIBLE'
);

CREATE TABLE "Opportunity" (
  "id" TEXT NOT NULL,
  "key" VARCHAR(120) NOT NULL,
  "slug" VARCHAR(160) NOT NULL,
  "type" "OpportunityType" NOT NULL,
  "status" "OpportunityStatus" NOT NULL DEFAULT 'DRAFT',
  "visibility" "OpportunityVisibility" NOT NULL DEFAULT 'PUBLIC',
  "applicationMode" "OpportunityApplicationMode" NOT NULL DEFAULT 'NONE',
  "title" VARCHAR(240) NOT NULL,
  "summary" VARCHAR(1200),
  "description" TEXT,
  "departmentLabel" VARCHAR(160),
  "locationMode" "OpportunityLocationMode",
  "locationLabel" VARCHAR(240),
  "countryCode" VARCHAR(2),
  "opensAt" TIMESTAMP(3),
  "closesAt" TIMESTAMP(3),
  "applicationFormId" TEXT,
  "externalApplicationUrl" VARCHAR(2048),
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "statusReason" VARCHAR(1000),
  "createdByProfileId" TEXT NOT NULL,
  "lastUpdatedByProfileId" TEXT NOT NULL,
  "publishedByProfileId" TEXT,
  "pausedByProfileId" TEXT,
  "closedByProfileId" TEXT,
  "archivedByProfileId" TEXT,
  "publishedAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Opportunity_window_check"
    CHECK ("opensAt" IS NULL OR "closesAt" IS NULL OR "closesAt" > "opensAt"),
  CONSTRAINT "Opportunity_country_code_check"
    CHECK ("countryCode" IS NULL OR char_length("countryCode") = 2),
  CONSTRAINT "Opportunity_application_target_check"
    CHECK (
      ("applicationMode" = 'ENTERPRISE_FORM' AND "applicationFormId" IS NOT NULL AND "externalApplicationUrl" IS NULL)
      OR
      ("applicationMode" = 'EXTERNAL_URL' AND "applicationFormId" IS NULL AND "externalApplicationUrl" IS NOT NULL)
      OR
      ("applicationMode" = 'NONE' AND "applicationFormId" IS NULL AND "externalApplicationUrl" IS NULL)
    )
);

CREATE UNIQUE INDEX "Opportunity_key_key" ON "Opportunity"("key");
CREATE UNIQUE INDEX "Opportunity_slug_key" ON "Opportunity"("slug");
CREATE INDEX "Opportunity_status_visibility_opensAt_closesAt_idx" ON "Opportunity"("status", "visibility", "opensAt", "closesAt");
CREATE INDEX "Opportunity_type_status_createdAt_idx" ON "Opportunity"("type", "status", "createdAt");
CREATE INDEX "Opportunity_applicationFormId_idx" ON "Opportunity"("applicationFormId");
CREATE INDEX "Opportunity_featured_sortOrder_publishedAt_idx" ON "Opportunity"("featured", "sortOrder", "publishedAt");
CREATE INDEX "Opportunity_createdByProfileId_createdAt_idx" ON "Opportunity"("createdByProfileId", "createdAt");

ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_applicationFormId_fkey"
  FOREIGN KEY ("applicationFormId") REFERENCES "EnterpriseForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_createdByProfileId_fkey"
  FOREIGN KEY ("createdByProfileId") REFERENCES "AdminUserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_lastUpdatedByProfileId_fkey"
  FOREIGN KEY ("lastUpdatedByProfileId") REFERENCES "AdminUserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_publishedByProfileId_fkey"
  FOREIGN KEY ("publishedByProfileId") REFERENCES "AdminUserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_pausedByProfileId_fkey"
  FOREIGN KEY ("pausedByProfileId") REFERENCES "AdminUserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_closedByProfileId_fkey"
  FOREIGN KEY ("closedByProfileId") REFERENCES "AdminUserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_archivedByProfileId_fkey"
  FOREIGN KEY ("archivedByProfileId") REFERENCES "AdminUserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
