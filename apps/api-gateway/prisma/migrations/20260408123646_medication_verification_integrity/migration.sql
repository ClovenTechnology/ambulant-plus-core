-- CreateEnum
CREATE TYPE "ConsultationSessionState" AS ENUM ('CREATED', 'READY', 'CHECKED_IN', 'ACTIVE', 'INTERRUPTED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'ABORTED');

-- CreateEnum
CREATE TYPE "ConsultationActorType" AS ENUM ('PATIENT', 'CLINICIAN', 'HOST', 'ADMIN', 'SYSTEM', 'PAYER');

-- CreateEnum
CREATE TYPE "ConsultationOutcomeKind" AS ENUM ('PATIENT_CANCELLED_EARLY', 'PATIENT_CANCELLED_LATE', 'CLINICIAN_CANCELLED', 'PATIENT_NO_SHOW', 'CLINICIAN_NO_SHOW', 'ABORTED_BEFORE_CLINICAL_WORK', 'COMPLETED', 'REFERRED_COMPLETED');

-- CreateEnum
CREATE TYPE "SettlementRefundType" AS ENUM ('NONE', 'FULL', 'PARTIAL', 'CREDIT');

-- CreateEnum
CREATE TYPE "SettlementRefundTarget" AS ENUM ('NONE', 'PATIENT', 'PAYER', 'WALLET');

-- CreateEnum
CREATE TYPE "SettlementPayoutState" AS ENUM ('HOLD', 'RELEASE', 'ZERO');

-- CreateEnum
CREATE TYPE "SettlementClaimState" AS ENUM ('NOT_ELIGIBLE', 'READY', 'SUPPRESS');

-- CreateEnum
CREATE TYPE "ReminderVerificationMode" AS ENUM ('NONE', 'CAMERA_SEQUENCE');

-- CreateEnum
CREATE TYPE "ReminderVerificationStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'IN_PROGRESS', 'VERIFIED', 'SELF_REPORTED', 'FAILED', 'ABORTED');

-- CreateEnum
CREATE TYPE "ReminderTakenSource" AS ENUM ('NONE', 'CAMERA_VERIFIED', 'SELF_REPORTED', 'MANUAL_CLINICIAN', 'IMPORTED_SYSTEM');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "amountMinor" INTEGER,
ADD COLUMN     "discountMinor" INTEGER,
ADD COLUMN     "subtotalMinor" INTEGER,
ADD COLUMN     "taxMinor" INTEGER,
ADD COLUMN     "totalMinor" INTEGER,
ALTER COLUMN "currency" SET DEFAULT 'USD';

-- AlterTable
ALTER TABLE "Encounter" ADD COLUMN     "consultationEndedAt" TIMESTAMP(3),
ADD COLUMN     "consultationStartedAt" TIMESTAMP(3),
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "settlementSnapshot" JSONB,
ADD COLUMN     "summaryPayload" JSONB,
ADD COLUMN     "visitMode" "AppointmentVisitMode";

-- AlterTable
ALTER TABLE "Medication" ADD COLUMN     "manualEarlierLoggingAllowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "verificationModeDefault" "ReminderVerificationMode" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "verificationRequiredDefault" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN     "confidenceScore" DOUBLE PRECISION,
ADD COLUMN     "integrityScore" DOUBLE PRECISION,
ADD COLUMN     "reportedTakenAt" TIMESTAMP(3),
ADD COLUMN     "scheduledFor" TIMESTAMP(3),
ADD COLUMN     "takenAt" TIMESTAMP(3),
ADD COLUMN     "takenSource" "ReminderTakenSource" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "verificationMode" "ReminderVerificationMode" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "verificationRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verificationStatus" "ReminderVerificationStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ConsultationSession" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "encounterId" TEXT,
    "caseId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "hostUserId" TEXT,
    "visitMode" "AppointmentVisitMode" NOT NULL,
    "roomId" TEXT,
    "state" "ConsultationSessionState" NOT NULL DEFAULT 'CREATED',
    "patientCheckedInAt" TIMESTAMP(3),
    "clinicianCheckedInAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" "ConsultationActorType",
    "cancelReason" TEXT,
    "noShowMarkedAt" TIMESTAMP(3),
    "noShowActor" "ConsultationActorType",
    "outcome" "ConsultationOutcomeKind",
    "refundType" "SettlementRefundType" NOT NULL DEFAULT 'NONE',
    "refundTarget" "SettlementRefundTarget" NOT NULL DEFAULT 'NONE',
    "payoutState" "SettlementPayoutState" NOT NULL DEFAULT 'HOLD',
    "claimState" "SettlementClaimState" NOT NULL DEFAULT 'NOT_ELIGIBLE',
    "reasonCode" TEXT,
    "policyVersion" TEXT NOT NULL DEFAULT 'session-policy-v1',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amountAuthorizedMinor" INTEGER,
    "amountCapturedMinor" INTEGER,
    "amountRefundedMinor" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationVerificationSession" (
    "id" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "medicationId" TEXT,
    "patientId" TEXT,
    "requiredMode" "ReminderVerificationMode" NOT NULL DEFAULT 'CAMERA_SEQUENCE',
    "status" "ReminderVerificationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "takenSource" "ReminderTakenSource" NOT NULL DEFAULT 'NONE',
    "claimedTakenAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "interruptedAt" TIMESTAMP(3),
    "offlineCompletedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "platform" TEXT,
    "deviceInfo" JSONB,
    "stepTrace" JSONB,
    "proofManifest" JSONB,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicationVerificationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationSession_appointmentId_key" ON "ConsultationSession"("appointmentId");

-- CreateIndex
CREATE INDEX "ConsultationSession_patientId_createdAt_idx" ON "ConsultationSession"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationSession_clinicianId_createdAt_idx" ON "ConsultationSession"("clinicianId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationSession_caseId_idx" ON "ConsultationSession"("caseId");

-- CreateIndex
CREATE INDEX "ConsultationSession_encounterId_idx" ON "ConsultationSession"("encounterId");

-- CreateIndex
CREATE INDEX "ConsultationSession_state_idx" ON "ConsultationSession"("state");

-- CreateIndex
CREATE INDEX "ConsultationSession_visitMode_idx" ON "ConsultationSession"("visitMode");

-- CreateIndex
CREATE INDEX "MedicationVerificationSession_reminderId_startedAt_idx" ON "MedicationVerificationSession"("reminderId", "startedAt");

-- CreateIndex
CREATE INDEX "MedicationVerificationSession_medicationId_startedAt_idx" ON "MedicationVerificationSession"("medicationId", "startedAt");

-- CreateIndex
CREATE INDEX "MedicationVerificationSession_patientId_startedAt_idx" ON "MedicationVerificationSession"("patientId", "startedAt");

-- CreateIndex
CREATE INDEX "MedicationVerificationSession_status_startedAt_idx" ON "MedicationVerificationSession"("status", "startedAt");

-- CreateIndex
CREATE INDEX "Encounter_sessionId_idx" ON "Encounter"("sessionId");

-- CreateIndex
CREATE INDEX "Encounter_status_idx" ON "Encounter"("status");

-- CreateIndex
CREATE INDEX "Reminder_medicationId_idx" ON "Reminder"("medicationId");

-- CreateIndex
CREATE INDEX "Reminder_scheduledFor_idx" ON "Reminder"("scheduledFor");

-- CreateIndex
CREATE INDEX "Reminder_patientId_scheduledFor_idx" ON "Reminder"("patientId", "scheduledFor");

-- CreateIndex
CREATE INDEX "Reminder_medicationId_scheduledFor_idx" ON "Reminder"("medicationId", "scheduledFor");

-- CreateIndex
CREATE INDEX "Reminder_verificationStatus_scheduledFor_idx" ON "Reminder"("verificationStatus", "scheduledFor");

-- AddForeignKey
ALTER TABLE "MedicationVerificationSession" ADD CONSTRAINT "MedicationVerificationSession_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationVerificationSession" ADD CONSTRAINT "MedicationVerificationSession_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationVerificationSession" ADD CONSTRAINT "MedicationVerificationSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
