-- A6-R4-A2C3B: durable clinician Pay Later request history and active-request idempotency.

CREATE TABLE "ClinicianOnboardingPayLaterRequest" (
    "id" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "pathwayKey" TEXT NOT NULL DEFAULT 'START_NOW_PAY_LATER',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestReason" TEXT,
    "requestedByUserId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "activeRequestKey" TEXT,
    "approvalPaymentId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicianOnboardingPayLaterRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClinicianOnboardingPayLaterRequest_activeRequestKey_key"
ON "ClinicianOnboardingPayLaterRequest"("activeRequestKey");

CREATE INDEX "ClinicianOnboardingPayLaterRequest_clinicianId_status_requestedAt_idx"
ON "ClinicianOnboardingPayLaterRequest"("clinicianId", "status", "requestedAt");

CREATE INDEX "ClinicianOnboardingPayLaterRequest_onboardingId_requestedAt_idx"
ON "ClinicianOnboardingPayLaterRequest"("onboardingId", "requestedAt");

CREATE INDEX "ClinicianOnboardingPayLaterRequest_status_requestedAt_idx"
ON "ClinicianOnboardingPayLaterRequest"("status", "requestedAt");

CREATE INDEX "ClinicianOnboardingPayLaterRequest_reviewedAt_idx"
ON "ClinicianOnboardingPayLaterRequest"("reviewedAt");

CREATE INDEX "ClinicianOnboardingPayLaterRequest_approvalPaymentId_idx"
ON "ClinicianOnboardingPayLaterRequest"("approvalPaymentId");

ALTER TABLE "ClinicianOnboardingPayLaterRequest"
ADD CONSTRAINT "ClinicianOnboardingPayLaterRequest_onboardingId_fkey"
FOREIGN KEY ("onboardingId")
REFERENCES "ClinicianOnboarding"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
