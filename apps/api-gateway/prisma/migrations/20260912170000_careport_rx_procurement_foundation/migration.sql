-- CP-RX-1: additive CarePort prescription procurement foundation.
-- This migration does not rewrite or delete existing CarePort orders.

CREATE TYPE "CarePortRxProcurementStatus" AS ENUM (
  'BASKET_DRAFT',
  'PHARMACY_DISCOVERY',
  'PHARMACY_SELECTED',
  'CONVERTED_TO_ORDER',
  'CANCELLED',
  'EXPIRED'
);

CREATE TYPE "CarePortRxProcurementLineState" AS ENUM (
  'INCLUDED',
  'DEFERRED_BY_PATIENT'
);

CREATE TABLE "CarePortRxProcurementSession" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL DEFAULT 'org-default',
  "erxOrderId" TEXT NOT NULL,
  "refillNo" INTEGER NOT NULL DEFAULT 0,
  "encounterId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "status" "CarePortRxProcurementStatus" NOT NULL DEFAULT 'BASKET_DRAFT',
  "searchLabel" VARCHAR(160),
  "searchAddress" TEXT,
  "searchLat" DOUBLE PRECISION,
  "searchLng" DOUBLE PRECISION,
  "searchSource" VARCHAR(40),
  "sourceErxVersion" INTEGER,
  "sourceErxStatus" VARCHAR(80),
  "sourceSnapshot" JSONB,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarePortRxProcurementSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CarePortRxProcurementLine" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL DEFAULT 'org-default',
  "sessionId" TEXT NOT NULL,
  "erxMedKey" TEXT NOT NULL,
  "state" "CarePortRxProcurementLineState" NOT NULL DEFAULT 'INCLUDED',
  "deferReason" VARCHAR(80),
  "deferredAt" TIMESTAMP(3),
  "drugCode" TEXT,
  "codingSystem" VARCHAR(240),
  "codingCode" VARCHAR(240),
  "codingDisplay" TEXT,
  "name" TEXT NOT NULL,
  "ingredientText" TEXT,
  "formText" TEXT,
  "strengthText" TEXT,
  "doseText" TEXT,
  "routeText" TEXT,
  "frequencyText" TEXT,
  "durationText" TEXT,
  "prescribedQuantityValue" DOUBLE PRECISION,
  "prescribedQuantityUnit" VARCHAR(120),
  "prescribedQuantityText" TEXT,
  "legacyQuantity" INTEGER NOT NULL DEFAULT 1,
  "directions" TEXT,
  "repeats" INTEGER,
  "sourceMedicationSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarePortRxProcurementLine_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CarePortOrder" ADD COLUMN "procurementSessionId" TEXT;

CREATE INDEX "CarePortRxProcurementSession_orgId_patientId_updatedAt_idx"
  ON "CarePortRxProcurementSession"("orgId", "patientId", "updatedAt");
CREATE INDEX "CarePortRxProcurementSession_erxOrderId_refillNo_createdAt_idx"
  ON "CarePortRxProcurementSession"("erxOrderId", "refillNo", "createdAt");
CREATE INDEX "CarePortRxProcurementSession_encounterId_patientId_updatedAt_idx"
  ON "CarePortRxProcurementSession"("encounterId", "patientId", "updatedAt");
CREATE INDEX "CarePortRxProcurementSession_status_expiresAt_idx"
  ON "CarePortRxProcurementSession"("status", "expiresAt");

CREATE UNIQUE INDEX "CarePortRxProcurementLine_sessionId_erxMedKey_key"
  ON "CarePortRxProcurementLine"("sessionId", "erxMedKey");
CREATE INDEX "CarePortRxProcurementLine_sessionId_state_idx"
  ON "CarePortRxProcurementLine"("sessionId", "state");
CREATE INDEX "CarePortRxProcurementLine_orgId_state_updatedAt_idx"
  ON "CarePortRxProcurementLine"("orgId", "state", "updatedAt");
CREATE INDEX "CarePortRxProcurementLine_drugCode_idx"
  ON "CarePortRxProcurementLine"("drugCode");
CREATE INDEX "CarePortOrder_procurementSessionId_idx"
  ON "CarePortOrder"("procurementSessionId");

ALTER TABLE "CarePortRxProcurementLine"
  ADD CONSTRAINT "CarePortRxProcurementLine_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "CarePortRxProcurementSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CarePortOrder"
  ADD CONSTRAINT "CarePortOrder_procurementSessionId_fkey"
  FOREIGN KEY ("procurementSessionId") REFERENCES "CarePortRxProcurementSession"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
