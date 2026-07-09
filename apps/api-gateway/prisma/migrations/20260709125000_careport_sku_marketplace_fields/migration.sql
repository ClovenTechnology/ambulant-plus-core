ALTER TABLE "CarePortPharmacySku"
  ADD COLUMN IF NOT EXISTS "productType" VARCHAR(60) NOT NULL DEFAULT 'MEDICATION',
  ADD COLUMN IF NOT EXISTS "category" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "subcategory" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "otc" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "prescriptionRequired" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "marketplaceVisible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sellableOnline" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "brand" VARCHAR(160),
  ADD COLUMN IF NOT EXISTS "manufacturer" VARCHAR(160),
  ADD COLUMN IF NOT EXISTS "barcode" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "packSize" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "variantGroupKey" VARCHAR(160),
  ADD COLUMN IF NOT EXISTS "variantName" VARCHAR(160),
  ADD COLUMN IF NOT EXISTS "variantAttributes" JSONB,
  ADD COLUMN IF NOT EXISTS "attributes" JSONB,
  ADD COLUMN IF NOT EXISTS "stockOnHand" INTEGER,
  ADD COLUMN IF NOT EXISTS "reservedStock" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER,
  ADD COLUMN IF NOT EXISTS "maxOrderQty" INTEGER,
  ADD COLUMN IF NOT EXISTS "ageRestricted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "regulatedSchedule" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "taxCategory" VARCHAR(80);

CREATE INDEX IF NOT EXISTS "CarePortPharmacySku_pharmacyId_productType_isActive_idx"
  ON "CarePortPharmacySku" ("pharmacyId", "productType", "isActive");

CREATE INDEX IF NOT EXISTS "CarePortPharmacySku_pharmacyId_category_isActive_idx"
  ON "CarePortPharmacySku" ("pharmacyId", "category", "isActive");

CREATE INDEX IF NOT EXISTS "CarePortPharmacySku_pharmacyId_otc_marketplaceVisible_idx"
  ON "CarePortPharmacySku" ("pharmacyId", "otc", "marketplaceVisible");

CREATE INDEX IF NOT EXISTS "CarePortPharmacySku_pharmacyId_prescriptionRequired_isActive_idx"
  ON "CarePortPharmacySku" ("pharmacyId", "prescriptionRequired", "isActive");

CREATE INDEX IF NOT EXISTS "CarePortPharmacySku_barcode_idx"
  ON "CarePortPharmacySku" ("barcode");

CREATE INDEX IF NOT EXISTS "CarePortPharmacySku_variantGroupKey_idx"
  ON "CarePortPharmacySku" ("variantGroupKey");
