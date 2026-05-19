/*
  Warnings:

  - The `meta` column on the `Appointment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `updatedAt` to the `Appointment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AppointmentKind" AS ENUM ('STANDARD', 'FOLLOWUP');

-- CreateEnum
CREATE TYPE "AppointmentVisitMode" AS ENUM ('TELEVISIT', 'IN_PERSON', 'HYBRID');

-- CreateEnum
CREATE TYPE "AppointmentPaymentMethod" AS ENUM ('CARD', 'MEDICAL_AID', 'VOUCHER', 'EFT', 'MPESA', 'WALLET');

-- CreateEnum
CREATE TYPE "AppointmentPaymentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'DEAD');

-- DropIndex
DROP INDEX "public"."Appointment_clinicianId_idx";

-- DropIndex
DROP INDEX "public"."Appointment_orgId_clinicianId_patientId_startsAt_endsAt_idx";

-- DropIndex
DROP INDEX "public"."Appointment_orgId_idx";

-- DropIndex
DROP INDEX "public"."Appointment_patientId_idx";

-- DropIndex
DROP INDEX "public"."Appointment_startsAt_idx";

-- DropIndex
DROP INDEX "public"."Appointment_status_idx";

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "bookingSource" TEXT,
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledByUserId" TEXT,
ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "familyRelationshipId" TEXT,
ADD COLUMN     "hostUserId" TEXT,
ADD COLUMN     "kind" "AppointmentKind" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "parentAppointmentId" TEXT,
ADD COLUMN     "paymentIntentId" TEXT,
ADD COLUMN     "paymentMethod" "AppointmentPaymentMethod",
ADD COLUMN     "paymentStatus" "AppointmentPaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "roomId" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "subjectPatientId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "visitMode" "AppointmentVisitMode" NOT NULL DEFAULT 'TELEVISIT',
ALTER COLUMN "sessionId" DROP NOT NULL,
ALTER COLUMN "paymentProvider" DROP NOT NULL,
DROP COLUMN "meta",
ADD COLUMN     "meta" JSONB;

-- CreateTable
CREATE TABLE "ScheduleBlock" (
    "id" TEXT NOT NULL,
    "clinicianUserId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdByUserId" TEXT,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationOutbox" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "eventKind" TEXT NOT NULL,
    "appointmentId" TEXT,
    "encounterId" TEXT,
    "recipientUserId" TEXT,
    "recipientEmail" TEXT,
    "recipientPhone" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentAuditEvent" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorType" TEXT,
    "actorUserId" TEXT,
    "reason" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',

    CONSTRAINT "AppointmentAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleBlock_clinicianUserId_startsAt_endsAt_idx" ON "ScheduleBlock"("clinicianUserId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ScheduleBlock_orgId_clinicianUserId_startsAt_idx" ON "ScheduleBlock"("orgId", "clinicianUserId", "startsAt");

-- CreateIndex
CREATE INDEX "NotificationOutbox_status_scheduledAt_idx" ON "NotificationOutbox"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "NotificationOutbox_appointmentId_idx" ON "NotificationOutbox"("appointmentId");

-- CreateIndex
CREATE INDEX "NotificationOutbox_recipientUserId_createdAt_idx" ON "NotificationOutbox"("recipientUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AppointmentAuditEvent_appointmentId_createdAt_idx" ON "AppointmentAuditEvent"("appointmentId", "createdAt");

-- CreateIndex
CREATE INDEX "AppointmentAuditEvent_orgId_createdAt_idx" ON "AppointmentAuditEvent"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "Appointment_clinicianId_startsAt_idx" ON "Appointment"("clinicianId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_patientId_startsAt_idx" ON "Appointment"("patientId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_subjectPatientId_startsAt_idx" ON "Appointment"("subjectPatientId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_status_startsAt_idx" ON "Appointment"("status", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_roomId_startsAt_idx" ON "Appointment"("roomId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_orgId_clinicianId_startsAt_idx" ON "Appointment"("orgId", "clinicianId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_orgId_patientId_startsAt_idx" ON "Appointment"("orgId", "patientId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_orgId_subjectPatientId_startsAt_idx" ON "Appointment"("orgId", "subjectPatientId", "startsAt");
