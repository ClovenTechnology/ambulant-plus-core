-- Enterprise operations completion:
-- communications notifications/call outcomes, staff activity telemetry,
-- HR documents/history/leave, staff ID templates, and opportunity AEO metadata.

CREATE TYPE "DirectCallOutcome" AS ENUM ('COMPLETED', 'MISSED', 'DECLINED', 'BUSY', 'CANCELLED', 'FAILED');

ALTER TABLE "Opportunity"
  ADD COLUMN "aeoSummary" VARCHAR(1200),
  ADD COLUMN "aeoQuestions" JSONB,
  ADD COLUMN "discoveryMeta" JSONB;

ALTER TABLE "ApplicationStaffConversion"
  ADD COLUMN "onboardingMeta" JSONB;

ALTER TABLE "StaffConversationMember"
  ADD COLUMN "unreadCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Meeting"
  ADD COLUMN "ringExpiresAt" TIMESTAMP(3),
  ADD COLUMN "callOutcome" "DirectCallOutcome",
  ADD COLUMN "callEndedReason" VARCHAR(240);

CREATE INDEX "Meeting_kind_state_ringExpiresAt_idx"
  ON "Meeting"("kind", "state", "ringExpiresAt");

CREATE TABLE "AdminStaffSession" (
  "id" TEXT NOT NULL,
  "staffProfileId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "activeSeconds" INTEGER NOT NULL DEFAULT 0,
  "lastPath" VARCHAR(500),
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminStaffSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminStaffPageActivity" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "staffProfileId" TEXT NOT NULL,
  "path" VARCHAR(500) NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "visitCount" INTEGER NOT NULL DEFAULT 1,
  "activeSeconds" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminStaffPageActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffNotification" (
  "id" TEXT NOT NULL,
  "recipientProfileId" TEXT NOT NULL,
  "actorProfileId" TEXT,
  "conversationId" TEXT,
  "meetingId" TEXT,
  "type" VARCHAR(80) NOT NULL,
  "title" VARCHAR(240) NOT NULL,
  "body" VARCHAR(1000),
  "payload" JSONB,
  "dedupeKey" VARCHAR(240),
  "readAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffNotification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffEmploymentDocument" (
  "id" TEXT NOT NULL,
  "staffProfileId" TEXT NOT NULL,
  "documentType" VARCHAR(80) NOT NULL,
  "title" VARCHAR(240) NOT NULL,
  "fileName" VARCHAR(255) NOT NULL,
  "contentType" VARCHAR(160) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "checksumSha256" VARCHAR(64) NOT NULL,
  "objectKey" VARCHAR(700) NOT NULL,
  "effectiveAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "state" VARCHAR(80) NOT NULL DEFAULT 'active',
  "uploadedByProfileId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffEmploymentDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffEmploymentChange" (
  "id" TEXT NOT NULL,
  "staffProfileId" TEXT NOT NULL,
  "changeType" VARCHAR(80) NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "fromDepartmentId" TEXT,
  "toDepartmentId" TEXT,
  "fromDesignationId" TEXT,
  "toDesignationId" TEXT,
  "fromManagerId" TEXT,
  "toManagerId" TEXT,
  "salaryBeforeCents" INTEGER,
  "salaryAfterCents" INTEGER,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
  "benefits" JSONB,
  "privileges" JSONB,
  "notes" VARCHAR(2000),
  "supportingDocumentId" TEXT,
  "createdByProfileId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffEmploymentChange_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffLeaveBalance" (
  "id" TEXT NOT NULL,
  "staffProfileId" TEXT NOT NULL,
  "leaveType" VARCHAR(80) NOT NULL,
  "year" INTEGER NOT NULL,
  "entitlementDays" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "usedDays" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "adjustmentDays" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "notes" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffLeaveBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffIdTemplate" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "organisationName" VARCHAR(160) NOT NULL DEFAULT 'Ambulant+',
  "subtitle" VARCHAR(240),
  "backgroundImageRef" VARCHAR(2048),
  "logoImageRef" VARCHAR(2048),
  "accentHex" VARCHAR(16) NOT NULL DEFAULT '#0f172a',
  "footerText" VARCHAR(240),
  "validityMonths" INTEGER NOT NULL DEFAULT 12,
  "createdByProfileId" TEXT NOT NULL,
  "updatedByProfileId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffIdTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_staff_page_activity_session_path_key"
  ON "AdminStaffPageActivity"("sessionId", "path");
CREATE INDEX "AdminStaffPageActivity_staffProfileId_lastSeenAt_idx"
  ON "AdminStaffPageActivity"("staffProfileId", "lastSeenAt");
CREATE INDEX "AdminStaffPageActivity_staffProfileId_path_idx"
  ON "AdminStaffPageActivity"("staffProfileId", "path");

CREATE INDEX "AdminStaffSession_staffProfileId_loginAt_idx"
  ON "AdminStaffSession"("staffProfileId", "loginAt");
CREATE INDEX "AdminStaffSession_userId_loginAt_idx"
  ON "AdminStaffSession"("userId", "loginAt");
CREATE INDEX "AdminStaffSession_lastHeartbeatAt_idx"
  ON "AdminStaffSession"("lastHeartbeatAt");

CREATE UNIQUE INDEX "StaffNotification_dedupeKey_key"
  ON "StaffNotification"("dedupeKey");
CREATE INDEX "StaffNotification_recipientProfileId_readAt_createdAt_idx"
  ON "StaffNotification"("recipientProfileId", "readAt", "createdAt");
CREATE INDEX "StaffNotification_recipientProfileId_type_createdAt_idx"
  ON "StaffNotification"("recipientProfileId", "type", "createdAt");
CREATE INDEX "StaffNotification_conversationId_createdAt_idx"
  ON "StaffNotification"("conversationId", "createdAt");
CREATE INDEX "StaffNotification_meetingId_createdAt_idx"
  ON "StaffNotification"("meetingId", "createdAt");

CREATE UNIQUE INDEX "StaffEmploymentDocument_objectKey_key"
  ON "StaffEmploymentDocument"("objectKey");
CREATE INDEX "StaffEmploymentDocument_staffProfileId_documentType_createdAt_idx"
  ON "StaffEmploymentDocument"("staffProfileId", "documentType", "createdAt");
CREATE INDEX "StaffEmploymentDocument_state_createdAt_idx"
  ON "StaffEmploymentDocument"("state", "createdAt");

CREATE INDEX "StaffEmploymentChange_staffProfileId_effectiveAt_idx"
  ON "StaffEmploymentChange"("staffProfileId", "effectiveAt");
CREATE INDEX "StaffEmploymentChange_changeType_effectiveAt_idx"
  ON "StaffEmploymentChange"("changeType", "effectiveAt");

CREATE UNIQUE INDEX "staff_leave_balance_profile_type_year_key"
  ON "StaffLeaveBalance"("staffProfileId", "leaveType", "year");
CREATE INDEX "StaffLeaveBalance_staffProfileId_year_idx"
  ON "StaffLeaveBalance"("staffProfileId", "year");

CREATE INDEX "StaffIdTemplate_active_updatedAt_idx"
  ON "StaffIdTemplate"("active", "updatedAt");

ALTER TABLE "AdminStaffSession"
  ADD CONSTRAINT "AdminStaffSession_staffProfileId_fkey"
  FOREIGN KEY ("staffProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminStaffPageActivity"
  ADD CONSTRAINT "AdminStaffPageActivity_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AdminStaffSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminStaffPageActivity"
  ADD CONSTRAINT "AdminStaffPageActivity_staffProfileId_fkey"
  FOREIGN KEY ("staffProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffNotification"
  ADD CONSTRAINT "StaffNotification_recipientProfileId_fkey"
  FOREIGN KEY ("recipientProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffNotification"
  ADD CONSTRAINT "StaffNotification_actorProfileId_fkey"
  FOREIGN KEY ("actorProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StaffNotification"
  ADD CONSTRAINT "StaffNotification_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "StaffConversation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffNotification"
  ADD CONSTRAINT "StaffNotification_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffEmploymentDocument"
  ADD CONSTRAINT "StaffEmploymentDocument_staffProfileId_fkey"
  FOREIGN KEY ("staffProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffEmploymentDocument"
  ADD CONSTRAINT "StaffEmploymentDocument_uploadedByProfileId_fkey"
  FOREIGN KEY ("uploadedByProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffEmploymentChange"
  ADD CONSTRAINT "StaffEmploymentChange_staffProfileId_fkey"
  FOREIGN KEY ("staffProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffEmploymentChange"
  ADD CONSTRAINT "StaffEmploymentChange_createdByProfileId_fkey"
  FOREIGN KEY ("createdByProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffLeaveBalance"
  ADD CONSTRAINT "StaffLeaveBalance_staffProfileId_fkey"
  FOREIGN KEY ("staffProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffIdTemplate"
  ADD CONSTRAINT "StaffIdTemplate_createdByProfileId_fkey"
  FOREIGN KEY ("createdByProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffIdTemplate"
  ADD CONSTRAINT "StaffIdTemplate_updatedByProfileId_fkey"
  FOREIGN KEY ("updatedByProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Opportunity gallery images: featured image remains on Opportunity for cards/SEO.
-- Additional governed images are ordered and published with the opportunity.
CREATE TABLE "OpportunityGalleryImage" (
  "id" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "mediaRef" VARCHAR(2048) NOT NULL,
  "altText" VARCHAR(240) NOT NULL,
  "caption" VARCHAR(500),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdByProfileId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OpportunityGalleryImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpportunityGalleryImage_mediaRef_key"
  ON "OpportunityGalleryImage"("mediaRef");
CREATE INDEX "OpportunityGalleryImage_opportunityId_sortOrder_createdAt_idx"
  ON "OpportunityGalleryImage"("opportunityId", "sortOrder", "createdAt");
CREATE INDEX "OpportunityGalleryImage_createdByProfileId_createdAt_idx"
  ON "OpportunityGalleryImage"("createdByProfileId", "createdAt");

ALTER TABLE "OpportunityGalleryImage"
  ADD CONSTRAINT "OpportunityGalleryImage_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OpportunityGalleryImage"
  ADD CONSTRAINT "OpportunityGalleryImage_createdByProfileId_fkey"
  FOREIGN KEY ("createdByProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
