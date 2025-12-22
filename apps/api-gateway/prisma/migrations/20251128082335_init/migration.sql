-- CreateEnum
CREATE TYPE "MedReachStatus" AS ENUM ('Assigned', 'EnRoute', 'Arrived', 'Completed', 'Canceled');

-- CreateEnum
CREATE TYPE "CarePortStatus" AS ENUM ('Assigned', 'AtPharmacy', 'OutForDelivery', 'Delivered', 'Canceled');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "orgId" TEXT NOT NULL DEFAULT 'org-default';

-- AlterTable
ALTER TABLE "ClinicianProfile" ADD COLUMN     "lastBookedAt" TIMESTAMP(3),
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "online" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onlineSeq" BIGINT,
ADD COLUMN     "recentBookedCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Device" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Encounter" ADD COLUMN     "orgId" TEXT NOT NULL DEFAULT 'org-default';

-- AlterTable
ALTER TABLE "ErxOrder" ADD COLUMN     "dispenseCode" TEXT,
ADD COLUMN     "labTests" JSONB,
ADD COLUMN     "meds" JSONB,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'queued',
ALTER COLUMN "drug" DROP NOT NULL,
ALTER COLUMN "sig" DROP NOT NULL;

-- AlterTable
ALTER TABLE "LabOrder" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "Medication" ADD COLUMN     "durationDays" INTEGER;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "orgId" TEXT NOT NULL DEFAULT 'org-default';

-- AlterTable
ALTER TABLE "RuntimeEvent" ADD COLUMN     "orgId" TEXT;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderPushSubscription" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Condition" (
    "id" TEXT NOT NULL,
    "patientId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "diagnosedAt" TIMESTAMP(3),
    "facility" TEXT,
    "clinician" TEXT,
    "onAmbulant" BOOLEAN DEFAULT false,
    "notes" TEXT,
    "fileKey" TEXT,
    "fileName" TEXT,
    "ehrTxId" TEXT,
    "source" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Condition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vaccination" (
    "id" TEXT NOT NULL,
    "patientId" TEXT,
    "vaccine" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "batch" TEXT,
    "facility" TEXT,
    "clinician" TEXT,
    "notes" TEXT,
    "fileKey" TEXT,
    "fileName" TEXT,
    "ehrTxId" TEXT,
    "source" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vaccination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" TEXT NOT NULL,
    "patientId" TEXT,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "facility" TEXT,
    "surgeon" TEXT,
    "coClinicians" TEXT[],
    "clinicianCount" INTEGER DEFAULT 1,
    "notes" TEXT,
    "fileKey" TEXT,
    "fileName" TEXT,
    "ehrTxId" TEXT,
    "source" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allergy" (
    "id" TEXT NOT NULL,
    "patientId" TEXT,
    "substance" TEXT NOT NULL,
    "reaction" TEXT,
    "severity" TEXT,
    "status" TEXT,
    "criticality" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Allergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedReachJob" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "phlebId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientAddress" TEXT NOT NULL,
    "windowLabel" TEXT,
    "status" "MedReachStatus" NOT NULL,
    "eta" TEXT,
    "etaAt" TIMESTAMP(3),
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedReachJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedReachTimelineEntry" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedReachTimelineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePortJob" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientAddress" TEXT NOT NULL,
    "status" "CarePortStatus" NOT NULL,
    "eta" TEXT,
    "etaAt" TIMESTAMP(3),
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarePortJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePortTimelineEntry" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "msg" TEXT NOT NULL,
    "entity" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarePortTimelineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReminderPushSubscription_endpoint_key" ON "ReminderPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "ReminderPushSubscription_patientId_idx" ON "ReminderPushSubscription"("patientId");

-- CreateIndex
CREATE INDEX "Condition_patientId_idx" ON "Condition"("patientId");

-- CreateIndex
CREATE INDEX "Condition_status_idx" ON "Condition"("status");

-- CreateIndex
CREATE INDEX "Condition_createdAt_idx" ON "Condition"("createdAt");

-- CreateIndex
CREATE INDEX "Vaccination_patientId_idx" ON "Vaccination"("patientId");

-- CreateIndex
CREATE INDEX "Vaccination_vaccine_idx" ON "Vaccination"("vaccine");

-- CreateIndex
CREATE INDEX "Vaccination_date_idx" ON "Vaccination"("date");

-- CreateIndex
CREATE INDEX "Vaccination_createdAt_idx" ON "Vaccination"("createdAt");

-- CreateIndex
CREATE INDEX "Operation_patientId_idx" ON "Operation"("patientId");

-- CreateIndex
CREATE INDEX "Operation_date_idx" ON "Operation"("date");

-- CreateIndex
CREATE INDEX "Operation_createdAt_idx" ON "Operation"("createdAt");

-- CreateIndex
CREATE INDEX "Allergy_patientId_idx" ON "Allergy"("patientId");

-- CreateIndex
CREATE INDEX "Allergy_status_idx" ON "Allergy"("status");

-- CreateIndex
CREATE INDEX "Allergy_recordedAt_idx" ON "Allergy"("recordedAt");

-- CreateIndex
CREATE INDEX "MedReachJob_labId_idx" ON "MedReachJob"("labId");

-- CreateIndex
CREATE INDEX "MedReachJob_phlebId_idx" ON "MedReachJob"("phlebId");

-- CreateIndex
CREATE INDEX "MedReachJob_status_idx" ON "MedReachJob"("status");

-- CreateIndex
CREATE INDEX "MedReachJob_createdAt_idx" ON "MedReachJob"("createdAt");

-- CreateIndex
CREATE INDEX "MedReachJob_orgId_idx" ON "MedReachJob"("orgId");

-- CreateIndex
CREATE INDEX "MedReachJob_labId_status_createdAt_idx" ON "MedReachJob"("labId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MedReachJob_etaAt_idx" ON "MedReachJob"("etaAt");

-- CreateIndex
CREATE UNIQUE INDEX "MedReachJob_orgId_externalId_key" ON "MedReachJob"("orgId", "externalId");

-- CreateIndex
CREATE INDEX "MedReachTimelineEntry_jobId_at_idx" ON "MedReachTimelineEntry"("jobId", "at");

-- CreateIndex
CREATE INDEX "CarePortJob_pharmacyId_idx" ON "CarePortJob"("pharmacyId");

-- CreateIndex
CREATE INDEX "CarePortJob_riderId_idx" ON "CarePortJob"("riderId");

-- CreateIndex
CREATE INDEX "CarePortJob_status_idx" ON "CarePortJob"("status");

-- CreateIndex
CREATE INDEX "CarePortJob_createdAt_idx" ON "CarePortJob"("createdAt");

-- CreateIndex
CREATE INDEX "CarePortJob_orgId_idx" ON "CarePortJob"("orgId");

-- CreateIndex
CREATE INDEX "CarePortJob_pharmacyId_status_createdAt_idx" ON "CarePortJob"("pharmacyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CarePortJob_etaAt_idx" ON "CarePortJob"("etaAt");

-- CreateIndex
CREATE UNIQUE INDEX "CarePortJob_orgId_externalId_key" ON "CarePortJob"("orgId", "externalId");

-- CreateIndex
CREATE INDEX "CarePortTimelineEntry_jobId_at_idx" ON "CarePortTimelineEntry"("jobId", "at");

-- CreateIndex
CREATE INDEX "Appointment_orgId_idx" ON "Appointment"("orgId");

-- CreateIndex
CREATE INDEX "Appointment_orgId_clinicianId_patientId_startsAt_endsAt_idx" ON "Appointment"("orgId", "clinicianId", "patientId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Encounter_orgId_idx" ON "Encounter"("orgId");

-- CreateIndex
CREATE INDEX "ErxOrder_encounterId_status_idx" ON "ErxOrder"("encounterId", "status");

-- CreateIndex
CREATE INDEX "LabOrder_encounterId_status_idx" ON "LabOrder"("encounterId", "status");

-- CreateIndex
CREATE INDEX "Payment_orgId_idx" ON "Payment"("orgId");

-- CreateIndex
CREATE INDEX "RuntimeEvent_orgId_idx" ON "RuntimeEvent"("orgId");

-- AddForeignKey
ALTER TABLE "ReminderPushSubscription" ADD CONSTRAINT "ReminderPushSubscription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allergy" ADD CONSTRAINT "Allergy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedReachJob" ADD CONSTRAINT "MedReachJob_labId_fkey" FOREIGN KEY ("labId") REFERENCES "LabPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedReachTimelineEntry" ADD CONSTRAINT "MedReachTimelineEntry_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "MedReachJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePortJob" ADD CONSTRAINT "CarePortJob_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePortTimelineEntry" ADD CONSTRAINT "CarePortTimelineEntry_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CarePortJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
