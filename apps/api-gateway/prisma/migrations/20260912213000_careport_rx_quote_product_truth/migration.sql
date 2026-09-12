-- CP-RX-2 — Pharmacy quote discovery and product truth
-- Additive only. No existing CarePort order, payment, inventory or procurement rows are rewritten.

ALTER TABLE "PharmacyPartner"
  ADD COLUMN "acceptingRxOrders" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "rxOpeningHours" JSONB,
  ADD COLUMN "rxTimeZone" VARCHAR(80),
  ADD COLUMN "rxOrderPauseReason" VARCHAR(240),
  ADD COLUMN "rxOrderPauseUntil" TIMESTAMP(3);

CREATE TABLE "CarePortRxPharmacyQuote" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL DEFAULT 'org-default',
  "sessionId" TEXT NOT NULL,
  "pharmacyId" TEXT NOT NULL,
  "coverageStatus" VARCHAR(40) NOT NULL,
  "availabilityState" VARCHAR(40) NOT NULL,
  "reasonCode" VARCHAR(80),
  "includedLineCount" INTEGER NOT NULL,
  "coveredLineCount" INTEGER NOT NULL,
  "coverageRatio" DOUBLE PRECISION NOT NULL,
  "distanceKm" DOUBLE PRECISION,
  "pharmacyOpenNow" BOOLEAN,
  "acceptingOrders" BOOLEAN NOT NULL DEFAULT true,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarePortRxPharmacyQuote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CarePortRxPharmacyQuoteLine" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "procurementLineId" TEXT NOT NULL,
  "coverageState" VARCHAR(60) NOT NULL,
  "productTruthState" VARCHAR(80) NOT NULL,
  "matchedOptionCount" INTEGER NOT NULL DEFAULT 0,
  "sourceLineSnapshot" JSONB,
  CONSTRAINT "CarePortRxPharmacyQuoteLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CarePortRxPharmacyQuoteOption" (
  "id" TEXT NOT NULL,
  "quoteLineId" TEXT NOT NULL,
  "skuId" TEXT NOT NULL,
  "globalProductId" VARCHAR(191),
  "globalProductKey" VARCHAR(180),
  "matchAuthority" VARCHAR(80) NOT NULL,
  "selectable" BOOLEAN NOT NULL DEFAULT false,
  "requiresPharmacistReview" BOOLEAN NOT NULL DEFAULT false,
  "isGeneric" BOOLEAN NOT NULL DEFAULT false,
  "displayName" TEXT NOT NULL,
  "canonicalName" TEXT,
  "brand" VARCHAR(160),
  "manufacturer" VARCHAR(160),
  "ingredientText" TEXT,
  "strengthText" VARCHAR(160),
  "dosageFormText" VARCHAR(160),
  "packSize" VARCHAR(120),
  "productCodeSystem" VARCHAR(120),
  "productCode" VARCHAR(180),
  "listedPriceCents" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
  "stockOnHandSnapshot" INTEGER,
  "reservedStockSnapshot" INTEGER NOT NULL DEFAULT 0,
  "availableStockSnapshot" INTEGER,
  "stockKnown" BOOLEAN NOT NULL DEFAULT false,
  "productSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CarePortRxPharmacyQuoteOption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CarePortRxPharmacyQuote_sessionId_generatedAt_idx"
  ON "CarePortRxPharmacyQuote"("sessionId", "generatedAt");
CREATE INDEX "careport_rx_quote_session_coverage_availability_idx"
  ON "CarePortRxPharmacyQuote"("sessionId", "coverageStatus", "availabilityState");
CREATE INDEX "CarePortRxPharmacyQuote_pharmacyId_expiresAt_idx"
  ON "CarePortRxPharmacyQuote"("pharmacyId", "expiresAt");
CREATE INDEX "CarePortRxPharmacyQuote_orgId_expiresAt_idx"
  ON "CarePortRxPharmacyQuote"("orgId", "expiresAt");

CREATE UNIQUE INDEX "CarePortRxPharmacyQuoteLine_quoteId_procurementLineId_key"
  ON "CarePortRxPharmacyQuoteLine"("quoteId", "procurementLineId");
CREATE INDEX "CarePortRxPharmacyQuoteLine_procurementLineId_idx"
  ON "CarePortRxPharmacyQuoteLine"("procurementLineId");
CREATE INDEX "CarePortRxPharmacyQuoteLine_quoteId_coverageState_idx"
  ON "CarePortRxPharmacyQuoteLine"("quoteId", "coverageState");

CREATE INDEX "CarePortRxPharmacyQuoteOption_quoteLineId_selectable_idx"
  ON "CarePortRxPharmacyQuoteOption"("quoteLineId", "selectable");
CREATE INDEX "CarePortRxPharmacyQuoteOption_skuId_idx"
  ON "CarePortRxPharmacyQuoteOption"("skuId");
CREATE INDEX "CarePortRxPharmacyQuoteOption_globalProductId_idx"
  ON "CarePortRxPharmacyQuoteOption"("globalProductId");
CREATE INDEX "CarePortRxPharmacyQuoteOption_globalProductKey_idx"
  ON "CarePortRxPharmacyQuoteOption"("globalProductKey");

ALTER TABLE "CarePortRxPharmacyQuote"
  ADD CONSTRAINT "CarePortRxPharmacyQuote_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "CarePortRxProcurementSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CarePortRxPharmacyQuote"
  ADD CONSTRAINT "CarePortRxPharmacyQuote_pharmacyId_fkey"
  FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyPartner"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CarePortRxPharmacyQuoteLine"
  ADD CONSTRAINT "CarePortRxPharmacyQuoteLine_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "CarePortRxPharmacyQuote"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CarePortRxPharmacyQuoteLine"
  ADD CONSTRAINT "CarePortRxPharmacyQuoteLine_procurementLineId_fkey"
  FOREIGN KEY ("procurementLineId") REFERENCES "CarePortRxProcurementLine"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CarePortRxPharmacyQuoteOption"
  ADD CONSTRAINT "CarePortRxPharmacyQuoteOption_quoteLineId_fkey"
  FOREIGN KEY ("quoteLineId") REFERENCES "CarePortRxPharmacyQuoteLine"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
