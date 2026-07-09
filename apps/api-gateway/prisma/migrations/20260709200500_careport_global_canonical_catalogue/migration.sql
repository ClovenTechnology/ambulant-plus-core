-- CP2-F: CarePort global canonical catalogue tables.
-- Keeps CarePortPharmacySku as pharmacy-specific stock/inventory while adding
-- a canonical global product layer for product identity, external codes and SKU mapping.

ALTER TABLE "CarePortPharmacySku"
  ADD COLUMN IF NOT EXISTS "globalProductId" VARCHAR(191);

CREATE TABLE IF NOT EXISTS "CarePortGlobalProduct" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL DEFAULT 'org-default',
  "globalProductKey" VARCHAR(180) NOT NULL,
  "canonicalName" VARCHAR(500) NOT NULL,

  "productType" VARCHAR(60) NOT NULL DEFAULT 'MEDICATION',
  "category" VARCHAR(120),
  "subcategory" VARCHAR(120),
  "otc" BOOLEAN NOT NULL DEFAULT false,
  "prescriptionRequired" BOOLEAN NOT NULL DEFAULT true,
  "marketplaceAllowed" BOOLEAN NOT NULL DEFAULT false,
  "sellableOnline" BOOLEAN NOT NULL DEFAULT true,

  "brand" VARCHAR(160),
  "manufacturer" VARCHAR(160),
  "description" TEXT,
  "imageUrl" TEXT,
  "packSize" VARCHAR(120),

  "dosageForm" VARCHAR(120),
  "strength" VARCHAR(120),
  "route" VARCHAR(120),
  "unit" VARCHAR(80),

  "regulatedSchedule" VARCHAR(80),
  "taxCategory" VARCHAR(80),

  "primaryBarcode" VARCHAR(120),
  "primaryNappi" VARCHAR(120),
  "primaryRxNorm" VARCHAR(120),
  "primaryGtin" VARCHAR(120),

  "attributes" JSONB,
  "normalisedAttributes" JSONB,
  "sourceMeta" JSONB,

  "catalogueStatus" VARCHAR(80) NOT NULL DEFAULT 'DRAFT',
  "catalogueSource" VARCHAR(80) NOT NULL DEFAULT 'ADMIN_CREATED',
  "confidence" DOUBLE PRECISION,
  "notes" TEXT,

  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CarePortGlobalProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CarePortGlobalProductCode" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL DEFAULT 'org-default',
  "globalProductId" VARCHAR(191) NOT NULL,
  "globalProductKey" VARCHAR(180) NOT NULL,

  "system" VARCHAR(80) NOT NULL,
  "code" VARCHAR(180) NOT NULL,
  "display" TEXT,
  "country" VARCHAR(2),

  "source" VARCHAR(80) NOT NULL DEFAULT 'ADMIN_CREATED',
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "meta" JSONB,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CarePortGlobalProductCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CarePortPharmacySkuGlobalProductMap" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL DEFAULT 'org-default',
  "pharmacyId" TEXT NOT NULL,
  "skuId" TEXT NOT NULL,
  "globalProductId" VARCHAR(191),
  "globalProductKey" VARCHAR(180) NOT NULL,

  "matchSource" VARCHAR(80) NOT NULL DEFAULT 'NORMALISATION',
  "matchStatus" VARCHAR(80) NOT NULL DEFAULT 'ACTIVE',
  "confidence" DOUBLE PRECISION,
  "notes" TEXT,

  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CarePortPharmacySkuGlobalProductMap_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CarePortGlobalProduct_globalProductKey_key"
  ON "CarePortGlobalProduct"("globalProductKey");

CREATE INDEX IF NOT EXISTS "CarePortGlobalProduct_orgId_idx"
  ON "CarePortGlobalProduct"("orgId");

CREATE INDEX IF NOT EXISTS "CarePortGlobalProduct_productType_category_idx"
  ON "CarePortGlobalProduct"("productType", "category");

CREATE INDEX IF NOT EXISTS "CarePortGlobalProduct_catalogueStatus_idx"
  ON "CarePortGlobalProduct"("catalogueStatus");

CREATE INDEX IF NOT EXISTS "CarePortGlobalProduct_catalogueSource_idx"
  ON "CarePortGlobalProduct"("catalogueSource");

CREATE INDEX IF NOT EXISTS "CarePortGlobalProduct_canonicalName_idx"
  ON "CarePortGlobalProduct"("canonicalName");

CREATE INDEX IF NOT EXISTS "CarePortGlobalProduct_primaryNappi_idx"
  ON "CarePortGlobalProduct"("primaryNappi");

CREATE INDEX IF NOT EXISTS "CarePortGlobalProduct_primaryRxNorm_idx"
  ON "CarePortGlobalProduct"("primaryRxNorm");

CREATE INDEX IF NOT EXISTS "CarePortGlobalProduct_primaryGtin_idx"
  ON "CarePortGlobalProduct"("primaryGtin");

CREATE INDEX IF NOT EXISTS "CarePortGlobalProduct_primaryBarcode_idx"
  ON "CarePortGlobalProduct"("primaryBarcode");

CREATE INDEX IF NOT EXISTS "CarePortGlobalProduct_marketplaceAllowed_sellableOnline_idx"
  ON "CarePortGlobalProduct"("marketplaceAllowed", "sellableOnline");

CREATE UNIQUE INDEX IF NOT EXISTS "careport_global_product_code_system_code_country_key"
  ON "CarePortGlobalProductCode"("system", "code", "country");

CREATE INDEX IF NOT EXISTS "CarePortGlobalProductCode_orgId_idx"
  ON "CarePortGlobalProductCode"("orgId");

CREATE INDEX IF NOT EXISTS "CarePortGlobalProductCode_globalProductId_idx"
  ON "CarePortGlobalProductCode"("globalProductId");

CREATE INDEX IF NOT EXISTS "CarePortGlobalProductCode_globalProductKey_idx"
  ON "CarePortGlobalProductCode"("globalProductKey");

CREATE INDEX IF NOT EXISTS "CarePortGlobalProductCode_system_code_idx"
  ON "CarePortGlobalProductCode"("system", "code");

CREATE INDEX IF NOT EXISTS "CarePortGlobalProductCode_country_idx"
  ON "CarePortGlobalProductCode"("country");

CREATE INDEX IF NOT EXISTS "CarePortGlobalProductCode_isActive_idx"
  ON "CarePortGlobalProductCode"("isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "careport_sku_global_product_map_sku_global_key"
  ON "CarePortPharmacySkuGlobalProductMap"("skuId", "globalProductKey");

CREATE INDEX IF NOT EXISTS "CarePortPharmacySkuGlobalProductMap_orgId_idx"
  ON "CarePortPharmacySkuGlobalProductMap"("orgId");

CREATE INDEX IF NOT EXISTS "CarePortPharmacySkuGlobalProductMap_pharmacyId_idx"
  ON "CarePortPharmacySkuGlobalProductMap"("pharmacyId");

CREATE INDEX IF NOT EXISTS "CarePortPharmacySkuGlobalProductMap_skuId_idx"
  ON "CarePortPharmacySkuGlobalProductMap"("skuId");

CREATE INDEX IF NOT EXISTS "CarePortPharmacySkuGlobalProductMap_globalProductId_idx"
  ON "CarePortPharmacySkuGlobalProductMap"("globalProductId");

CREATE INDEX IF NOT EXISTS "CarePortPharmacySkuGlobalProductMap_globalProductKey_idx"
  ON "CarePortPharmacySkuGlobalProductMap"("globalProductKey");

CREATE INDEX IF NOT EXISTS "CarePortPharmacySkuGlobalProductMap_matchStatus_idx"
  ON "CarePortPharmacySkuGlobalProductMap"("matchStatus");

CREATE INDEX IF NOT EXISTS "CarePortPharmacySkuGlobalProductMap_matchSource_idx"
  ON "CarePortPharmacySkuGlobalProductMap"("matchSource");

CREATE INDEX IF NOT EXISTS "CarePortPharmacySku_globalProductId_idx"
  ON "CarePortPharmacySku"("globalProductId");
