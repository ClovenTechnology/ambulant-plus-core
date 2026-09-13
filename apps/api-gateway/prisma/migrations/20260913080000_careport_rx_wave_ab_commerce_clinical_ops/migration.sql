-- Ambulant+ CarePort Rx Wave AB
-- Transaction-grade commerce + canonical patient runtime + pharmacy clinical operations.
-- Additive only. CarePort Rider dispatch/readiness/handover is intentionally deferred to Wave C.

-- Existing enum extensions.
ALTER TYPE "CarePortRxProcurementStatus" ADD VALUE IF NOT EXISTS 'RESERVED';
ALTER TYPE "CarePortRxProcurementStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_PENDING';
ALTER TYPE "CarePortRxProcurementStatus" ADD VALUE IF NOT EXISTS 'PHARMACIST_REVIEW';
ALTER TYPE "CarePortRxProcurementStatus" ADD VALUE IF NOT EXISTS 'FULFILMENT_ACTIVE';
ALTER TYPE "CarePortRxProcurementStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

ALTER TYPE "CarePortOrderStatus" ADD VALUE IF NOT EXISTS 'RESERVED';
ALTER TYPE "CarePortOrderStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_AUTHORIZED';
ALTER TYPE "CarePortOrderStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_CAPTURED';
ALTER TYPE "CarePortOrderStatus" ADD VALUE IF NOT EXISTS 'PHARMACIST_REVIEW';
ALTER TYPE "CarePortOrderStatus" ADD VALUE IF NOT EXISTS 'PHARMACIST_RELEASED';
ALTER TYPE "CarePortOrderStatus" ADD VALUE IF NOT EXISTS 'PACKING_COMPLETE';
ALTER TYPE "CarePortOrderStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_RIDER';
ALTER TYPE "CarePortOrderStatus" ADD VALUE IF NOT EXISTS 'DELIVERY_FAILED';
ALTER TYPE "CarePortOrderStatus" ADD VALUE IF NOT EXISTS 'RETURNING_TO_PHARMACY';
ALTER TYPE "CarePortOrderStatus" ADD VALUE IF NOT EXISTS 'RETURNED_TO_PHARMACY';

ALTER TYPE "CarePortPaymentStatus" ADD VALUE IF NOT EXISTS 'AUTHORIZED';
ALTER TYPE "CarePortPaymentStatus" ADD VALUE IF NOT EXISTS 'CAPTURED';
ALTER TYPE "CarePortPaymentStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

CREATE TYPE "CarePortRxReservationStatus" AS ENUM ('HELD','SECURED','CONSUMED','RELEASED','EXPIRED');
CREATE TYPE "CarePortRxPharmacistReviewStatus" AS ENUM ('PENDING','RELEASED','CLARIFICATION_REQUIRED','REJECTED');

-- Pharmacy SKU commercial metadata. Existing Rx SKUs remain non-checkout-ready
-- until the pharmacy supplies the required pack/unit/tax basis.
ALTER TABLE "CarePortPharmacySku"
  ADD COLUMN "rxPriceBasis" VARCHAR(20),
  ADD COLUMN "rxDispenseUnit" VARCHAR(80),
  ADD COLUMN "rxUnitsPerPack" INTEGER,
  ADD COLUMN "rxTaxRateBps" INTEGER,
  ADD COLUMN "rxPriceIncludesTax" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "medicalAidClaimable" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "careport_sku_rx_commercial_idx"
  ON "CarePortPharmacySku"("pharmacyId","rxPriceBasis","isActive");

-- Payment truth.
ALTER TABLE "CarePortPaymentIntent"
  ADD COLUMN "authorizedAt" TIMESTAMP(3),
  ADD COLUMN "capturedAt" TIMESTAMP(3),
  ADD COLUMN "refundedAt" TIMESTAMP(3),
  ADD COLUMN "refundProviderRef" VARCHAR(191),
  ADD COLUMN "refundStatus" VARCHAR(80);

CREATE TABLE "CarePortRxReservation" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL DEFAULT 'org-default',
  "sessionId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "quoteId" TEXT,
  "pharmacyId" TEXT NOT NULL,
  "status" "CarePortRxReservationStatus" NOT NULL DEFAULT 'HELD',
  "fulfillment" "CarePortFulfillmentMode" NOT NULL DEFAULT 'PICKUP',
  "destinationAddr" TEXT,
  "destinationLat" DOUBLE PRECISION,
  "destinationLng" DOUBLE PRECISION,
  "subtotalNetCents" INTEGER NOT NULL,
  "taxCents" INTEGER NOT NULL,
  "subtotalGrossCents" INTEGER NOT NULL,
  "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
  "totalCents" INTEGER NOT NULL,
  "claimableSubtotalCents" INTEGER NOT NULL DEFAULT 0,
  "sponsorAmountMinor" INTEGER NOT NULL DEFAULT 0,
  "patientGapMinor" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "securedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "releaseReason" VARCHAR(120),
  "pricingSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarePortRxReservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "careport_rx_reservation_order_key"
  ON "CarePortRxReservation"("orderId");
CREATE INDEX "careport_rx_res_session_status_exp_idx"
  ON "CarePortRxReservation"("sessionId","status","expiresAt");
CREATE INDEX "careport_rx_res_pharmacy_status_exp_idx"
  ON "CarePortRxReservation"("pharmacyId","status","expiresAt");
CREATE INDEX "careport_rx_res_org_status_exp_idx"
  ON "CarePortRxReservation"("orgId","status","expiresAt");

CREATE TABLE "CarePortRxReservationLine" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "procurementLineId" TEXT NOT NULL,
  "quoteOptionId" TEXT,
  "skuId" TEXT NOT NULL,
  "globalProductId" VARCHAR(191),
  "globalProductKey" VARCHAR(180),
  "prescribedQuantityValue" DOUBLE PRECISION NOT NULL,
  "prescribedQuantityUnit" VARCHAR(80) NOT NULL,
  "requiredPacks" INTEGER NOT NULL,
  "unitsPerPack" INTEGER NOT NULL,
  "dispenseUnit" VARCHAR(80) NOT NULL,
  "unitListPriceCents" INTEGER NOT NULL,
  "priceBasis" VARCHAR(20) NOT NULL,
  "taxRateBps" INTEGER NOT NULL,
  "priceIncludesTax" BOOLEAN NOT NULL,
  "netCents" INTEGER NOT NULL,
  "taxCents" INTEGER NOT NULL,
  "grossCents" INTEGER NOT NULL,
  "medicalAidClaimable" BOOLEAN NOT NULL DEFAULT false,
  "productSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CarePortRxReservationLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "careport_rx_res_line_unique"
  ON "CarePortRxReservationLine"("reservationId","procurementLineId");
CREATE INDEX "careport_rx_res_line_sku_idx"
  ON "CarePortRxReservationLine"("skuId");
CREATE INDEX "careport_rx_res_line_proc_idx"
  ON "CarePortRxReservationLine"("procurementLineId");

CREATE TABLE "CarePortRxPharmacistReview" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL DEFAULT 'org-default',
  "orderId" TEXT NOT NULL,
  "status" "CarePortRxPharmacistReviewStatus" NOT NULL DEFAULT 'PENDING',
  "reasonCode" VARCHAR(120),
  "note" TEXT,
  "decidedBy" VARCHAR(191),
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarePortRxPharmacistReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "careport_rx_review_order_key"
  ON "CarePortRxPharmacistReview"("orderId");
CREATE INDEX "careport_rx_review_org_status_idx"
  ON "CarePortRxPharmacistReview"("orgId","status","updatedAt");

CREATE TABLE "CarePortRxPharmacyFulfilment" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL DEFAULT 'org-default',
  "orderId" TEXT NOT NULL,
  "preparationStartedAt" TIMESTAMP(3),
  "preparationEtaMin" INTEGER,
  "expectedReadyAt" TIMESTAMP(3),
  "packingCompleteAt" TIMESTAMP(3),
  "readyAt" TIMESTAMP(3),
  "collectedAt" TIMESTAMP(3),
  "dispensingLabelVersion" INTEGER NOT NULL DEFAULT 0,
  "outerLabelVersion" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarePortRxPharmacyFulfilment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "careport_rx_fulfil_order_key"
  ON "CarePortRxPharmacyFulfilment"("orderId");
CREATE INDEX "careport_rx_fulfil_ready_idx"
  ON "CarePortRxPharmacyFulfilment"("orgId","expectedReadyAt");

CREATE TABLE "CarePortRxDispenseLine" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL DEFAULT 'org-default',
  "orderId" TEXT NOT NULL,
  "reservationLineId" TEXT NOT NULL,
  "procurementLineId" TEXT NOT NULL,
  "skuId" TEXT NOT NULL,
  "globalProductId" VARCHAR(191),
  "displayName" TEXT NOT NULL,
  "canonicalName" TEXT,
  "brand" VARCHAR(160),
  "manufacturer" VARCHAR(160),
  "ingredientText" TEXT,
  "strengthText" VARCHAR(160),
  "dosageFormText" VARCHAR(160),
  "packSize" VARCHAR(120),
  "quantityDispensedPacks" INTEGER NOT NULL,
  "substitution" BOOLEAN NOT NULL DEFAULT false,
  "substitutionReason" VARCHAR(240),
  "pharmacistId" VARCHAR(191),
  "unitPriceCents" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
  "labelVersion" INTEGER NOT NULL DEFAULT 1,
  "dispenseSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarePortRxDispenseLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "careport_rx_disp_res_line_key"
  ON "CarePortRxDispenseLine"("reservationLineId");
CREATE INDEX "careport_rx_disp_order_idx"
  ON "CarePortRxDispenseLine"("orderId");
CREATE INDEX "careport_rx_disp_sku_idx"
  ON "CarePortRxDispenseLine"("skuId");

CREATE TABLE "CarePortRxPharmacyEvent" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL DEFAULT 'org-default',
  "orderId" TEXT NOT NULL,
  "pharmacyId" TEXT NOT NULL,
  "kind" VARCHAR(80) NOT NULL,
  "payload" JSONB,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedBy" VARCHAR(191),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CarePortRxPharmacyEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "careport_rx_event_pharmacy_ack_idx"
  ON "CarePortRxPharmacyEvent"("pharmacyId","acknowledgedAt","createdAt");
CREATE INDEX "careport_rx_event_order_idx"
  ON "CarePortRxPharmacyEvent"("orderId","createdAt");
CREATE INDEX "careport_rx_event_org_idx"
  ON "CarePortRxPharmacyEvent"("orgId","createdAt");

ALTER TABLE "CarePortRxReservation"
  ADD CONSTRAINT "CarePortRxReservation_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "CarePortRxProcurementSession"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CarePortRxReservation"
  ADD CONSTRAINT "CarePortRxReservation_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "CarePortOrder"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CarePortRxReservation"
  ADD CONSTRAINT "CarePortRxReservation_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "CarePortRxPharmacyQuote"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CarePortRxReservation"
  ADD CONSTRAINT "CarePortRxReservation_pharmacyId_fkey"
  FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyPartner"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CarePortRxReservationLine"
  ADD CONSTRAINT "CarePortRxReservationLine_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "CarePortRxReservation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CarePortRxReservationLine"
  ADD CONSTRAINT "CarePortRxReservationLine_procurementLineId_fkey"
  FOREIGN KEY ("procurementLineId") REFERENCES "CarePortRxProcurementLine"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CarePortRxReservationLine"
  ADD CONSTRAINT "CarePortRxReservationLine_quoteOptionId_fkey"
  FOREIGN KEY ("quoteOptionId") REFERENCES "CarePortRxPharmacyQuoteOption"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CarePortRxReservationLine"
  ADD CONSTRAINT "CarePortRxReservationLine_skuId_fkey"
  FOREIGN KEY ("skuId") REFERENCES "CarePortPharmacySku"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CarePortRxPharmacistReview"
  ADD CONSTRAINT "CarePortRxPharmacistReview_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "CarePortOrder"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CarePortRxPharmacyFulfilment"
  ADD CONSTRAINT "CarePortRxPharmacyFulfilment_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "CarePortOrder"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CarePortRxDispenseLine"
  ADD CONSTRAINT "CarePortRxDispenseLine_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "CarePortOrder"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CarePortRxDispenseLine"
  ADD CONSTRAINT "CarePortRxDispenseLine_reservationLineId_fkey"
  FOREIGN KEY ("reservationLineId") REFERENCES "CarePortRxReservationLine"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CarePortRxDispenseLine"
  ADD CONSTRAINT "CarePortRxDispenseLine_procurementLineId_fkey"
  FOREIGN KEY ("procurementLineId") REFERENCES "CarePortRxProcurementLine"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CarePortRxDispenseLine"
  ADD CONSTRAINT "CarePortRxDispenseLine_skuId_fkey"
  FOREIGN KEY ("skuId") REFERENCES "CarePortPharmacySku"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CarePortRxPharmacyEvent"
  ADD CONSTRAINT "CarePortRxPharmacyEvent_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "CarePortOrder"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CarePortRxPharmacyEvent"
  ADD CONSTRAINT "CarePortRxPharmacyEvent_pharmacyId_fkey"
  FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyPartner"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
