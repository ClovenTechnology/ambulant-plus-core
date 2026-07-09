ALTER TABLE "CarePortPharmacySku"
  ADD COLUMN IF NOT EXISTS "catalogueSource" VARCHAR(80) NOT NULL DEFAULT 'PHARMACY_SUPPLIED',
  ADD COLUMN IF NOT EXISTS "normalisationStatus" VARCHAR(80) NOT NULL DEFAULT 'RAW_PHARMACY_SUPPLIED',
  ADD COLUMN IF NOT EXISTS "normalisationConfidence" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "normalisationNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "globalProductKey" VARCHAR(180),
  ADD COLUMN IF NOT EXISTS "canonicalName" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "customAttributeValues" JSONB,
  ADD COLUMN IF NOT EXISTS "normalisedAttributes" JSONB,
  ADD COLUMN IF NOT EXISTS "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reviewReason" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "CarePortPharmacySku_catalogueSource_idx"
  ON "CarePortPharmacySku" ("catalogueSource");

CREATE INDEX IF NOT EXISTS "CarePortPharmacySku_normalisationStatus_reviewRequired_idx"
  ON "CarePortPharmacySku" ("normalisationStatus", "reviewRequired");

CREATE INDEX IF NOT EXISTS "CarePortPharmacySku_reviewRequired_updatedAt_idx"
  ON "CarePortPharmacySku" ("reviewRequired", "updatedAt");

CREATE INDEX IF NOT EXISTS "CarePortPharmacySku_globalProductKey_idx"
  ON "CarePortPharmacySku" ("globalProductKey");

CREATE INDEX IF NOT EXISTS "CarePortPharmacySku_canonicalName_idx"
  ON "CarePortPharmacySku" ("canonicalName");
