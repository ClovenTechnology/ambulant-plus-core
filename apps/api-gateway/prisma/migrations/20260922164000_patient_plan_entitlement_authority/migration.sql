-- CreateTable
CREATE TABLE "PatientPlanEntitlement" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "cycle" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "premiumCreditDays" INTEGER NOT NULL DEFAULT 0,
    "familyCreditDays" INTEGER NOT NULL DEFAULT 0,
    "sourceType" TEXT NOT NULL DEFAULT 'system',
    "sourceRef" TEXT,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientPlanEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientPlanEntitlementEvent" (
    "id" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "fromPlan" TEXT,
    "toPlan" TEXT,
    "cycle" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "sourceType" TEXT,
    "sourceRef" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientPlanEntitlementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatientPlanEntitlement_patientId_key"
ON "PatientPlanEntitlement"("patientId");

-- CreateIndex
CREATE INDEX "PatientPlanEntitlement_plan_status_idx"
ON "PatientPlanEntitlement"("plan", "status");

-- CreateIndex
CREATE INDEX "PatientPlanEntitlement_endsAt_idx"
ON "PatientPlanEntitlement"("endsAt");

-- CreateIndex
CREATE INDEX "PatientPlanEntitlement_orgId_idx"
ON "PatientPlanEntitlement"("orgId");

-- CreateIndex
CREATE INDEX "PatientPlanEntitlement_sourceType_sourceRef_idx"
ON "PatientPlanEntitlement"("sourceType", "sourceRef");

-- CreateIndex
CREATE UNIQUE INDEX "PatientPlanEntitlementEvent_idempotencyKey_key"
ON "PatientPlanEntitlementEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PatientPlanEntitlementEvent_entitlementId_createdAt_idx"
ON "PatientPlanEntitlementEvent"("entitlementId", "createdAt");

-- CreateIndex
CREATE INDEX "PatientPlanEntitlementEvent_patientId_createdAt_idx"
ON "PatientPlanEntitlementEvent"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "PatientPlanEntitlementEvent_sourceType_sourceRef_idx"
ON "PatientPlanEntitlementEvent"("sourceType", "sourceRef");

-- AddForeignKey
ALTER TABLE "PatientPlanEntitlement"
ADD CONSTRAINT "PatientPlanEntitlement_patientId_fkey"
FOREIGN KEY ("patientId")
REFERENCES "PatientProfile"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientPlanEntitlementEvent"
ADD CONSTRAINT "PatientPlanEntitlementEvent_entitlementId_fkey"
FOREIGN KEY ("entitlementId")
REFERENCES "PatientPlanEntitlement"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;