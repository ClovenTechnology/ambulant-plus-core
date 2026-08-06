-- Sweep 1B-P1: additive booking reservation foundation.
-- Runtime-dormant: no existing Appointment, Encounter, Televisit or Payment row is modified.

CREATE TYPE "BookingIntentStatus" AS ENUM (
  'DRAFT',
  'QUOTED',
  'SLOT_HELD',
  'PAYMENT_ACTION_REQUIRED',
  'PAYMENT_PROCESSING',
  'SPONSOR_REVIEW',
  'COPAY_REQUIRED',
  'AUTHORIZED',
  'CONFIRMED',
  'PAYMENT_FAILED',
  'EXPIRED',
  'CANCELLED'
);

CREATE TYPE "BookingSlotLeaseStatus" AS ENUM (
  'ACTIVE',
  'CONSUMED',
  'RELEASED',
  'EXPIRED',
  'CANCELLED'
);

CREATE TYPE "BookingPaymentAttemptStatus" AS ENUM (
  'CREATED',
  'PENDING_REDIRECT',
  'PROCESSING',
  'AUTHORIZED',
  'CAPTURED',
  'PENDING_REVIEW',
  'FAILED',
  'CANCELLED',
  'EXPIRED'
);

CREATE TYPE "BookingIntentRecipientStatus" AS ENUM (
  'PENDING_IDENTITY_VERIFICATION',
  'READY',
  'PENDING_COVERAGE',
  'COVERED',
  'COPAY_REQUIRED',
  'DECLINED',
  'REMOVED',
  'CANCELLED'
);

CREATE TABLE "BookingIntent" (
  "id" TEXT NOT NULL,
  "requestFingerprint" VARCHAR(64) NOT NULL,
  "idempotencyKeyHash" VARCHAR(64) NOT NULL,
  "hostUserId" TEXT NOT NULL,
  "actorPatientId" TEXT NOT NULL,
  "clinicianId" TEXT NOT NULL,
  "status" "BookingIntentStatus" NOT NULL DEFAULT 'DRAFT',
  "fundingMethod" "AppointmentPaymentMethod",
  "kind" "AppointmentKind" NOT NULL DEFAULT 'STANDARD',
  "visitMode" "AppointmentVisitMode" NOT NULL DEFAULT 'TELEVISIT',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "slotKey" VARCHAR(191) NOT NULL,
  "slotOfferHash" VARCHAR(64),
  "slotOfferExpiresAt" TIMESTAMP(3),
  "priceLockHash" VARCHAR(64),
  "priceLockExpiresAt" TIMESTAMP(3),
  "holdExpiresAt" TIMESTAMP(3),
  "amountMinor" INTEGER NOT NULL DEFAULT 0,
  "subtotalMinor" INTEGER NOT NULL DEFAULT 0,
  "taxMinor" INTEGER NOT NULL DEFAULT 0,
  "discountMinor" INTEGER NOT NULL DEFAULT 0,
  "totalMinor" INTEGER NOT NULL DEFAULT 0,
  "sponsorAmountMinor" INTEGER NOT NULL DEFAULT 0,
  "patientPayableMinor" INTEGER NOT NULL DEFAULT 0,
  "currency" VARCHAR(3) NOT NULL,
  "coverageDecision" TEXT,
  "coverageAuthorizationId" TEXT,
  "reason" TEXT,
  "caseId" TEXT,
  "appointmentId" TEXT,
  "authorizedAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "expiredAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "quoteSnapshot" JSONB,
  "coverageSnapshot" JSONB,
  "recipientSnapshot" JSONB,
  "metadata" JSONB,
  "orgId" TEXT NOT NULL DEFAULT 'org-default',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BookingIntent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingIntentRecipient" (
  "id" TEXT NOT NULL,
  "bookingIntentId" TEXT NOT NULL,
  "patientId" TEXT,
  "patientUserId" TEXT,
  "hostUserId" TEXT NOT NULL,
  "familyRelationshipId" TEXT,
  "role" "AppointmentCareRecipientRole" NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "status" "BookingIntentRecipientStatus" NOT NULL DEFAULT 'READY',
  "identityVerifiedAt" TIMESTAMP(3),
  "reason" TEXT,
  "caseId" TEXT,
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

  CONSTRAINT "BookingIntentRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingSlotLease" (
  "id" TEXT NOT NULL,
  "bookingIntentId" TEXT NOT NULL,
  "slotKey" VARCHAR(191) NOT NULL,
  "clinicianId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "BookingSlotLeaseStatus" NOT NULL DEFAULT 'ACTIVE',
  "holdTokenHash" VARCHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "releaseReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "metadata" JSONB,
  "orgId" TEXT NOT NULL DEFAULT 'org-default',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BookingSlotLease_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingPaymentAttempt" (
  "id" TEXT NOT NULL,
  "bookingIntentId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT 1,
  "method" "AppointmentPaymentMethod" NOT NULL,
  "status" "BookingPaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
  "provider" TEXT,
  "providerRef" VARCHAR(160),
  "idempotencyKeyHash" VARCHAR(64) NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "authorizedAt" TIMESTAMP(3),
  "capturedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "providerSnapshot" JSONB,
  "verificationSnapshot" JSONB,
  "metadata" JSONB,
  "orgId" TEXT NOT NULL DEFAULT 'org-default',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BookingPaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingIntentAuditEvent" (
  "id" TEXT NOT NULL,
  "bookingIntentId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromStatus" "BookingIntentStatus",
  "toStatus" "BookingIntentStatus",
  "actorType" TEXT,
  "actorUserId" TEXT,
  "reason" TEXT,
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "orgId" TEXT NOT NULL DEFAULT 'org-default',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BookingIntentAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingIntent_appointmentId_key"
ON "BookingIntent"("appointmentId");

CREATE UNIQUE INDEX "BookingIntent_hostUserId_idempotencyKeyHash_key"
ON "BookingIntent"("hostUserId", "idempotencyKeyHash");

CREATE INDEX "BookingIntent_clinicianId_startsAt_endsAt_idx"
ON "BookingIntent"("clinicianId", "startsAt", "endsAt");

CREATE INDEX "BookingIntent_hostUserId_status_createdAt_idx"
ON "BookingIntent"("hostUserId", "status", "createdAt");

CREATE INDEX "BookingIntent_actorPatientId_status_createdAt_idx"
ON "BookingIntent"("actorPatientId", "status", "createdAt");

CREATE INDEX "BookingIntent_status_holdExpiresAt_idx"
ON "BookingIntent"("status", "holdExpiresAt");

CREATE INDEX "BookingIntent_slotKey_status_idx"
ON "BookingIntent"("slotKey", "status");

CREATE INDEX "BookingIntent_orgId_status_createdAt_idx"
ON "BookingIntent"("orgId", "status", "createdAt");

CREATE UNIQUE INDEX "BookingIntentRecipient_bookingIntentId_patientId_key"
ON "BookingIntentRecipient"("bookingIntentId", "patientId");

CREATE UNIQUE INDEX "BookingIntentRecipient_bookingIntentId_sequence_key"
ON "BookingIntentRecipient"("bookingIntentId", "sequence");

CREATE INDEX "BookingIntentRecipient_patientId_idx"
ON "BookingIntentRecipient"("patientId");

CREATE INDEX "BookingIntentRecipient_patientUserId_idx"
ON "BookingIntentRecipient"("patientUserId");

CREATE INDEX "BookingIntentRecipient_hostUserId_idx"
ON "BookingIntentRecipient"("hostUserId");

CREATE INDEX "BookingIntentRecipient_familyRelationshipId_idx"
ON "BookingIntentRecipient"("familyRelationshipId");

CREATE INDEX "BookingIntentRecipient_coverageAuthorizationId_idx"
ON "BookingIntentRecipient"("coverageAuthorizationId");

CREATE INDEX "BookingIntentRecipient_orgId_bookingIntentId_idx"
ON "BookingIntentRecipient"("orgId", "bookingIntentId");

CREATE UNIQUE INDEX "BookingSlotLease_bookingIntentId_key"
ON "BookingSlotLease"("bookingIntentId");

CREATE INDEX "BookingSlotLease_slotKey_status_expiresAt_idx"
ON "BookingSlotLease"("slotKey", "status", "expiresAt");

CREATE INDEX "BookingSlotLease_clinicianId_startsAt_endsAt_idx"
ON "BookingSlotLease"("clinicianId", "startsAt", "endsAt");

CREATE INDEX "BookingSlotLease_status_expiresAt_idx"
ON "BookingSlotLease"("status", "expiresAt");

CREATE INDEX "BookingSlotLease_orgId_status_expiresAt_idx"
ON "BookingSlotLease"("orgId", "status", "expiresAt");

-- Preserve historical leases while allowing only one active lease for an exact slot.
CREATE UNIQUE INDEX "BookingSlotLease_slotKey_active_key"
ON "BookingSlotLease"("slotKey")
WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "BookingPaymentAttempt_providerRef_key"
ON "BookingPaymentAttempt"("providerRef");

CREATE UNIQUE INDEX "BookingPaymentAttempt_bookingIntentId_sequence_key"
ON "BookingPaymentAttempt"("bookingIntentId", "sequence");

CREATE UNIQUE INDEX "BookingPaymentAttempt_bookingIntentId_idempotencyKeyHash_key"
ON "BookingPaymentAttempt"("bookingIntentId", "idempotencyKeyHash");

CREATE INDEX "BookingPaymentAttempt_bookingIntentId_status_createdAt_idx"
ON "BookingPaymentAttempt"("bookingIntentId", "status", "createdAt");

CREATE INDEX "BookingPaymentAttempt_status_expiresAt_idx"
ON "BookingPaymentAttempt"("status", "expiresAt");

CREATE INDEX "BookingPaymentAttempt_orgId_status_createdAt_idx"
ON "BookingPaymentAttempt"("orgId", "status", "createdAt");

CREATE INDEX "BookingIntentAuditEvent_bookingIntentId_createdAt_idx"
ON "BookingIntentAuditEvent"("bookingIntentId", "createdAt");

CREATE INDEX "BookingIntentAuditEvent_orgId_createdAt_idx"
ON "BookingIntentAuditEvent"("orgId", "createdAt");

ALTER TABLE "BookingIntent"
ADD CONSTRAINT "BookingIntent_appointmentId_fkey"
FOREIGN KEY ("appointmentId")
REFERENCES "Appointment"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "BookingIntentRecipient"
ADD CONSTRAINT "BookingIntentRecipient_bookingIntentId_fkey"
FOREIGN KEY ("bookingIntentId")
REFERENCES "BookingIntent"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "BookingSlotLease"
ADD CONSTRAINT "BookingSlotLease_bookingIntentId_fkey"
FOREIGN KEY ("bookingIntentId")
REFERENCES "BookingIntent"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "BookingPaymentAttempt"
ADD CONSTRAINT "BookingPaymentAttempt_bookingIntentId_fkey"
FOREIGN KEY ("bookingIntentId")
REFERENCES "BookingIntent"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "BookingIntentAuditEvent"
ADD CONSTRAINT "BookingIntentAuditEvent_bookingIntentId_fkey"
FOREIGN KEY ("bookingIntentId")
REFERENCES "BookingIntent"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
