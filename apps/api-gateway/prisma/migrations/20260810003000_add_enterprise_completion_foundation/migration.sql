-- CreateEnum
CREATE TYPE "RecruitmentTemplateStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ApplicationStaffConversionStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StaffConversationKind" AS ENUM ('DIRECT', 'GROUP');

-- CreateEnum
CREATE TYPE "StaffConversationMemberRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateTable
CREATE TABLE "RecruitmentTemplate" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "name" VARCHAR(240) NOT NULL,
    "description" TEXT,
    "opportunityType" "OpportunityType",
    "opportunityTitle" VARCHAR(240),
    "opportunitySummary" VARCHAR(1200),
    "opportunityDescription" TEXT,
    "applicationFormId" TEXT,
    "evaluationFormVersionId" TEXT,
    "defaultDepartmentId" TEXT,
    "defaultDesignationId" TEXT,
    "defaultRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "settings" JSONB,
    "status" "RecruitmentTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByProfileId" TEXT NOT NULL,
    "updatedByProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecruitmentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentSettings" (
    "key" VARCHAR(120) NOT NULL DEFAULT 'global',
    "defaultTemplateId" TEXT,
    "onboardingMessage" VARCHAR(4000),
    "requireCredentialBeforeApproval" BOOLEAN NOT NULL DEFAULT true,
    "updatedByProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecruitmentSettings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ApplicationStaffConversion" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "roleRequestId" TEXT NOT NULL,
    "staffProfileId" TEXT,
    "status" "ApplicationStaffConversionStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "initiatedByProfileId" TEXT NOT NULL,
    "activatedByProfileId" TEXT,
    "notes" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),
    CONSTRAINT "ApplicationStaffConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffConversation" (
    "id" TEXT NOT NULL,
    "kind" "StaffConversationKind" NOT NULL,
    "title" VARCHAR(240),
    "directKey" VARCHAR(160),
    "createdByProfileId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffConversationMember" (
    "conversationId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "role" "StaffConversationMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3),
    CONSTRAINT "StaffConversationMember_pkey" PRIMARY KEY ("conversationId","profileId")
);

-- CreateTable
CREATE TABLE "StaffMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderProfileId" TEXT NOT NULL,
    "body" VARCHAR(8000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "StaffMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingChatMessage" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "senderProfileId" TEXT NOT NULL,
    "body" VARCHAR(8000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "MeetingChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentTemplate_key_key" ON "RecruitmentTemplate"("key");
CREATE INDEX "RecruitmentTemplate_status_opportunityType_createdAt_idx" ON "RecruitmentTemplate"("status", "opportunityType", "createdAt");
CREATE INDEX "RecruitmentTemplate_applicationFormId_idx" ON "RecruitmentTemplate"("applicationFormId");
CREATE INDEX "RecruitmentTemplate_evaluationFormVersionId_idx" ON "RecruitmentTemplate"("evaluationFormVersionId");
CREATE INDEX "RecruitmentTemplate_defaultDepartmentId_defaultDesignationId_idx" ON "RecruitmentTemplate"("defaultDepartmentId", "defaultDesignationId");
CREATE INDEX "RecruitmentSettings_defaultTemplateId_idx" ON "RecruitmentSettings"("defaultTemplateId");
CREATE UNIQUE INDEX "ApplicationStaffConversion_applicationId_key" ON "ApplicationStaffConversion"("applicationId");
CREATE UNIQUE INDEX "ApplicationStaffConversion_roleRequestId_key" ON "ApplicationStaffConversion"("roleRequestId");
CREATE UNIQUE INDEX "ApplicationStaffConversion_staffProfileId_key" ON "ApplicationStaffConversion"("staffProfileId");
CREATE INDEX "ApplicationStaffConversion_status_createdAt_idx" ON "ApplicationStaffConversion"("status", "createdAt");
CREATE INDEX "ApplicationStaffConversion_initiatedByProfileId_createdAt_idx" ON "ApplicationStaffConversion"("initiatedByProfileId", "createdAt");
CREATE UNIQUE INDEX "StaffConversation_directKey_key" ON "StaffConversation"("directKey");
CREATE INDEX "StaffConversation_kind_lastMessageAt_updatedAt_idx" ON "StaffConversation"("kind", "lastMessageAt", "updatedAt");
CREATE INDEX "StaffConversation_createdByProfileId_createdAt_idx" ON "StaffConversation"("createdByProfileId", "createdAt");
CREATE INDEX "StaffConversationMember_profileId_leftAt_joinedAt_idx" ON "StaffConversationMember"("profileId", "leftAt", "joinedAt");
CREATE INDEX "StaffMessage_conversationId_createdAt_idx" ON "StaffMessage"("conversationId", "createdAt");
CREATE INDEX "StaffMessage_senderProfileId_createdAt_idx" ON "StaffMessage"("senderProfileId", "createdAt");
CREATE INDEX "MeetingChatMessage_meetingId_createdAt_idx" ON "MeetingChatMessage"("meetingId", "createdAt");
CREATE INDEX "MeetingChatMessage_senderProfileId_createdAt_idx" ON "MeetingChatMessage"("senderProfileId", "createdAt");

-- AddForeignKey
ALTER TABLE "RecruitmentTemplate" ADD CONSTRAINT "RecruitmentTemplate_applicationFormId_fkey" FOREIGN KEY ("applicationFormId") REFERENCES "EnterpriseForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecruitmentTemplate" ADD CONSTRAINT "RecruitmentTemplate_evaluationFormVersionId_fkey" FOREIGN KEY ("evaluationFormVersionId") REFERENCES "EnterpriseFormVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecruitmentTemplate" ADD CONSTRAINT "RecruitmentTemplate_defaultDepartmentId_fkey" FOREIGN KEY ("defaultDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecruitmentTemplate" ADD CONSTRAINT "RecruitmentTemplate_defaultDesignationId_fkey" FOREIGN KEY ("defaultDesignationId") REFERENCES "Designation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecruitmentTemplate" ADD CONSTRAINT "RecruitmentTemplate_createdByProfileId_fkey" FOREIGN KEY ("createdByProfileId") REFERENCES "AdminUserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecruitmentTemplate" ADD CONSTRAINT "RecruitmentTemplate_updatedByProfileId_fkey" FOREIGN KEY ("updatedByProfileId") REFERENCES "AdminUserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecruitmentSettings" ADD CONSTRAINT "RecruitmentSettings_defaultTemplateId_fkey" FOREIGN KEY ("defaultTemplateId") REFERENCES "RecruitmentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecruitmentSettings" ADD CONSTRAINT "RecruitmentSettings_updatedByProfileId_fkey" FOREIGN KEY ("updatedByProfileId") REFERENCES "AdminUserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicationStaffConversion" ADD CONSTRAINT "ApplicationStaffConversion_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationStaffConversion" ADD CONSTRAINT "ApplicationStaffConversion_roleRequestId_fkey" FOREIGN KEY ("roleRequestId") REFERENCES "RoleRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicationStaffConversion" ADD CONSTRAINT "ApplicationStaffConversion_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "AdminUserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApplicationStaffConversion" ADD CONSTRAINT "ApplicationStaffConversion_initiatedByProfileId_fkey" FOREIGN KEY ("initiatedByProfileId") REFERENCES "AdminUserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicationStaffConversion" ADD CONSTRAINT "ApplicationStaffConversion_activatedByProfileId_fkey" FOREIGN KEY ("activatedByProfileId") REFERENCES "AdminUserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StaffConversation" ADD CONSTRAINT "StaffConversation_createdByProfileId_fkey" FOREIGN KEY ("createdByProfileId") REFERENCES "AdminUserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffConversationMember" ADD CONSTRAINT "StaffConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "StaffConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffConversationMember" ADD CONSTRAINT "StaffConversationMember_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AdminUserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffMessage" ADD CONSTRAINT "StaffMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "StaffConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffMessage" ADD CONSTRAINT "StaffMessage_senderProfileId_fkey" FOREIGN KEY ("senderProfileId") REFERENCES "AdminUserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeetingChatMessage" ADD CONSTRAINT "MeetingChatMessage_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingChatMessage" ADD CONSTRAINT "MeetingChatMessage_senderProfileId_fkey" FOREIGN KEY ("senderProfileId") REFERENCES "AdminUserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DomainChecks
ALTER TABLE "RecruitmentTemplate"
ADD CONSTRAINT "RecruitmentTemplate_default_designation_department_check"
CHECK ("defaultDesignationId" IS NULL OR "defaultDepartmentId" IS NOT NULL);

ALTER TABLE "ApplicationStaffConversion"
ADD CONSTRAINT "ApplicationStaffConversion_activation_state_check"
CHECK (
  ("status" = 'ACTIVE' AND "staffProfileId" IS NOT NULL AND "activatedAt" IS NOT NULL AND "activatedByProfileId" IS NOT NULL)
  OR
  ("status" <> 'ACTIVE' AND "activatedAt" IS NULL)
);

ALTER TABLE "StaffConversation"
ADD CONSTRAINT "StaffConversation_direct_shape_check"
CHECK (
  ("kind" = 'DIRECT' AND "directKey" IS NOT NULL)
  OR
  ("kind" = 'GROUP' AND "directKey" IS NULL AND "title" IS NOT NULL AND btrim("title") <> '')
);

ALTER TABLE "StaffMessage"
ADD CONSTRAINT "StaffMessage_body_check"
CHECK (btrim("body") <> '');

ALTER TABLE "MeetingChatMessage"
ADD CONSTRAINT "MeetingChatMessage_body_check"
CHECK (btrim("body") <> '');
