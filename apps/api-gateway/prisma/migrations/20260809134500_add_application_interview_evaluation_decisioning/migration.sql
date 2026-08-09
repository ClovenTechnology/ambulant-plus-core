-- CreateEnum
CREATE TYPE "ApplicationInterviewEvaluationCycleStatus" AS ENUM ('OPEN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ApplicationInterviewEvaluationState" AS ENUM ('DRAFT', 'SUBMITTED', 'WAIVED');

-- CreateEnum
CREATE TYPE "ApplicationRecruitmentDecisionType" AS ENUM ('SUCCESSFUL', 'OFFERED', 'DECLINED');

-- CreateTable
CREATE TABLE "ApplicationInterviewEvaluationCycle" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "formVersionId" TEXT NOT NULL,
    "status" "ApplicationInterviewEvaluationCycleStatus" NOT NULL DEFAULT 'OPEN',
    "aggregateScore" DOUBLE PRECISION,
    "openedByProfileId" TEXT NOT NULL,
    "completedByProfileId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationInterviewEvaluationCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationInterviewEvaluation" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "evaluatorProfileId" TEXT NOT NULL,
    "formSubmissionId" TEXT NOT NULL,
    "state" "ApplicationInterviewEvaluationState" NOT NULL DEFAULT 'DRAFT',
    "score" DOUBLE PRECISION,
    "calculations" JSONB,
    "submittedAt" TIMESTAMP(3),
    "waivedAt" TIMESTAMP(3),
    "waivedByProfileId" TEXT,
    "waiverReason" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationInterviewEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationRecruitmentDecision" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "evaluationCycleId" TEXT,
    "decision" "ApplicationRecruitmentDecisionType" NOT NULL,
    "fromStatus" "ApplicationStatus" NOT NULL,
    "actorProfileId" TEXT NOT NULL,
    "reason" VARCHAR(1000),
    "applicantMessage" VARCHAR(4000),
    "aggregateScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationRecruitmentDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationInterviewEvaluationCycle_meetingId_key" ON "ApplicationInterviewEvaluationCycle"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "application_interview_evaluation_cycle_open_key" ON "ApplicationInterviewEvaluationCycle"("applicationId") WHERE "status" = 'OPEN';

-- CreateIndex
CREATE INDEX "ApplicationInterviewEvaluationCycle_applicationId_status_createdAt_idx" ON "ApplicationInterviewEvaluationCycle"("applicationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationInterviewEvaluationCycle_formVersionId_status_createdAt_idx" ON "ApplicationInterviewEvaluationCycle"("formVersionId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationInterviewEvaluationCycle_openedByProfileId_createdAt_idx" ON "ApplicationInterviewEvaluationCycle"("openedByProfileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationInterviewEvaluation_formSubmissionId_key" ON "ApplicationInterviewEvaluation"("formSubmissionId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationInterviewEvaluation_cycleId_evaluatorProfileId_key" ON "ApplicationInterviewEvaluation"("cycleId", "evaluatorProfileId");

-- CreateIndex
CREATE INDEX "ApplicationInterviewEvaluation_cycleId_state_createdAt_idx" ON "ApplicationInterviewEvaluation"("cycleId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationInterviewEvaluation_evaluatorProfileId_state_createdAt_idx" ON "ApplicationInterviewEvaluation"("evaluatorProfileId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationRecruitmentDecision_applicationId_createdAt_idx" ON "ApplicationRecruitmentDecision"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationRecruitmentDecision_decision_createdAt_idx" ON "ApplicationRecruitmentDecision"("decision", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationRecruitmentDecision_actorProfileId_createdAt_idx" ON "ApplicationRecruitmentDecision"("actorProfileId", "createdAt");

-- AddForeignKey
ALTER TABLE "ApplicationInterviewEvaluationCycle" ADD CONSTRAINT "ApplicationInterviewEvaluationCycle_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationInterviewEvaluationCycle" ADD CONSTRAINT "ApplicationInterviewEvaluationCycle_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationInterviewEvaluationCycle" ADD CONSTRAINT "ApplicationInterviewEvaluationCycle_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "EnterpriseFormVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationInterviewEvaluationCycle" ADD CONSTRAINT "ApplicationInterviewEvaluationCycle_openedByProfileId_fkey" FOREIGN KEY ("openedByProfileId") REFERENCES "AdminUserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationInterviewEvaluationCycle" ADD CONSTRAINT "ApplicationInterviewEvaluationCycle_completedByProfileId_fkey" FOREIGN KEY ("completedByProfileId") REFERENCES "AdminUserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationInterviewEvaluation" ADD CONSTRAINT "ApplicationInterviewEvaluation_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ApplicationInterviewEvaluationCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationInterviewEvaluation" ADD CONSTRAINT "ApplicationInterviewEvaluation_evaluatorProfileId_fkey" FOREIGN KEY ("evaluatorProfileId") REFERENCES "AdminUserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationInterviewEvaluation" ADD CONSTRAINT "ApplicationInterviewEvaluation_formSubmissionId_fkey" FOREIGN KEY ("formSubmissionId") REFERENCES "EnterpriseFormSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationInterviewEvaluation" ADD CONSTRAINT "ApplicationInterviewEvaluation_waivedByProfileId_fkey" FOREIGN KEY ("waivedByProfileId") REFERENCES "AdminUserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationRecruitmentDecision" ADD CONSTRAINT "ApplicationRecruitmentDecision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationRecruitmentDecision" ADD CONSTRAINT "ApplicationRecruitmentDecision_evaluationCycleId_fkey" FOREIGN KEY ("evaluationCycleId") REFERENCES "ApplicationInterviewEvaluationCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationRecruitmentDecision" ADD CONSTRAINT "ApplicationRecruitmentDecision_actorProfileId_fkey" FOREIGN KEY ("actorProfileId") REFERENCES "AdminUserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DomainChecks
ALTER TABLE "ApplicationInterviewEvaluationCycle"
ADD CONSTRAINT "ApplicationInterviewEvaluationCycle_completion_state_check"
CHECK (
  ("status" = 'OPEN' AND "completedAt" IS NULL AND "completedByProfileId" IS NULL)
  OR
  ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL)
);

ALTER TABLE "ApplicationInterviewEvaluation"
ADD CONSTRAINT "ApplicationInterviewEvaluation_state_evidence_check"
CHECK (
  ("state" = 'DRAFT' AND "submittedAt" IS NULL AND "waivedAt" IS NULL AND "waivedByProfileId" IS NULL AND "waiverReason" IS NULL)
  OR
  ("state" = 'SUBMITTED' AND "submittedAt" IS NOT NULL AND "waivedAt" IS NULL AND "waivedByProfileId" IS NULL AND "waiverReason" IS NULL)
  OR
  ("state" = 'WAIVED' AND "submittedAt" IS NULL AND "waivedAt" IS NOT NULL AND "waiverReason" IS NOT NULL AND btrim("waiverReason") <> '')
);

ALTER TABLE "ApplicationRecruitmentDecision"
ADD CONSTRAINT "ApplicationRecruitmentDecision_transition_check"
CHECK (
  ("fromStatus" = 'INTERVIEWED' AND "decision" IN ('SUCCESSFUL', 'OFFERED', 'DECLINED'))
  OR
  ("fromStatus" = 'SUCCESSFUL' AND "decision" = 'OFFERED')
);

ALTER TABLE "ApplicationRecruitmentDecision"
ADD CONSTRAINT "ApplicationRecruitmentDecision_decline_reason_check"
CHECK (
  "decision" <> 'DECLINED'
  OR ("reason" IS NOT NULL AND btrim("reason") <> '')
);

ALTER TABLE "ApplicationRecruitmentDecision"
ADD CONSTRAINT "ApplicationRecruitmentDecision_offer_message_check"
CHECK (
  "decision" <> 'OFFERED'
  OR ("applicantMessage" IS NOT NULL AND btrim("applicantMessage") <> '')
);
