-- CreateEnum
CREATE TYPE "ConsultationInviteIntent" AS ENUM ('LIVE_JOIN_NOW', 'FOLLOWUP_BOOKING');

-- CreateEnum
CREATE TYPE "ConsultationInviteQuoteStatus" AS ENUM ('REQUESTED', 'APPROVED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConsultationInviteLineRole" AS ENUM ('ADVISOR', 'CO_CLINICIAN', 'TAKEOVER_FOLLOWUP');

-- CreateEnum
CREATE TYPE "CollaborativeAppointmentDraftStatus" AS ENUM ('DRAFT', 'QUOTED', 'APPROVED', 'DECLINED', 'BOOKED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LadyCenterMode" AS ENUM ('cycle', 'symptoms', 'pregnancy', 'menopause');

-- CreateEnum
CREATE TYPE "LadyCenterDocumentTag" AS ENUM ('Gynae', 'Labs', 'Imaging', 'Rx', 'Notes');

-- CreateEnum
CREATE TYPE "LadyCenterScreeningStatus" AS ENUM ('due', 'ok', 'overdue', 'unknown');

-- CreateEnum
CREATE TYPE "LadyCenterSexAtBirth" AS ENUM ('female', 'male', 'intersex', 'unknown');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ClinicianFeeKind" ADD VALUE 'CO_SESSION';
ALTER TYPE "ClinicianFeeKind" ADD VALUE 'ADVISOR';
ALTER TYPE "ClinicianFeeKind" ADD VALUE 'TAKEOVER_FOLLOWUP';

-- CreateTable
CREATE TABLE "ConsultationSessionInviteQuote" (
    "id" TEXT NOT NULL,
    "consultationSessionId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "encounterId" TEXT,
    "caseId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "leadClinicianId" TEXT NOT NULL,
    "requestedByClinicianId" TEXT NOT NULL,
    "intent" "ConsultationInviteIntent" NOT NULL DEFAULT 'LIVE_JOIN_NOW',
    "status" "ConsultationInviteQuoteStatus" NOT NULL DEFAULT 'REQUESTED',
    "currency" VARCHAR(3) NOT NULL,
    "subtotalMinor" INTEGER NOT NULL,
    "coveredMinor" INTEGER NOT NULL DEFAULT 0,
    "copayMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL,
    "sponsorDecisionJson" JSONB,
    "payloadJson" JSONB,
    "metadata" JSONB,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',

    CONSTRAINT "ConsultationSessionInviteQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationSessionInviteQuoteLine" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "role" "ConsultationInviteLineRole" NOT NULL,
    "feeKind" "ClinicianFeeKind" NOT NULL,
    "visitMode" "AppointmentVisitMode" NOT NULL,
    "specialty" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "amountMinor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',

    CONSTRAINT "ConsultationSessionInviteQuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaborativeAppointmentDraft" (
    "id" TEXT NOT NULL,
    "sourceConsultationSessionId" TEXT,
    "sourceEncounterId" TEXT,
    "appointmentId" TEXT,
    "caseId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "leadClinicianId" TEXT NOT NULL,
    "requestedByClinicianId" TEXT NOT NULL,
    "status" "CollaborativeAppointmentDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "visitMode" "AppointmentVisitMode" NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "durationMin" INTEGER,
    "currency" VARCHAR(3) NOT NULL,
    "subtotalMinor" INTEGER NOT NULL DEFAULT 0,
    "coveredMinor" INTEGER NOT NULL DEFAULT 0,
    "copayMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "sponsorDecisionJson" JSONB,
    "payloadJson" JSONB,
    "metadata" JSONB,
    "approvedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "bookedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',

    CONSTRAINT "CollaborativeAppointmentDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaborativeAppointmentDraftLine" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "role" "ConsultationInviteLineRole" NOT NULL,
    "feeKind" "ClinicianFeeKind" NOT NULL,
    "visitMode" "AppointmentVisitMode" NOT NULL,
    "specialty" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "amountMinor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',

    CONSTRAINT "CollaborativeAppointmentDraftLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LadyCenterProfile" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "userId" TEXT,
    "mode" "LadyCenterMode" NOT NULL DEFAULT 'cycle',
    "trackCycle" BOOLEAN NOT NULL DEFAULT true,
    "trackSymptoms" BOOLEAN NOT NULL DEFAULT true,
    "trackVitals" BOOLEAN NOT NULL DEFAULT true,
    "remindScreening" BOOLEAN NOT NULL DEFAULT true,
    "createdAtISO" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sexAtBirth" "LadyCenterSexAtBirth" NOT NULL DEFAULT 'unknown',
    "contraceptiveMethod" TEXT,
    "tryingToConceive" BOOLEAN NOT NULL DEFAULT false,
    "knownConditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LadyCenterProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LadyCenterDayLog" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "period" BOOLEAN NOT NULL DEFAULT false,
    "ovulation" BOOLEAN NOT NULL DEFAULT false,
    "pregnancyTestPositive" BOOLEAN NOT NULL DEFAULT false,
    "meds" TEXT,
    "notes" TEXT,
    "symptoms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sexualEncounter" BOOLEAN NOT NULL DEFAULT false,
    "protectedSex" BOOLEAN,
    "withdrawalUsed" BOOLEAN,
    "emergencyContraception" BOOLEAN NOT NULL DEFAULT false,
    "tryingToConceive" BOOLEAN,
    "contraceptionMethod" TEXT,
    "contraceptionAdherence" TEXT,
    "cycleModifiers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "flowIntensity" INTEGER,
    "painScore" INTEGER,
    "cervicalMucus" TEXT,
    "overnightHrPromptedAt" TIMESTAMP(3),
    "overnightHrPromptStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LadyCenterDayLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LadyCenterNote" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdISO" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LadyCenterNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LadyCenterDocument" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tag" "LadyCenterDocumentTag" NOT NULL,
    "fileName" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "meta" JSONB,
    "createdISO" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LadyCenterDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LadyCenterScreening" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT,
    "desc" TEXT,
    "cadence" TEXT,
    "lastDoneISO" TIMESTAMP(3),
    "nextDueISO" TIMESTAMP(3),
    "status" "LadyCenterScreeningStatus" NOT NULL DEFAULT 'unknown',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LadyCenterScreening_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsultationSessionInviteQuote_consultationSessionId_create_idx" ON "ConsultationSessionInviteQuote"("consultationSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationSessionInviteQuote_appointmentId_createdAt_idx" ON "ConsultationSessionInviteQuote"("appointmentId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationSessionInviteQuote_encounterId_createdAt_idx" ON "ConsultationSessionInviteQuote"("encounterId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationSessionInviteQuote_patientId_createdAt_idx" ON "ConsultationSessionInviteQuote"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationSessionInviteQuote_leadClinicianId_createdAt_idx" ON "ConsultationSessionInviteQuote"("leadClinicianId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationSessionInviteQuote_requestedByClinicianId_creat_idx" ON "ConsultationSessionInviteQuote"("requestedByClinicianId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationSessionInviteQuote_status_createdAt_idx" ON "ConsultationSessionInviteQuote"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationSessionInviteQuote_orgId_status_createdAt_idx" ON "ConsultationSessionInviteQuote"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationSessionInviteQuoteLine_quoteId_createdAt_idx" ON "ConsultationSessionInviteQuoteLine"("quoteId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationSessionInviteQuoteLine_clinicianId_createdAt_idx" ON "ConsultationSessionInviteQuoteLine"("clinicianId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationSessionInviteQuoteLine_role_createdAt_idx" ON "ConsultationSessionInviteQuoteLine"("role", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationSessionInviteQuoteLine_orgId_quoteId_idx" ON "ConsultationSessionInviteQuoteLine"("orgId", "quoteId");

-- CreateIndex
CREATE INDEX "CollaborativeAppointmentDraft_sourceConsultationSessionId_c_idx" ON "CollaborativeAppointmentDraft"("sourceConsultationSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "CollaborativeAppointmentDraft_sourceEncounterId_createdAt_idx" ON "CollaborativeAppointmentDraft"("sourceEncounterId", "createdAt");

-- CreateIndex
CREATE INDEX "CollaborativeAppointmentDraft_appointmentId_createdAt_idx" ON "CollaborativeAppointmentDraft"("appointmentId", "createdAt");

-- CreateIndex
CREATE INDEX "CollaborativeAppointmentDraft_patientId_createdAt_idx" ON "CollaborativeAppointmentDraft"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "CollaborativeAppointmentDraft_leadClinicianId_createdAt_idx" ON "CollaborativeAppointmentDraft"("leadClinicianId", "createdAt");

-- CreateIndex
CREATE INDEX "CollaborativeAppointmentDraft_requestedByClinicianId_create_idx" ON "CollaborativeAppointmentDraft"("requestedByClinicianId", "createdAt");

-- CreateIndex
CREATE INDEX "CollaborativeAppointmentDraft_status_createdAt_idx" ON "CollaborativeAppointmentDraft"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CollaborativeAppointmentDraft_orgId_status_createdAt_idx" ON "CollaborativeAppointmentDraft"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CollaborativeAppointmentDraftLine_draftId_createdAt_idx" ON "CollaborativeAppointmentDraftLine"("draftId", "createdAt");

-- CreateIndex
CREATE INDEX "CollaborativeAppointmentDraftLine_clinicianId_createdAt_idx" ON "CollaborativeAppointmentDraftLine"("clinicianId", "createdAt");

-- CreateIndex
CREATE INDEX "CollaborativeAppointmentDraftLine_role_createdAt_idx" ON "CollaborativeAppointmentDraftLine"("role", "createdAt");

-- CreateIndex
CREATE INDEX "CollaborativeAppointmentDraftLine_orgId_draftId_idx" ON "CollaborativeAppointmentDraftLine"("orgId", "draftId");

-- CreateIndex
CREATE UNIQUE INDEX "LadyCenterProfile_patientId_key" ON "LadyCenterProfile"("patientId");

-- CreateIndex
CREATE INDEX "LadyCenterProfile_userId_idx" ON "LadyCenterProfile"("userId");

-- CreateIndex
CREATE INDEX "LadyCenterProfile_updatedAt_idx" ON "LadyCenterProfile"("updatedAt");

-- CreateIndex
CREATE INDEX "LadyCenterDayLog_patientId_date_idx" ON "LadyCenterDayLog"("patientId", "date");

-- CreateIndex
CREATE INDEX "LadyCenterDayLog_updatedAt_idx" ON "LadyCenterDayLog"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LadyCenterDayLog_patientId_date_key" ON "LadyCenterDayLog"("patientId", "date");

-- CreateIndex
CREATE INDEX "LadyCenterNote_patientId_createdAt_idx" ON "LadyCenterNote"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "LadyCenterDocument_patientId_createdAt_idx" ON "LadyCenterDocument"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "LadyCenterDocument_patientId_tag_createdAt_idx" ON "LadyCenterDocument"("patientId", "tag", "createdAt");

-- CreateIndex
CREATE INDEX "LadyCenterScreening_patientId_status_idx" ON "LadyCenterScreening"("patientId", "status");

-- CreateIndex
CREATE INDEX "LadyCenterScreening_patientId_nextDueISO_idx" ON "LadyCenterScreening"("patientId", "nextDueISO");

-- CreateIndex
CREATE UNIQUE INDEX "LadyCenterScreening_patientId_key_key" ON "LadyCenterScreening"("patientId", "key");

-- AddForeignKey
ALTER TABLE "ConsultationSessionInviteQuote" ADD CONSTRAINT "ConsultationSessionInviteQuote_consultationSessionId_fkey" FOREIGN KEY ("consultationSessionId") REFERENCES "ConsultationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationSessionInviteQuote" ADD CONSTRAINT "ConsultationSessionInviteQuote_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationSessionInviteQuote" ADD CONSTRAINT "ConsultationSessionInviteQuote_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationSessionInviteQuoteLine" ADD CONSTRAINT "ConsultationSessionInviteQuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "ConsultationSessionInviteQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborativeAppointmentDraft" ADD CONSTRAINT "CollaborativeAppointmentDraft_sourceConsultationSessionId_fkey" FOREIGN KEY ("sourceConsultationSessionId") REFERENCES "ConsultationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborativeAppointmentDraft" ADD CONSTRAINT "CollaborativeAppointmentDraft_sourceEncounterId_fkey" FOREIGN KEY ("sourceEncounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborativeAppointmentDraft" ADD CONSTRAINT "CollaborativeAppointmentDraft_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborativeAppointmentDraftLine" ADD CONSTRAINT "CollaborativeAppointmentDraftLine_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "CollaborativeAppointmentDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LadyCenterProfile" ADD CONSTRAINT "LadyCenterProfile_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LadyCenterDayLog" ADD CONSTRAINT "LadyCenterDayLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LadyCenterNote" ADD CONSTRAINT "LadyCenterNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LadyCenterDocument" ADD CONSTRAINT "LadyCenterDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LadyCenterScreening" ADD CONSTRAINT "LadyCenterScreening_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
