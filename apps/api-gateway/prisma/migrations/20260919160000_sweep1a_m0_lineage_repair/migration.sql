-- Ambulant+ Sweep 1A M0-E
-- Source-only migration authoring artifact.
--
-- IMPORTANT:
-- * This file was authored from the sealed M0-D4 49-operation repair design.
-- * No SQL was executed during M0-E.
-- * R047-R050 are compiled with fail-closed catalog-aware idempotency guards.
-- * R049/R050 use Prisma-canonical CREATE UNIQUE INDEX physical form, as
--   evidenced by the existing M0-B catalog, while preserving the sealed
--   composite-unique semantics and canonical 63-byte names.
-- * R046 remains a SET NOT NULL candidate. Before any future live apply,
--   acceptedMedicalAids NULL_COUNT must be rechecked in that target runtime.
-- * Production runtime database provenance was not established by M0-E.
-- * This migration must pass separately authorized disposable shadow replay
--   and existing-database compatibility certification before any live apply.

-- ============================================================
-- RepairId: M0D-R001
-- Model: CarePortProviderFeeLedger
-- RepairClass: WHOLE_MODEL_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct canonical base table on migration-only databases; foreign keys and indexes are separate normalized operations
-- ============================================================

CREATE TABLE IF NOT EXISTS public."CarePortProviderFeeLedger" (
  "id" text NOT NULL,
  "orgId" text DEFAULT 'org-default' NOT NULL,
  "orderId" text,
  "paymentIntentId" text,
  "provider" text NOT NULL,
  "providerRef" text,
  "category" text DEFAULT 'PAYMENT_PROCESSING' NOT NULL,
  "amountMinor" integer NOT NULL,
  "currency" character varying(3) DEFAULT 'ZAR' NOT NULL,
  "status" text DEFAULT 'RECORDED' NOT NULL,
  "metadata" jsonb,
  "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamp(3) without time zone NOT NULL,
  CONSTRAINT "CarePortProviderFeeLedger_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- RepairId: M0D-R010
-- Model: ClientMemberEligibilitySnapshot
-- RepairClass: WHOLE_MODEL_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct canonical base table on migration-only databases; composite unique and indexes are separate normalized operations
-- ============================================================

CREATE TABLE IF NOT EXISTS public."ClientMemberEligibilitySnapshot" (
  "id" text NOT NULL,
  "orgId" text DEFAULT 'org-default' NOT NULL,
  "clientId" text NOT NULL,
  "clientMemberId" text NOT NULL,
  "coveragePlanId" text,
  "patientId" text,
  "userId" text,
  "periodKey" text NOT NULL,
  "source" text DEFAULT 'MANUAL' NOT NULL,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "eligibilityStatus" text DEFAULT 'PENDING' NOT NULL,
  "premiumStatus" text DEFAULT 'UNKNOWN' NOT NULL,
  "reasonCode" text,
  "reasonText" text,
  "verifiedAt" timestamp(3) without time zone,
  "validFrom" timestamp(3) without time zone,
  "validTo" timestamp(3) without time zone,
  "rawPayload" jsonb,
  "metadata" jsonb,
  "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamp(3) without time zone NOT NULL,
  CONSTRAINT "ClientMemberEligibilitySnapshot_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- RepairId: M0D-R011
-- Model: PatientSponsorEligibilityCheck
-- RepairClass: WHOLE_MODEL_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct canonical base table on migration-only databases; composite unique and indexes are separate normalized operations
-- ============================================================

CREATE TABLE IF NOT EXISTS public."PatientSponsorEligibilityCheck" (
  "id" text NOT NULL,
  "orgId" text NOT NULL,
  "clientId" text,
  "patientSponsorLinkId" text NOT NULL,
  "clientMemberId" text,
  "patientId" text,
  "userId" text,
  "periodKey" text NOT NULL,
  "status" text DEFAULT 'UNVERIFIED' NOT NULL,
  "previousStatus" text,
  "premiumStatus" text,
  "source" text DEFAULT 'MANUAL' NOT NULL,
  "adapterChannel" text,
  "reason" text,
  "effectiveFrom" timestamp(3) without time zone,
  "effectiveTo" timestamp(3) without time zone,
  "verifiedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "verifiedByUserId" text,
  "rawPayload" jsonb,
  "payloadHash" text,
  "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamp(3) without time zone NOT NULL,
  CONSTRAINT "PatientSponsorEligibilityCheck_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- RepairId: M0D-R002
-- Model: ClientMember
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column eligibilityStatus
-- ============================================================

ALTER TABLE public."ClientMember" ADD COLUMN IF NOT EXISTS "eligibilityStatus" text;

-- ============================================================
-- RepairId: M0D-R003
-- Model: ClientMember
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column eligibilityPeriodKey
-- ============================================================

ALTER TABLE public."ClientMember" ADD COLUMN IF NOT EXISTS "eligibilityPeriodKey" text;

-- ============================================================
-- RepairId: M0D-R004
-- Model: ClientMember
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column premiumStatus
-- ============================================================

ALTER TABLE public."ClientMember" ADD COLUMN IF NOT EXISTS "premiumStatus" text;

-- ============================================================
-- RepairId: M0D-R005
-- Model: ClientMember
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column lastEligibilityCheckAt
-- ============================================================

ALTER TABLE public."ClientMember" ADD COLUMN IF NOT EXISTS "lastEligibilityCheckAt" timestamp(3) without time zone;

-- ============================================================
-- RepairId: M0D-R006
-- Model: ClientMember
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column verifiedUntil
-- ============================================================

ALTER TABLE public."ClientMember" ADD COLUMN IF NOT EXISTS "verifiedUntil" timestamp(3) without time zone;

-- ============================================================
-- RepairId: M0D-R007
-- Model: ClientMember
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column eligibilityReason
-- ============================================================

ALTER TABLE public."ClientMember" ADD COLUMN IF NOT EXISTS "eligibilityReason" text;

-- ============================================================
-- RepairId: M0D-R008
-- Model: ClientMember
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column verificationSource
-- ============================================================

ALTER TABLE public."ClientMember" ADD COLUMN IF NOT EXISTS "verificationSource" text;

-- ============================================================
-- RepairId: M0D-R009
-- Model: ClientMember
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column verificationPayloadHash
-- ============================================================

ALTER TABLE public."ClientMember" ADD COLUMN IF NOT EXISTS "verificationPayloadHash" text;

-- ============================================================
-- RepairId: M0D-R012
-- Model: PharmacyPartner
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column commercialStatus
-- ============================================================

ALTER TABLE public."PharmacyPartner" ADD COLUMN IF NOT EXISTS "commercialStatus" text DEFAULT 'ACTIVE' NOT NULL;

-- ============================================================
-- RepairId: M0D-R013
-- Model: PharmacyPartner
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column billingCycle
-- ============================================================

ALTER TABLE public."PharmacyPartner" ADD COLUMN IF NOT EXISTS "billingCycle" text DEFAULT 'MONTHLY' NOT NULL;

-- ============================================================
-- RepairId: M0D-R014
-- Model: PharmacyPartner
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column onboardingFeeCents
-- ============================================================

ALTER TABLE public."PharmacyPartner" ADD COLUMN IF NOT EXISTS "onboardingFeeCents" integer DEFAULT 0 NOT NULL;

-- ============================================================
-- RepairId: M0D-R015
-- Model: PharmacyPartner
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column monthlyPlatformFeeCents
-- ============================================================

ALTER TABLE public."PharmacyPartner" ADD COLUMN IF NOT EXISTS "monthlyPlatformFeeCents" integer DEFAULT 0 NOT NULL;

-- ============================================================
-- RepairId: M0D-R016
-- Model: PharmacyPartner
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column inventoryHostingFeeCents
-- ============================================================

ALTER TABLE public."PharmacyPartner" ADD COLUMN IF NOT EXISTS "inventoryHostingFeeCents" integer DEFAULT 0 NOT NULL;

-- ============================================================
-- RepairId: M0D-R017
-- Model: PharmacyPartner
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column subscriptionStatus
-- ============================================================

ALTER TABLE public."PharmacyPartner" ADD COLUMN IF NOT EXISTS "subscriptionStatus" text DEFAULT 'CURRENT' NOT NULL;

-- ============================================================
-- RepairId: M0D-R018
-- Model: PharmacyPartner
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column nextBillingAt
-- ============================================================

ALTER TABLE public."PharmacyPartner" ADD COLUMN IF NOT EXISTS "nextBillingAt" timestamp(3) without time zone;

-- ============================================================
-- RepairId: M0D-R019
-- Model: PharmacyPartner
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column arrearsCents
-- ============================================================

ALTER TABLE public."PharmacyPartner" ADD COLUMN IF NOT EXISTS "arrearsCents" integer DEFAULT 0 NOT NULL;

-- ============================================================
-- RepairId: M0D-R020
-- Model: PharmacyPartner
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column suspendedReason
-- ============================================================

ALTER TABLE public."PharmacyPartner" ADD COLUMN IF NOT EXISTS "suspendedReason" text;

-- ============================================================
-- RepairId: M0D-R021
-- Model: PharmacyPartner
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column lastSettledAt
-- ============================================================

ALTER TABLE public."PharmacyPartner" ADD COLUMN IF NOT EXISTS "lastSettledAt" timestamp(3) without time zone;

-- ============================================================
-- RepairId: M0D-R022
-- Model: CarePortRiderProfile
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column accountStatus
-- ============================================================

ALTER TABLE public."CarePortRiderProfile" ADD COLUMN IF NOT EXISTS "accountStatus" text DEFAULT 'AWAITING_ACTIVATION' NOT NULL;

-- ============================================================
-- RepairId: M0D-R023
-- Model: CarePortRiderProfile
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column payoutCycle
-- ============================================================

ALTER TABLE public."CarePortRiderProfile" ADD COLUMN IF NOT EXISTS "payoutCycle" text DEFAULT 'WEEKLY' NOT NULL;

-- ============================================================
-- RepairId: M0D-R024
-- Model: CarePortRiderProfile
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column payoutMethod
-- ============================================================

ALTER TABLE public."CarePortRiderProfile" ADD COLUMN IF NOT EXISTS "payoutMethod" text;

-- ============================================================
-- RepairId: M0D-R025
-- Model: CarePortRiderProfile
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column suspensionReason
-- ============================================================

ALTER TABLE public."CarePortRiderProfile" ADD COLUMN IF NOT EXISTS "suspensionReason" text;

-- ============================================================
-- RepairId: M0D-R026
-- Model: CarePortRiderProfile
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column lastPayoutAt
-- ============================================================

ALTER TABLE public."CarePortRiderProfile" ADD COLUMN IF NOT EXISTS "lastPayoutAt" timestamp(3) without time zone;

-- ============================================================
-- RepairId: M0D-R027
-- Model: CarePortRiderProfile
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column totalTrips
-- ============================================================

ALTER TABLE public."CarePortRiderProfile" ADD COLUMN IF NOT EXISTS "totalTrips" integer DEFAULT 0 NOT NULL;

-- ============================================================
-- RepairId: M0D-R028
-- Model: CarePortRiderProfile
-- RepairClass: ADD_COLUMN_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct missing migration lineage for column failedDeliveryCount
-- ============================================================

ALTER TABLE public."CarePortRiderProfile" ADD COLUMN IF NOT EXISTS "failedDeliveryCount" integer DEFAULT 0 NOT NULL;

-- ============================================================
-- RepairId: M0D-R029
-- Model: CarePortProviderFeeLedger
-- RepairClass: INDEX_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct expected index orgId,provider,createdAt
-- ============================================================

CREATE INDEX IF NOT EXISTS "CarePortProviderFeeLedger_orgId_provider_createdAt_idx" ON public."CarePortProviderFeeLedger" ("orgId", "provider", "createdAt");

-- ============================================================
-- RepairId: M0D-R030
-- Model: CarePortProviderFeeLedger
-- RepairClass: INDEX_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct expected index orderId
-- ============================================================

CREATE INDEX IF NOT EXISTS "CarePortProviderFeeLedger_orderId_idx" ON public."CarePortProviderFeeLedger" ("orderId");

-- ============================================================
-- RepairId: M0D-R031
-- Model: CarePortProviderFeeLedger
-- RepairClass: INDEX_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct expected index paymentIntentId
-- ============================================================

CREATE INDEX IF NOT EXISTS "CarePortProviderFeeLedger_paymentIntentId_idx" ON public."CarePortProviderFeeLedger" ("paymentIntentId");

-- ============================================================
-- RepairId: M0D-R032
-- Model: CarePortProviderFeeLedger
-- RepairClass: INDEX_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct expected index status
-- ============================================================

CREATE INDEX IF NOT EXISTS "CarePortProviderFeeLedger_status_idx" ON public."CarePortProviderFeeLedger" ("status");

-- ============================================================
-- RepairId: M0D-R033
-- Model: ClientMemberEligibilitySnapshot
-- RepairClass: INDEX_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct expected index orgId,clientId,periodKey
-- ============================================================

CREATE INDEX IF NOT EXISTS "ClientMemberEligibilitySnapshot_orgId_clientId_periodKey_idx" ON public."ClientMemberEligibilitySnapshot" ("orgId", "clientId", "periodKey");

-- ============================================================
-- RepairId: M0D-R034
-- Model: ClientMemberEligibilitySnapshot
-- RepairClass: INDEX_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct expected index clientMemberId,periodKey
-- ============================================================

CREATE INDEX IF NOT EXISTS "ClientMemberEligibilitySnapshot_clientMemberId_periodKey_idx" ON public."ClientMemberEligibilitySnapshot" ("clientMemberId", "periodKey");

-- ============================================================
-- RepairId: M0D-R035
-- Model: ClientMemberEligibilitySnapshot
-- RepairClass: INDEX_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct expected index patientId
-- ============================================================

CREATE INDEX IF NOT EXISTS "ClientMemberEligibilitySnapshot_patientId_idx" ON public."ClientMemberEligibilitySnapshot" ("patientId");

-- ============================================================
-- RepairId: M0D-R036
-- Model: ClientMemberEligibilitySnapshot
-- RepairClass: INDEX_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct expected index status
-- ============================================================

CREATE INDEX IF NOT EXISTS "ClientMemberEligibilitySnapshot_status_idx" ON public."ClientMemberEligibilitySnapshot" ("status");

-- ============================================================
-- RepairId: M0D-R037
-- Model: ClientMemberEligibilitySnapshot
-- RepairClass: INDEX_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct expected index eligibilityStatus
-- ============================================================

CREATE INDEX IF NOT EXISTS "ClientMemberEligibilitySnapshot_eligibilityStatus_idx" ON public."ClientMemberEligibilitySnapshot" ("eligibilityStatus");

-- ============================================================
-- RepairId: M0D-R038
-- Model: ClientMemberEligibilitySnapshot
-- RepairClass: INDEX_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct expected index premiumStatus
-- ============================================================

CREATE INDEX IF NOT EXISTS "ClientMemberEligibilitySnapshot_premiumStatus_idx" ON public."ClientMemberEligibilitySnapshot" ("premiumStatus");

-- ============================================================
-- RepairId: M0D-R039
-- Model: PatientSponsorEligibilityCheck
-- RepairClass: INDEX_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct expected index orgId,clientId,periodKey
-- ============================================================

CREATE INDEX IF NOT EXISTS "PatientSponsorEligibilityCheck_orgId_clientId_periodKey_idx" ON public."PatientSponsorEligibilityCheck" ("orgId", "clientId", "periodKey");

-- ============================================================
-- RepairId: M0D-R040
-- Model: PatientSponsorEligibilityCheck
-- RepairClass: INDEX_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct expected index patientId,status
-- ============================================================

CREATE INDEX IF NOT EXISTS "PatientSponsorEligibilityCheck_patientId_status_idx" ON public."PatientSponsorEligibilityCheck" ("patientId", "status");

-- ============================================================
-- RepairId: M0D-R041
-- Model: PatientSponsorEligibilityCheck
-- RepairClass: INDEX_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct expected index clientMemberId
-- ============================================================

CREATE INDEX IF NOT EXISTS "PatientSponsorEligibilityCheck_clientMemberId_idx" ON public."PatientSponsorEligibilityCheck" ("clientMemberId");

-- ============================================================
-- RepairId: M0D-R042
-- Model: PharmacyPartner
-- RepairClass: INDEX_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct expected index commercialStatus,subscriptionStatus
-- ============================================================

CREATE INDEX IF NOT EXISTS "PharmacyPartner_commercialStatus_subscriptionStatus_idx" ON public."PharmacyPartner" ("commercialStatus", "subscriptionStatus");

-- ============================================================
-- RepairId: M0D-R043
-- Model: PharmacyPartner
-- RepairClass: INDEX_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct expected index nextBillingAt
-- ============================================================

CREATE INDEX IF NOT EXISTS "PharmacyPartner_nextBillingAt_idx" ON public."PharmacyPartner" ("nextBillingAt");

-- ============================================================
-- RepairId: M0D-R044
-- Model: CarePortRiderProfile
-- RepairClass: INDEX_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct expected index accountStatus,payoutCycle
-- ============================================================

CREATE INDEX IF NOT EXISTS "CarePortRiderProfile_accountStatus_payoutCycle_idx" ON public."CarePortRiderProfile" ("accountStatus", "payoutCycle");

-- ============================================================
-- RepairId: M0D-R045
-- Model: CarePortRiderProfile
-- RepairClass: INDEX_RECONSTRUCTION_GAP
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: reconstruct expected index lastPayoutAt
-- ============================================================

CREATE INDEX IF NOT EXISTS "CarePortRiderProfile_lastPayoutAt_idx" ON public."CarePortRiderProfile" ("lastPayoutAt");

-- ============================================================
-- RepairId: M0D2-R047
-- Model: CarePortProviderFeeLedger
-- RepairClass: FOREIGN_KEY_RECONSTRUCTION_GAP
-- CompilerMode: CATALOG_GUARDED_CANONICAL_FOREIGN_KEY
-- Purpose: reconstruct canonical orderId foreign key omitted from M0-D base-table proposal
-- ============================================================

DO $m0e_r047$
DECLARE
  v_table_oid oid := to_regclass('public."CarePortProviderFeeLedger"');
  v_ref_oid oid := to_regclass('public."CarePortOrder"');
  v_column_attnum smallint;
  v_ref_attnum smallint;
  v_exact_oid oid;
  v_equivalent_name text;
BEGIN
  IF v_table_oid IS NULL OR v_ref_oid IS NULL THEN
    RAISE EXCEPTION 'M0E-R047 required table missing';
  END IF;

  SELECT a.attnum::smallint
    INTO v_column_attnum
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = v_table_oid
    AND a.attname = 'orderId'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  SELECT a.attnum::smallint
    INTO v_ref_attnum
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = v_ref_oid
    AND a.attname = 'id'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF v_column_attnum IS NULL OR v_ref_attnum IS NULL THEN
    RAISE EXCEPTION 'M0E-R047 required FK column missing';
  END IF;

  SELECT c.oid
    INTO v_exact_oid
  FROM pg_catalog.pg_constraint c
  WHERE c.conrelid = v_table_oid
    AND c.conname = 'CarePortProviderFeeLedger_orderId_fkey'
    AND c.contype = 'f';

  IF v_exact_oid IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint c
      WHERE c.oid = v_exact_oid
        AND c.confrelid = v_ref_oid
        AND c.conkey = ARRAY[v_column_attnum]::smallint[]
        AND c.confkey = ARRAY[v_ref_attnum]::smallint[]
        AND c.confdeltype = 'n'
        AND c.confupdtype = 'c'
        AND c.convalidated
        AND NOT c.condeferrable
        AND NOT c.condeferred
    ) THEN
      RAISE EXCEPTION
        'M0E-R047 canonical constraint name exists with noncanonical semantics';
    END IF;
  ELSE
    SELECT c.conname
      INTO v_equivalent_name
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = v_table_oid
      AND c.contype = 'f'
      AND c.confrelid = v_ref_oid
      AND c.conkey = ARRAY[v_column_attnum]::smallint[]
      AND c.confkey = ARRAY[v_ref_attnum]::smallint[]
      AND c.confdeltype = 'n'
      AND c.confupdtype = 'c'
      AND c.convalidated
      AND NOT c.condeferrable
      AND NOT c.condeferred
    ORDER BY c.conname
    LIMIT 1;

    IF v_equivalent_name IS NOT NULL THEN
      RAISE EXCEPTION
        'M0E-R047 semantically equivalent FK exists under noncanonical name: %',
        v_equivalent_name;
    END IF;

    ALTER TABLE public."CarePortProviderFeeLedger"
      ADD CONSTRAINT "CarePortProviderFeeLedger_orderId_fkey"
      FOREIGN KEY ("orderId")
      REFERENCES public."CarePortOrder"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END
$m0e_r047$;

-- ============================================================
-- RepairId: M0D2-R048
-- Model: CarePortProviderFeeLedger
-- RepairClass: FOREIGN_KEY_RECONSTRUCTION_GAP
-- CompilerMode: CATALOG_GUARDED_CANONICAL_FOREIGN_KEY
-- Purpose: reconstruct canonical paymentIntentId foreign key omitted from M0-D base-table proposal
-- ============================================================

DO $m0e_r048$
DECLARE
  v_table_oid oid := to_regclass('public."CarePortProviderFeeLedger"');
  v_ref_oid oid := to_regclass('public."CarePortPaymentIntent"');
  v_column_attnum smallint;
  v_ref_attnum smallint;
  v_exact_oid oid;
  v_equivalent_name text;
BEGIN
  IF v_table_oid IS NULL OR v_ref_oid IS NULL THEN
    RAISE EXCEPTION 'M0E-R048 required table missing';
  END IF;

  SELECT a.attnum::smallint
    INTO v_column_attnum
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = v_table_oid
    AND a.attname = 'paymentIntentId'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  SELECT a.attnum::smallint
    INTO v_ref_attnum
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = v_ref_oid
    AND a.attname = 'id'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF v_column_attnum IS NULL OR v_ref_attnum IS NULL THEN
    RAISE EXCEPTION 'M0E-R048 required FK column missing';
  END IF;

  SELECT c.oid
    INTO v_exact_oid
  FROM pg_catalog.pg_constraint c
  WHERE c.conrelid = v_table_oid
    AND c.conname = 'CarePortProviderFeeLedger_paymentIntentId_fkey'
    AND c.contype = 'f';

  IF v_exact_oid IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint c
      WHERE c.oid = v_exact_oid
        AND c.confrelid = v_ref_oid
        AND c.conkey = ARRAY[v_column_attnum]::smallint[]
        AND c.confkey = ARRAY[v_ref_attnum]::smallint[]
        AND c.confdeltype = 'n'
        AND c.confupdtype = 'c'
        AND c.convalidated
        AND NOT c.condeferrable
        AND NOT c.condeferred
    ) THEN
      RAISE EXCEPTION
        'M0E-R048 canonical constraint name exists with noncanonical semantics';
    END IF;
  ELSE
    SELECT c.conname
      INTO v_equivalent_name
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = v_table_oid
      AND c.contype = 'f'
      AND c.confrelid = v_ref_oid
      AND c.conkey = ARRAY[v_column_attnum]::smallint[]
      AND c.confkey = ARRAY[v_ref_attnum]::smallint[]
      AND c.confdeltype = 'n'
      AND c.confupdtype = 'c'
      AND c.convalidated
      AND NOT c.condeferrable
      AND NOT c.condeferred
    ORDER BY c.conname
    LIMIT 1;

    IF v_equivalent_name IS NOT NULL THEN
      RAISE EXCEPTION
        'M0E-R048 semantically equivalent FK exists under noncanonical name: %',
        v_equivalent_name;
    END IF;

    ALTER TABLE public."CarePortProviderFeeLedger"
      ADD CONSTRAINT "CarePortProviderFeeLedger_paymentIntentId_fkey"
      FOREIGN KEY ("paymentIntentId")
      REFERENCES public."CarePortPaymentIntent"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END
$m0e_r048$;

-- ============================================================
-- RepairId: M0D2-R049
-- Model: ClientMemberEligibilitySnapshot
-- RepairClass: UNIQUE_CONSTRAINT_RECONSTRUCTION_GAP
-- CompilerMode: CATALOG_GUARDED_PRISMA_CANONICAL_UNIQUE_INDEX
-- Purpose: reconstruct canonical composite unique omitted from M0-D whole-model proposal
-- ============================================================

DO $m0e_r049$
DECLARE
  v_table_oid oid := to_regclass('public."ClientMemberEligibilitySnapshot"');
  v_named_index_oid oid :=
    to_regclass(
      'public."ClientMemberEligibilitySnapshot_clientMemberId_periodKey_so_key"'
    );
  v_equivalent_name text;
BEGIN
  IF v_table_oid IS NULL THEN
    RAISE EXCEPTION 'M0E-R049 required table missing';
  END IF;

  IF v_named_index_oid IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_index i
      JOIN pg_catalog.pg_class idx
        ON idx.oid = i.indexrelid
      JOIN pg_catalog.pg_am am
        ON am.oid = idx.relam
      WHERE i.indexrelid = v_named_index_oid
        AND i.indrelid = v_table_oid
        AND i.indisunique
        AND i.indisvalid
        AND i.indisready
        AND i.indpred IS NULL
        AND i.indexprs IS NULL
        AND i.indnkeyatts = 3
        AND am.amname = 'btree'
        AND (
          SELECT array_agg(a.attname::text ORDER BY k.ordinality)
          FROM unnest(i.indkey::smallint[])
            WITH ORDINALITY AS k(attnum, ordinality)
          JOIN pg_catalog.pg_attribute a
            ON a.attrelid = i.indrelid
           AND a.attnum = k.attnum
          WHERE k.ordinality <= i.indnkeyatts
        ) = ARRAY[
          'clientMemberId',
          'periodKey',
          'source'
        ]::text[]
    ) THEN
      RAISE EXCEPTION
        'M0E-R049 canonical index name exists with noncanonical semantics';
    END IF;
  ELSE
    SELECT idx.relname
      INTO v_equivalent_name
    FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class idx
      ON idx.oid = i.indexrelid
    JOIN pg_catalog.pg_am am
      ON am.oid = idx.relam
    WHERE i.indrelid = v_table_oid
      AND i.indisunique
      AND i.indisvalid
      AND i.indisready
      AND i.indpred IS NULL
      AND i.indexprs IS NULL
      AND i.indnkeyatts = 3
      AND am.amname = 'btree'
      AND (
        SELECT array_agg(a.attname::text ORDER BY k.ordinality)
        FROM unnest(i.indkey::smallint[])
          WITH ORDINALITY AS k(attnum, ordinality)
        JOIN pg_catalog.pg_attribute a
          ON a.attrelid = i.indrelid
         AND a.attnum = k.attnum
        WHERE k.ordinality <= i.indnkeyatts
      ) = ARRAY[
        'clientMemberId',
        'periodKey',
        'source'
      ]::text[]
    ORDER BY idx.relname
    LIMIT 1;

    IF v_equivalent_name IS NOT NULL THEN
      RAISE EXCEPTION
        'M0E-R049 equivalent unique index exists under noncanonical name: %',
        v_equivalent_name;
    END IF;

    CREATE UNIQUE INDEX
      "ClientMemberEligibilitySnapshot_clientMemberId_periodKey_so_key"
      ON public."ClientMemberEligibilitySnapshot"
      ("clientMemberId", "periodKey", "source");
  END IF;
END
$m0e_r049$;

-- ============================================================
-- RepairId: M0D2-R050
-- Model: PatientSponsorEligibilityCheck
-- RepairClass: UNIQUE_CONSTRAINT_RECONSTRUCTION_GAP
-- CompilerMode: CATALOG_GUARDED_PRISMA_CANONICAL_UNIQUE_INDEX
-- Purpose: reconstruct canonical composite unique omitted from M0-D whole-model proposal
-- ============================================================

DO $m0e_r050$
DECLARE
  v_table_oid oid := to_regclass('public."PatientSponsorEligibilityCheck"');
  v_named_index_oid oid :=
    to_regclass(
      'public."PatientSponsorEligibilityCheck_patientSponsorLinkId_periodK_key"'
    );
  v_equivalent_name text;
BEGIN
  IF v_table_oid IS NULL THEN
    RAISE EXCEPTION 'M0E-R050 required table missing';
  END IF;

  IF v_named_index_oid IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_index i
      JOIN pg_catalog.pg_class idx
        ON idx.oid = i.indexrelid
      JOIN pg_catalog.pg_am am
        ON am.oid = idx.relam
      WHERE i.indexrelid = v_named_index_oid
        AND i.indrelid = v_table_oid
        AND i.indisunique
        AND i.indisvalid
        AND i.indisready
        AND i.indpred IS NULL
        AND i.indexprs IS NULL
        AND i.indnkeyatts = 2
        AND am.amname = 'btree'
        AND (
          SELECT array_agg(a.attname::text ORDER BY k.ordinality)
          FROM unnest(i.indkey::smallint[])
            WITH ORDINALITY AS k(attnum, ordinality)
          JOIN pg_catalog.pg_attribute a
            ON a.attrelid = i.indrelid
           AND a.attnum = k.attnum
          WHERE k.ordinality <= i.indnkeyatts
        ) = ARRAY[
          'patientSponsorLinkId',
          'periodKey'
        ]::text[]
    ) THEN
      RAISE EXCEPTION
        'M0E-R050 canonical index name exists with noncanonical semantics';
    END IF;
  ELSE
    SELECT idx.relname
      INTO v_equivalent_name
    FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class idx
      ON idx.oid = i.indexrelid
    JOIN pg_catalog.pg_am am
      ON am.oid = idx.relam
    WHERE i.indrelid = v_table_oid
      AND i.indisunique
      AND i.indisvalid
      AND i.indisready
      AND i.indpred IS NULL
      AND i.indexprs IS NULL
      AND i.indnkeyatts = 2
      AND am.amname = 'btree'
      AND (
        SELECT array_agg(a.attname::text ORDER BY k.ordinality)
        FROM unnest(i.indkey::smallint[])
          WITH ORDINALITY AS k(attnum, ordinality)
        JOIN pg_catalog.pg_attribute a
          ON a.attrelid = i.indrelid
         AND a.attnum = k.attnum
        WHERE k.ordinality <= i.indnkeyatts
      ) = ARRAY[
        'patientSponsorLinkId',
        'periodKey'
      ]::text[]
    ORDER BY idx.relname
    LIMIT 1;

    IF v_equivalent_name IS NOT NULL THEN
      RAISE EXCEPTION
        'M0E-R050 equivalent unique index exists under noncanonical name: %',
        v_equivalent_name;
    END IF;

    CREATE UNIQUE INDEX
      "PatientSponsorEligibilityCheck_patientSponsorLinkId_periodK_key"
      ON public."PatientSponsorEligibilityCheck"
      ("patientSponsorLinkId", "periodKey");
  END IF;
END
$m0e_r050$;

-- ============================================================
-- RepairId: M0D-R046
-- Model: PharmacyPartner
-- RepairClass: LIVE_SCHEMA_CONSTRAINT_DRIFT
-- CompilerMode: SEALED_DDL_PASSTHROUGH
-- Purpose: align live acceptedMedicalAids nullability with canonical Prisma
-- ============================================================

ALTER TABLE public."PharmacyPartner" ALTER COLUMN "acceptedMedicalAids" SET NOT NULL;
