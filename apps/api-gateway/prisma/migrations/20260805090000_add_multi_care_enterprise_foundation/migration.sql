-- CreateEnum
CREATE TYPE "MultiCarePricingMode" AS ENUM ('FULL_FEE_PER_RECIPIENT', 'BASE_PLUS_ADDITIONAL', 'FIXED_PACKAGE', 'NO_ADDITIONAL_FEE');

-- CreateEnum
CREATE TYPE "AppointmentParticipantRole" AS ENUM ('LEAD_CLINICIAN', 'CO_CLINICIAN', 'ADVISOR', 'PRIMARY_PATIENT', 'DEPENDANT_PATIENT', 'SECOND_PATIENT_PARTICIPANT', 'GUARDIAN', 'CARE_ALLY', 'INTERPRETER', 'OBSERVER');

-- CreateEnum
CREATE TYPE "AppointmentParticipantStatus" AS ENUM ('PENDING_INVITATION', 'PENDING_ACCEPTANCE', 'ACCEPTED', 'DECLINED', 'REVOKED', 'REMOVED');

-- CreateEnum
CREATE TYPE "AppointmentCareRecipientRole" AS ENUM ('PRIMARY', 'DEPENDANT', 'ADDITIONAL');

-- CreateEnum
CREATE TYPE "AppointmentCareRecipientStatus" AS ENUM ('PENDING_INVITATION', 'PENDING_IDENTITY_VERIFICATION', 'READY', 'DECLINED', 'REMOVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AppointmentInvitationStatus" AS ENUM ('PENDING', 'OPENED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "ClinicianMultiCarePolicy" (
    "id" TEXT NOT NULL,
    "clinicianUserId" TEXT NOT NULL,
    "feeKind" "ClinicianFeeKind" NOT NULL,
    "visitMode" "VisitMode" NOT NULL DEFAULT 'televisit',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "pricingMode" "MultiCarePricingMode" NOT NULL DEFAULT 'BASE_PLUS_ADDITIONAL',
    "currency" VARCHAR(3) NOT NULL,
    "includedCareRecipients" INTEGER NOT NULL DEFAULT 1,
    "additionalRecipientAmountMinor" INTEGER,
    "additionalRecipientPercentBps" INTEGER,
    "packageAmountMinor" INTEGER,
    "maxCareRecipients" INTEGER NOT NULL DEFAULT 2,
    "additionalMinutesPerRecipient" INTEGER NOT NULL DEFAULT 0,
    "maxAdditionalMinutes" INTEGER,
    "requireAllRecipientsVerifiedBeforeCheckout" BOOLEAN NOT NULL DEFAULT true,
    "allowPendingAdultInvitations" BOOLEAN NOT NULL DEFAULT false,
    "allowProvisionalDependentProfiles" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicianMultiCarePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentCareRecipient" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "patientId" TEXT,
    "encounterId" TEXT,
    "pricingPolicyId" TEXT,
    "role" "AppointmentCareRecipientRole" NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "hostUserId" TEXT,
    "familyRelationshipId" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" "AppointmentCareRecipientStatus" NOT NULL DEFAULT 'READY',
    "identityVerifiedAt" TIMESTAMP(3),
    "identityVerifiedByUserId" TEXT,
    "reason" TEXT,
    "baseAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "additionalAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "discountMinor" INTEGER NOT NULL DEFAULT 0,
    "grossAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "sponsorAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "patientPayableMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL,
    "coverageDecision" TEXT,
    "coverageAuthorizationId" TEXT,
    "pricingSnapshot" JSONB,
    "coverageSnapshot" JSONB,
    "metadata" JSONB,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentCareRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentParticipant" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "careRecipientId" TEXT,
    "partyId" TEXT NOT NULL,
    "role" "AppointmentParticipantRole" NOT NULL,
    "patientId" TEXT,
    "clinicianId" TEXT,
    "userId" TEXT,
    "hostUserId" TEXT,
    "familyRelationshipId" TEXT,
    "displayName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "status" "AppointmentParticipantStatus" NOT NULL DEFAULT 'ACCEPTED',
    "consentRequired" BOOLEAN NOT NULL DEFAULT true,
    "canJoinTelevisit" BOOLEAN NOT NULL DEFAULT true,
    "canViewHealth" BOOLEAN NOT NULL DEFAULT false,
    "canBookAppointments" BOOLEAN NOT NULL DEFAULT false,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentParticipantInvitation" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "careRecipientId" TEXT,
    "tokenHash" VARCHAR(128) NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "invitedEmail" TEXT,
    "invitedPhone" TEXT,
    "status" "AppointmentInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "openedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "linkedPatientId" TEXT,
    "verificationState" TEXT,
    "sendAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "metadata" JSONB,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentParticipantInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClinicianMultiCarePolicy_clinicianUserId_feeKind_visitMode__idx" ON "ClinicianMultiCarePolicy"("clinicianUserId", "feeKind", "visitMode", "enabled", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ClinicianMultiCarePolicy_orgId_clinicianUserId_idx" ON "ClinicianMultiCarePolicy"("orgId", "clinicianUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicianMultiCarePolicy_clinicianUserId_feeKind_visitMode__key" ON "ClinicianMultiCarePolicy"("clinicianUserId", "feeKind", "visitMode", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentCareRecipient_encounterId_key" ON "AppointmentCareRecipient"("encounterId");

-- CreateIndex
CREATE INDEX "AppointmentCareRecipient_appointmentId_role_status_idx" ON "AppointmentCareRecipient"("appointmentId", "role", "status");

-- CreateIndex
CREATE INDEX "AppointmentCareRecipient_patientId_idx" ON "AppointmentCareRecipient"("patientId");

-- CreateIndex
CREATE INDEX "AppointmentCareRecipient_hostUserId_idx" ON "AppointmentCareRecipient"("hostUserId");

-- CreateIndex
CREATE INDEX "AppointmentCareRecipient_familyRelationshipId_idx" ON "AppointmentCareRecipient"("familyRelationshipId");

-- CreateIndex
CREATE INDEX "AppointmentCareRecipient_pricingPolicyId_idx" ON "AppointmentCareRecipient"("pricingPolicyId");

-- CreateIndex
CREATE INDEX "AppointmentCareRecipient_coverageAuthorizationId_idx" ON "AppointmentCareRecipient"("coverageAuthorizationId");

-- CreateIndex
CREATE INDEX "AppointmentCareRecipient_orgId_appointmentId_idx" ON "AppointmentCareRecipient"("orgId", "appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentCareRecipient_appointmentId_patientId_key" ON "AppointmentCareRecipient"("appointmentId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentCareRecipient_appointmentId_sequence_key" ON "AppointmentCareRecipient"("appointmentId", "sequence");

-- CreateIndex
CREATE INDEX "AppointmentParticipant_appointmentId_role_status_idx" ON "AppointmentParticipant"("appointmentId", "role", "status");

-- CreateIndex
CREATE INDEX "AppointmentParticipant_careRecipientId_idx" ON "AppointmentParticipant"("careRecipientId");

-- CreateIndex
CREATE INDEX "AppointmentParticipant_patientId_idx" ON "AppointmentParticipant"("patientId");

-- CreateIndex
CREATE INDEX "AppointmentParticipant_clinicianId_idx" ON "AppointmentParticipant"("clinicianId");

-- CreateIndex
CREATE INDEX "AppointmentParticipant_userId_idx" ON "AppointmentParticipant"("userId");

-- CreateIndex
CREATE INDEX "AppointmentParticipant_hostUserId_idx" ON "AppointmentParticipant"("hostUserId");

-- CreateIndex
CREATE INDEX "AppointmentParticipant_familyRelationshipId_idx" ON "AppointmentParticipant"("familyRelationshipId");

-- CreateIndex
CREATE INDEX "AppointmentParticipant_orgId_appointmentId_idx" ON "AppointmentParticipant"("orgId", "appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentParticipant_appointmentId_partyId_key" ON "AppointmentParticipant"("appointmentId", "partyId");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentParticipantInvitation_tokenHash_key" ON "AppointmentParticipantInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "AppointmentParticipantInvitation_appointmentId_status_expir_idx" ON "AppointmentParticipantInvitation"("appointmentId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "AppointmentParticipantInvitation_participantId_idx" ON "AppointmentParticipantInvitation"("participantId");

-- CreateIndex
CREATE INDEX "AppointmentParticipantInvitation_careRecipientId_idx" ON "AppointmentParticipantInvitation"("careRecipientId");

-- CreateIndex
CREATE INDEX "AppointmentParticipantInvitation_invitedEmail_idx" ON "AppointmentParticipantInvitation"("invitedEmail");

-- CreateIndex
CREATE INDEX "AppointmentParticipantInvitation_invitedPhone_idx" ON "AppointmentParticipantInvitation"("invitedPhone");

-- CreateIndex
CREATE INDEX "AppointmentParticipantInvitation_linkedPatientId_idx" ON "AppointmentParticipantInvitation"("linkedPatientId");

-- CreateIndex
CREATE INDEX "AppointmentParticipantInvitation_orgId_appointmentId_idx" ON "AppointmentParticipantInvitation"("orgId", "appointmentId");

-- AddForeignKey
ALTER TABLE "ClinicianMultiCarePolicy" ADD CONSTRAINT "ClinicianMultiCarePolicy_clinicianUserId_fkey" FOREIGN KEY ("clinicianUserId") REFERENCES "ClinicianProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentCareRecipient" ADD CONSTRAINT "AppointmentCareRecipient_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentCareRecipient" ADD CONSTRAINT "AppointmentCareRecipient_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentCareRecipient" ADD CONSTRAINT "AppointmentCareRecipient_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentCareRecipient" ADD CONSTRAINT "AppointmentCareRecipient_pricingPolicyId_fkey" FOREIGN KEY ("pricingPolicyId") REFERENCES "ClinicianMultiCarePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentCareRecipient" ADD CONSTRAINT "AppointmentCareRecipient_familyRelationshipId_fkey" FOREIGN KEY ("familyRelationshipId") REFERENCES "FamilyRelationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentParticipant" ADD CONSTRAINT "AppointmentParticipant_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentParticipant" ADD CONSTRAINT "AppointmentParticipant_careRecipientId_fkey" FOREIGN KEY ("careRecipientId") REFERENCES "AppointmentCareRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentParticipant" ADD CONSTRAINT "AppointmentParticipant_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentParticipant" ADD CONSTRAINT "AppointmentParticipant_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentParticipant" ADD CONSTRAINT "AppointmentParticipant_familyRelationshipId_fkey" FOREIGN KEY ("familyRelationshipId") REFERENCES "FamilyRelationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentParticipantInvitation" ADD CONSTRAINT "AppointmentParticipantInvitation_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentParticipantInvitation" ADD CONSTRAINT "AppointmentParticipantInvitation_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "AppointmentParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentParticipantInvitation" ADD CONSTRAINT "AppointmentParticipantInvitation_careRecipientId_fkey" FOREIGN KEY ("careRecipientId") REFERENCES "AppointmentCareRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentParticipantInvitation" ADD CONSTRAINT "AppointmentParticipantInvitation_linkedPatientId_fkey" FOREIGN KEY ("linkedPatientId") REFERENCES "PatientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
