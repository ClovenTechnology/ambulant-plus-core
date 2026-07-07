-- MedReach provider profile fields.
-- Editable operational profile fields are separated from locked verified identity metadata.

ALTER TABLE "LabPartner"
  ADD COLUMN IF NOT EXISTS "displayName" TEXT,
  ADD COLUMN IF NOT EXISTS "logoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "website" TEXT,
  ADD COLUMN IF NOT EXISTS "operationalPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "operationalEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "addressLine1" TEXT,
  ADD COLUMN IF NOT EXISTS "addressLine2" TEXT,
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "province" TEXT,
  ADD COLUMN IF NOT EXISTS "postalCode" TEXT,
  ADD COLUMN IF NOT EXISTS "profileMeta" JSONB,
  ADD COLUMN IF NOT EXISTS "verifiedIdentityMeta" JSONB;

ALTER TABLE "MedReachPhlebProfile"
  ADD COLUMN IF NOT EXISTS "displayName" TEXT,
  ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "vehicleType" TEXT,
  ADD COLUMN IF NOT EXISTS "serviceAreaMeta" JSONB,
  ADD COLUMN IF NOT EXISTS "profileMeta" JSONB,
  ADD COLUMN IF NOT EXISTS "verifiedIdentityMeta" JSONB;