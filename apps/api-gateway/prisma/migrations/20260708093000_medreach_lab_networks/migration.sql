DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MedReachLabNetworkType') THEN
    CREATE TYPE "MedReachLabNetworkType" AS ENUM (
      'INDEPENDENT_GROUP',
      'CORPORATE_CHAIN',
      'FRANCHISE',
      'HOLDING_COMPANY'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MedReachLabBranchType') THEN
    CREATE TYPE "MedReachLabBranchType" AS ENUM (
      'OWNED_BRANCH',
      'FRANCHISE_BRANCH',
      'PARTNER_SITE'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MedReachLabNetworkStaffRole') THEN
    CREATE TYPE "MedReachLabNetworkStaffRole" AS ENUM (
      'NETWORK_OWNER',
      'NETWORK_ADMIN',
      'OPERATIONS',
      'FINANCE',
      'QUALITY',
      'VIEWER'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "MedReachLabNetwork" (
  "id" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "displayName" TEXT,
  "networkType" "MedReachLabNetworkType" NOT NULL DEFAULT 'INDEPENDENT_GROUP',
  "country" VARCHAR(2) NOT NULL DEFAULT 'ZA',
  "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
  "ownerUserId" TEXT,
  "status" "MedReachPartnerStatus" NOT NULL DEFAULT 'PENDING',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "profileMeta" JSONB,
  "verifiedIdentityMeta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MedReachLabNetwork_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MedReachLabNetworkStaff" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "networkId" TEXT NOT NULL,
  "role" "MedReachLabNetworkStaffRole" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "status" "MedReachStaffStatus" NOT NULL DEFAULT 'PENDING',
  "invitedBy" TEXT,
  "approvedBy" TEXT,
  "invitedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MedReachLabNetworkStaff_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "LabPartner"
  ADD COLUMN IF NOT EXISTS "networkId" TEXT,
  ADD COLUMN IF NOT EXISTS "branchCode" TEXT,
  ADD COLUMN IF NOT EXISTS "branchType" "MedReachLabBranchType" NOT NULL DEFAULT 'OWNED_BRANCH',
  ADD COLUMN IF NOT EXISTS "hqVisible" BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MedReachLabNetworkStaff_networkId_fkey'
  ) THEN
    ALTER TABLE "MedReachLabNetworkStaff"
      ADD CONSTRAINT "MedReachLabNetworkStaff_networkId_fkey"
      FOREIGN KEY ("networkId")
      REFERENCES "MedReachLabNetwork"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'LabPartner_networkId_fkey'
  ) THEN
    ALTER TABLE "LabPartner"
      ADD CONSTRAINT "LabPartner_networkId_fkey"
      FOREIGN KEY ("networkId")
      REFERENCES "MedReachLabNetwork"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MedReachLabNetworkStaff_userId_networkId_key'
  ) THEN
    ALTER TABLE "MedReachLabNetworkStaff"
      ADD CONSTRAINT "MedReachLabNetworkStaff_userId_networkId_key"
      UNIQUE ("userId", "networkId");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "MedReachLabNetwork_active_idx"
  ON "MedReachLabNetwork"("active");

CREATE INDEX IF NOT EXISTS "MedReachLabNetwork_status_idx"
  ON "MedReachLabNetwork"("status");

CREATE INDEX IF NOT EXISTS "MedReachLabNetwork_country_currency_idx"
  ON "MedReachLabNetwork"("country", "currency");

CREATE INDEX IF NOT EXISTS "MedReachLabNetwork_ownerUserId_idx"
  ON "MedReachLabNetwork"("ownerUserId");

CREATE INDEX IF NOT EXISTS "MedReachLabNetworkStaff_networkId_role_idx"
  ON "MedReachLabNetworkStaff"("networkId", "role");

CREATE INDEX IF NOT EXISTS "MedReachLabNetworkStaff_status_active_idx"
  ON "MedReachLabNetworkStaff"("status", "active");

CREATE INDEX IF NOT EXISTS "MedReachLabNetworkStaff_userId_idx"
  ON "MedReachLabNetworkStaff"("userId");

CREATE INDEX IF NOT EXISTS "LabPartner_networkId_idx"
  ON "LabPartner"("networkId");

CREATE INDEX IF NOT EXISTS "LabPartner_networkId_status_idx"
  ON "LabPartner"("networkId", "status");

CREATE INDEX IF NOT EXISTS "LabPartner_networkId_branchCode_idx"
  ON "LabPartner"("networkId", "branchCode");