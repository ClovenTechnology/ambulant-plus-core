-- CreateEnum
CREATE TYPE "MedicationStatus" AS ENUM ('Active', 'Completed', 'OnHold');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('Pending', 'Taken', 'Missed');

-- CreateTable
CREATE TABLE "DeviceCatalog" (
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "transport" TEXT NOT NULL,
    "services" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceCatalog_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "UserDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "catalogSlug" TEXT NOT NULL,
    "nickname" TEXT,
    "transport" TEXT NOT NULL,
    "pairedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "identifiers" JSONB,
    "meta" JSONB,

    CONSTRAINT "UserDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encounter" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "platformFeeCents" INTEGER NOT NULL,
    "clinicianTakeCents" INTEGER NOT NULL,
    "paymentProvider" TEXT NOT NULL,
    "paymentRef" TEXT,
    "meta" TEXT,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErxOrder" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "drug" TEXT NOT NULL,
    "sig" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErxOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabOrder" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "panel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "meta" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Televisit" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "startsAtMs" BIGINT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "joinOpenLeadSec" INTEGER NOT NULL,
    "joinCloseLagSec" INTEGER NOT NULL,

    CONSTRAINT "Televisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "issuedAt" BIGINT NOT NULL,
    "expiresAt" BIGINT NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuntimeEvent" (
    "id" TEXT NOT NULL,
    "ts" BIGINT NOT NULL,
    "kind" TEXT NOT NULL,
    "encounterId" TEXT,
    "patientId" TEXT,
    "clinicianId" TEXT,
    "payload" TEXT,
    "targetPatientId" TEXT,
    "targetClinicianId" TEXT,
    "targetAdmin" BOOLEAN DEFAULT false,

    CONSTRAINT "RuntimeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "patientId" TEXT,
    "name" TEXT NOT NULL,
    "dose" TEXT,
    "frequency" TEXT,
    "route" TEXT,
    "started" TIMESTAMP(3),
    "lastFilled" TIMESTAMP(3),
    "status" "MedicationStatus" NOT NULL,
    "orderId" TEXT,
    "source" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "medicationId" TEXT,
    "patientId" TEXT,
    "name" TEXT NOT NULL,
    "dose" TEXT,
    "time" TEXT,
    "status" "ReminderStatus" NOT NULL,
    "snoozedUntil" TIMESTAMP(3),
    "source" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicianProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "specialty" TEXT,
    "gender" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "photoUrl" TEXT,
    "boardCertificateUrl" TEXT,
    "boardCertificateNumber" TEXT,
    "boardCertificateIssuer" TEXT,
    "boardCertificateExpires" TIMESTAMP(3),
    "idNumber" TEXT,
    "idIssuingCountry" TEXT,
    "idExpiry" TIMESTAMP(3),
    "qualification" TEXT,
    "qualificationYear" INTEGER,
    "qualificationInstitution" TEXT,
    "otherQualifications" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "payoutAccountId" TEXT,
    "piInsuranceProvider" TEXT,
    "piInsurancePolicyName" TEXT,
    "piInsuranceCoverType" TEXT,
    "piInsuranceExpiry" TIMESTAMP(3),
    "piInsuranceNumber" TEXT,
    "trainingScheduledAt" TIMESTAMP(3),
    "trainingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicianProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "contactEmail" TEXT,
    "phone" TEXT,
    "primaryComm" TEXT,
    "dob" TIMESTAMP(3),
    "idNumber" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "useAsDefaultDelivery" BOOLEAN NOT NULL DEFAULT false,
    "heightCm" INTEGER,
    "weightKg" INTEGER,
    "photoUrl" TEXT,
    "allergies" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "patientId" TEXT,
    "roomId" TEXT,
    "vendor" TEXT,
    "category" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VitalSample" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "t" TIMESTAMP(3) NOT NULL,
    "vType" TEXT NOT NULL,
    "valueNum" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "roomId" TEXT,

    CONSTRAINT "VitalSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentGrant" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "delegateId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ConsentGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EhrIndex" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "patientHash" TEXT NOT NULL,
    "clinicianHash" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "chain" TEXT NOT NULL DEFAULT 'offchain-dev',
    "txId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EhrIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacyPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT,
    "riderId" TEXT,
    "partnerId" TEXT,
    "status" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draw" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT,
    "phlebId" TEXT,
    "partnerId" TEXT,
    "status" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Draw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationPing" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "orderId" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationPing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "subjectId" TEXT,
    "meta" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncounterAnchor" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "txId" TEXT,
    "anchoredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EncounterAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicianSchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'ZA',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
    "template" TEXT NOT NULL,
    "exceptions" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicianSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminConsultPolicy" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "minStandardMinutes" INTEGER NOT NULL DEFAULT 30,
    "minFollowupMinutes" INTEGER NOT NULL DEFAULT 15,
    "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 5,
    "joinGracePatientMin" INTEGER NOT NULL DEFAULT 5,
    "joinGraceClinicianMin" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminConsultPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicianConsultSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultStandardMin" INTEGER NOT NULL DEFAULT 45,
    "defaultFollowupMin" INTEGER NOT NULL DEFAULT 20,
    "minAdvanceMinutes" INTEGER NOT NULL DEFAULT 30,
    "maxAdvanceDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicianConsultSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicianRefundPolicy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "within24hPercent" INTEGER NOT NULL DEFAULT 50,
    "noShowPercent" INTEGER NOT NULL DEFAULT 0,
    "clinicianMissPercent" INTEGER NOT NULL DEFAULT 100,
    "networkProrate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicianRefundPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserDevice_userId_idx" ON "UserDevice"("userId");

-- CreateIndex
CREATE INDEX "UserDevice_catalogSlug_idx" ON "UserDevice"("catalogSlug");

-- CreateIndex
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");

-- CreateIndex
CREATE INDEX "Appointment_clinicianId_idx" ON "Appointment"("clinicianId");

-- CreateIndex
CREATE INDEX "Appointment_startsAt_idx" ON "Appointment"("startsAt");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE INDEX "ErxOrder_patientId_idx" ON "ErxOrder"("patientId");

-- CreateIndex
CREATE INDEX "ErxOrder_clinicianId_idx" ON "ErxOrder"("clinicianId");

-- CreateIndex
CREATE INDEX "ErxOrder_createdAt_idx" ON "ErxOrder"("createdAt");

-- CreateIndex
CREATE INDEX "LabOrder_patientId_idx" ON "LabOrder"("patientId");

-- CreateIndex
CREATE INDEX "LabOrder_clinicianId_idx" ON "LabOrder"("clinicianId");

-- CreateIndex
CREATE INDEX "LabOrder_createdAt_idx" ON "LabOrder"("createdAt");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_updatedAt_idx" ON "Payment"("updatedAt");

-- CreateIndex
CREATE INDEX "RuntimeEvent_ts_idx" ON "RuntimeEvent"("ts");

-- CreateIndex
CREATE INDEX "RuntimeEvent_kind_idx" ON "RuntimeEvent"("kind");

-- CreateIndex
CREATE INDEX "RuntimeEvent_targetPatientId_idx" ON "RuntimeEvent"("targetPatientId");

-- CreateIndex
CREATE INDEX "RuntimeEvent_targetClinicianId_idx" ON "RuntimeEvent"("targetClinicianId");

-- CreateIndex
CREATE INDEX "Medication_patientId_idx" ON "Medication"("patientId");

-- CreateIndex
CREATE INDEX "Medication_status_idx" ON "Medication"("status");

-- CreateIndex
CREATE INDEX "Medication_createdAt_idx" ON "Medication"("createdAt");

-- CreateIndex
CREATE INDEX "Reminder_patientId_idx" ON "Reminder"("patientId");

-- CreateIndex
CREATE INDEX "Reminder_status_idx" ON "Reminder"("status");

-- CreateIndex
CREATE INDEX "Reminder_time_idx" ON "Reminder"("time");

-- CreateIndex
CREATE INDEX "Reminder_createdAt_idx" ON "Reminder"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicianProfile_userId_key" ON "ClinicianProfile"("userId");

-- CreateIndex
CREATE INDEX "ClinicianProfile_specialty_idx" ON "ClinicianProfile"("specialty");

-- CreateIndex
CREATE INDEX "ClinicianProfile_status_idx" ON "ClinicianProfile"("status");

-- CreateIndex
CREATE INDEX "ClinicianProfile_feeCents_idx" ON "ClinicianProfile"("feeCents");

-- CreateIndex
CREATE UNIQUE INDEX "PatientProfile_userId_key" ON "PatientProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceId_key" ON "Device"("deviceId");

-- CreateIndex
CREATE INDEX "Device_patientId_idx" ON "Device"("patientId");

-- CreateIndex
CREATE INDEX "Device_vendor_category_model_idx" ON "Device"("vendor", "category", "model");

-- CreateIndex
CREATE INDEX "VitalSample_patientId_t_idx" ON "VitalSample"("patientId", "t");

-- CreateIndex
CREATE INDEX "VitalSample_roomId_t_idx" ON "VitalSample"("roomId", "t");

-- CreateIndex
CREATE INDEX "VitalSample_deviceId_t_idx" ON "VitalSample"("deviceId", "t");

-- CreateIndex
CREATE INDEX "ConsentGrant_patientId_idx" ON "ConsentGrant"("patientId");

-- CreateIndex
CREATE INDEX "ConsentGrant_delegateId_idx" ON "ConsentGrant"("delegateId");

-- CreateIndex
CREATE INDEX "ConsentGrant_scope_idx" ON "ConsentGrant"("scope");

-- CreateIndex
CREATE INDEX "ConsentGrant_startsAt_idx" ON "ConsentGrant"("startsAt");

-- CreateIndex
CREATE INDEX "EhrIndex_recordId_idx" ON "EhrIndex"("recordId");

-- CreateIndex
CREATE INDEX "EhrIndex_chain_idx" ON "EhrIndex"("chain");

-- CreateIndex
CREATE INDEX "EhrIndex_txId_idx" ON "EhrIndex"("txId");

-- CreateIndex
CREATE INDEX "PharmacyPartner_active_idx" ON "PharmacyPartner"("active");

-- CreateIndex
CREATE INDEX "PharmacyPartner_name_idx" ON "PharmacyPartner"("name");

-- CreateIndex
CREATE INDEX "LabPartner_active_idx" ON "LabPartner"("active");

-- CreateIndex
CREATE INDEX "LabPartner_name_idx" ON "LabPartner"("name");

-- CreateIndex
CREATE INDEX "Delivery_encounterId_idx" ON "Delivery"("encounterId");

-- CreateIndex
CREATE INDEX "Delivery_orderId_idx" ON "Delivery"("orderId");

-- CreateIndex
CREATE INDEX "Delivery_patientId_idx" ON "Delivery"("patientId");

-- CreateIndex
CREATE INDEX "Delivery_clinicianId_idx" ON "Delivery"("clinicianId");

-- CreateIndex
CREATE INDEX "Delivery_riderId_idx" ON "Delivery"("riderId");

-- CreateIndex
CREATE INDEX "Delivery_partnerId_idx" ON "Delivery"("partnerId");

-- CreateIndex
CREATE INDEX "Delivery_status_idx" ON "Delivery"("status");

-- CreateIndex
CREATE INDEX "Delivery_createdAt_idx" ON "Delivery"("createdAt");

-- CreateIndex
CREATE INDEX "Draw_encounterId_idx" ON "Draw"("encounterId");

-- CreateIndex
CREATE INDEX "Draw_orderId_idx" ON "Draw"("orderId");

-- CreateIndex
CREATE INDEX "Draw_patientId_idx" ON "Draw"("patientId");

-- CreateIndex
CREATE INDEX "Draw_clinicianId_idx" ON "Draw"("clinicianId");

-- CreateIndex
CREATE INDEX "Draw_phlebId_idx" ON "Draw"("phlebId");

-- CreateIndex
CREATE INDEX "Draw_partnerId_idx" ON "Draw"("partnerId");

-- CreateIndex
CREATE INDEX "Draw_status_idx" ON "Draw"("status");

-- CreateIndex
CREATE INDEX "Draw_scheduledAt_idx" ON "Draw"("scheduledAt");

-- CreateIndex
CREATE INDEX "Draw_createdAt_idx" ON "Draw"("createdAt");

-- CreateIndex
CREATE INDEX "LocationPing_kind_entityId_at_idx" ON "LocationPing"("kind", "entityId", "at");

-- CreateIndex
CREATE INDEX "LocationPing_orderId_idx" ON "LocationPing"("orderId");

-- CreateIndex
CREATE INDEX "LocationPing_at_idx" ON "LocationPing"("at");

-- CreateIndex
CREATE INDEX "Payout_role_entityId_idx" ON "Payout"("role", "entityId");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE INDEX "Payout_periodStart_periodEnd_idx" ON "Payout"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "AuditEvent_kind_at_idx" ON "AuditEvent"("kind", "at");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_idx" ON "AuditEvent"("actorId");

-- CreateIndex
CREATE INDEX "AuditEvent_subjectId_idx" ON "AuditEvent"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "EncounterAnchor_encounterId_key" ON "EncounterAnchor"("encounterId");

-- CreateIndex
CREATE INDEX "EncounterAnchor_chain_idx" ON "EncounterAnchor"("chain");

-- CreateIndex
CREATE INDEX "EncounterAnchor_txId_idx" ON "EncounterAnchor"("txId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicianSchedule_userId_key" ON "ClinicianSchedule"("userId");

-- CreateIndex
CREATE INDEX "ClinicianSchedule_userId_idx" ON "ClinicianSchedule"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicianConsultSettings_userId_key" ON "ClinicianConsultSettings"("userId");

-- CreateIndex
CREATE INDEX "ClinicianConsultSettings_userId_idx" ON "ClinicianConsultSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicianRefundPolicy_userId_key" ON "ClinicianRefundPolicy"("userId");

-- CreateIndex
CREATE INDEX "ClinicianRefundPolicy_userId_idx" ON "ClinicianRefundPolicy"("userId");

-- AddForeignKey
ALTER TABLE "UserDevice" ADD CONSTRAINT "UserDevice_catalogSlug_fkey" FOREIGN KEY ("catalogSlug") REFERENCES "DeviceCatalog"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErxOrder" ADD CONSTRAINT "ErxOrder_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
