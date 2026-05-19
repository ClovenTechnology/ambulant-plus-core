-- CreateEnum
CREATE TYPE "VisitMode" AS ENUM ('televisit', 'in_person', 'hybrid');

-- CreateEnum
CREATE TYPE "MedReachPartnerStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MedReachBillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "MedReachCommissionKind" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "MedReachPayoutStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MedReachEarningActorType" AS ENUM ('LAB', 'PHLEB');

-- CreateEnum
CREATE TYPE "MedReachStaffRole" AS ENUM ('OWNER', 'ADMIN', 'OPERATIONS', 'RESULTS', 'BILLING', 'VIEWER');

-- CreateEnum
CREATE TYPE "MedReachStaffStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "MedReachInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "MedReachOrderEligibilityStatus" AS ENUM ('ELIGIBLE', 'DECLINED', 'ACCEPTED', 'EXPIRED', 'REMOVED');

-- CreateEnum
CREATE TYPE "MedReachSpecimenStatus" AS ENUM ('PLANNED', 'COLLECTED', 'SEALED', 'IN_TRANSIT', 'RECEIVED_AT_LAB', 'ACCEPTED', 'FLAGGED', 'REJECTED', 'DISPOSED');

-- CreateEnum
CREATE TYPE "MedReachStorageMode" AS ENUM ('AMBIENT', 'COOLER_BAG', 'ICE_PACK', 'DRY_ICE', 'PROTECT_FROM_LIGHT', 'OTHER');

-- CreateEnum
CREATE TYPE "MedReachReceiptCondition" AS ENUM ('OK', 'LEAK', 'BROKEN_CONTAINER', 'HEMOLYZED', 'CLOTTED', 'INSUFFICIENT_VOLUME', 'LABEL_DAMAGED', 'WARM_OUT_OF_RANGE', 'FROZEN_UNEXPECTED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MedReachSealStatus" AS ENUM ('NOT_SET', 'APPLIED', 'INTACT', 'BROKEN', 'MISMATCH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MedReachTempSource" AS ENUM ('MANUAL', 'IOT_LOGGER', 'TEMP_STRIP', 'COOLER_SENSOR', 'OTHER');

-- CreateEnum
CREATE TYPE "MedReachCustodyAction" AS ENUM ('LABEL_PRINTED', 'ARRIVED_AT_PATIENT', 'ID_VERIFIED', 'COLLECTION_STARTED', 'COLLECTED', 'SEALED', 'STORAGE_CONFIRMED', 'HANDOFF_TO_PHLEB', 'IN_TRANSIT', 'ARRIVED_AT_LAB', 'HANDOFF_TO_LAB', 'RECEIVED_SCAN', 'ACCEPTED', 'FLAGGED', 'REJECTED', 'DISPOSED', 'RESULT_READY', 'RESULT_PUBLISHED');

-- CreateEnum
CREATE TYPE "CarePortFulfillmentMode" AS ENUM ('PICKUP', 'DELIVERY');

-- CreateEnum
CREATE TYPE "CarePortOrderStatus" AS ENUM ('CREATED', 'BROADCASTING', 'OFFERS_OPEN', 'PHARMACY_SELECTED', 'PAYMENT_PENDING', 'PAID', 'PREPARING', 'READY_FOR_PICKUP', 'DISPATCHING', 'RIDER_ASSIGNED', 'EN_ROUTE_TO_PICKUP', 'AT_PHARMACY', 'PICKED_UP', 'EN_ROUTE_TO_CUSTOMER', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CarePortOfferStatus" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CarePortStockFlag" AS ENUM ('AVAILABLE', 'PARTIAL', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "CarePortPaymentMethod" AS ENUM ('MEDICAL_AID', 'CARD', 'COD');

-- CreateEnum
CREATE TYPE "CarePortPaymentStatus" AS ENUM ('CREATED', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CarePortAssignmentStatus" AS ENUM ('SEARCHING', 'OFFERED', 'ACCEPTED', 'EN_ROUTE_TO_PICKUP', 'AT_PHARMACY', 'PICKED_UP', 'EN_ROUTE_TO_CUSTOMER', 'DELIVERED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditActorType" ADD VALUE 'LAB';
ALTER TYPE "AuditActorType" ADD VALUE 'LAB_STAFF';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PresenceActorType" ADD VALUE 'LAB';
ALTER TYPE "PresenceActorType" ADD VALUE 'LAB_STAFF';

-- DropIndex
DROP INDEX "public"."ClinicianFee_clinicianUserId_kind_currency_active_idx";

-- AlterTable
ALTER TABLE "ClinicianFee" ADD COLUMN     "visitMode" "VisitMode" NOT NULL DEFAULT 'televisit';

-- AlterTable
ALTER TABLE "ClinicianProfile" ADD COLUMN     "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ratingSum" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "LabPartner" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByUserId" TEXT,
ADD COLUMN     "billingCycle" "MedReachBillingCycle" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "canManageStaff" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canPublishResults" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "commissionKind" "MedReachCommissionKind" NOT NULL DEFAULT 'PERCENT',
ADD COLUMN     "commissionValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "country" VARCHAR(2) NOT NULL DEFAULT 'ZA',
ADD COLUMN     "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
ADD COLUMN     "monthlyAccessFeeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "onboardingStatus" TEXT,
ADD COLUMN     "ownerUserId" TEXT,
ADD COLUMN     "payoutAccountMasked" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedByUserId" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "status" "MedReachPartnerStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "PharmacyPartner" ADD COLUMN     "acceptedMedicalAids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "acceptsCard" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "acceptsCod" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "acceptsMedicalAid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "acceptsRcs" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "acceptsStoreCard" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "address" TEXT,
ADD COLUMN     "bankAccountMasked" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" VARCHAR(2) NOT NULL DEFAULT 'ZA',
ADD COLUMN     "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
ADD COLUMN     "kycPayload" JSONB,
ADD COLUMN     "kycRejectedReason" TEXT,
ADD COLUMN     "kycSchemaKey" VARCHAR(64),
ADD COLUMN     "kycStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "kycSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "kycVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "supportsDelivery" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "supportsPickup" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ClinicianRating" (
    "id" TEXT NOT NULL,
    "clinicianUserId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "stars" INTEGER NOT NULL,
    "comment" TEXT,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicianRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedReachPhlebProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "approvalStatus" "MedReachPartnerStatus" NOT NULL DEFAULT 'PENDING',
    "country" VARCHAR(2) NOT NULL DEFAULT 'ZA',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "payoutAccountMasked" TEXT,
    "commissionKind" "MedReachCommissionKind" NOT NULL DEFAULT 'PERCENT',
    "commissionValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "defaultLabId" TEXT,
    "ratingAvg" DECIMAL(4,2),
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "completedJobsCount" INTEGER NOT NULL DEFAULT 0,
    "cancelledJobsCount" INTEGER NOT NULL DEFAULT 0,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedReachPhlebProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedReachLabStaff" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "role" "MedReachStaffRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "status" "MedReachStaffStatus" NOT NULL DEFAULT 'PENDING',
    "invitedBy" TEXT,
    "approvedBy" TEXT,
    "invitedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedReachLabStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedReachPricingRule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "country" VARCHAR(2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "baseCollectionFeeCents" INTEGER NOT NULL DEFAULT 0,
    "includedKm" INTEGER NOT NULL DEFAULT 0,
    "extraPerKmCents" INTEGER NOT NULL DEFAULT 0,
    "urgentSurchargeCents" INTEGER NOT NULL DEFAULT 0,
    "coldChainSurchargeCents" INTEGER NOT NULL DEFAULT 0,
    "afterHoursSurchargeCents" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedReachPricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedReachLabPlan" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "monthlyAccessFeeCents" INTEGER NOT NULL DEFAULT 0,
    "billingCycle" "MedReachBillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "commissionKind" "MedReachCommissionKind" NOT NULL DEFAULT 'PERCENT',
    "commissionValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "activeFrom" TIMESTAMP(3) NOT NULL,
    "activeTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedReachLabPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedReachOrderFinancial" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "drawId" TEXT,
    "labId" TEXT NOT NULL,
    "phlebId" TEXT,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "logisticsFeeCents" INTEGER NOT NULL DEFAULT 0,
    "urgentSurchargeCents" INTEGER NOT NULL DEFAULT 0,
    "coldChainSurchargeCents" INTEGER NOT NULL DEFAULT 0,
    "platformFeeCents" INTEGER NOT NULL DEFAULT 0,
    "labGrossCents" INTEGER NOT NULL DEFAULT 0,
    "phlebGrossCents" INTEGER NOT NULL DEFAULT 0,
    "labNetCents" INTEGER NOT NULL DEFAULT 0,
    "phlebNetCents" INTEGER NOT NULL DEFAULT 0,
    "pricingSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedReachOrderFinancial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedReachPayout" (
    "id" TEXT NOT NULL,
    "actorType" "MedReachEarningActorType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "grossCents" INTEGER NOT NULL DEFAULT 0,
    "deductionsCents" INTEGER NOT NULL DEFAULT 0,
    "netCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "status" "MedReachPayoutStatus" NOT NULL DEFAULT 'PENDING',
    "payoutRef" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedReachPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedReachInvoice" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "monthlyAccessFeeCents" INTEGER NOT NULL DEFAULT 0,
    "commissionTotalCents" INTEGER NOT NULL DEFAULT 0,
    "totalDueCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "fileKey" TEXT,
    "status" "MedReachInvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedReachInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedReachEarningEvent" (
    "id" TEXT NOT NULL,
    "actorType" "MedReachEarningActorType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "drawId" TEXT,
    "eventType" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedReachEarningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedReachOrderEligibleLab" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "status" "MedReachOrderEligibilityStatus" NOT NULL DEFAULT 'ELIGIBLE',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "invitedByUserId" TEXT,
    "respondedByUserId" TEXT,
    "notes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedReachOrderEligibleLab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedReachTestCatalog" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "loincCode" TEXT,
    "specimenTypeDefault" TEXT,
    "containerTypeDefault" TEXT,
    "requiresColdChainDefault" BOOLEAN NOT NULL DEFAULT false,
    "requiredTempMinCDefault" DOUBLE PRECISION,
    "requiredTempMaxCDefault" DOUBLE PRECISION,
    "prepNotes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedReachTestCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedReachLabOfferedTest" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "catalogTestId" TEXT,
    "localCode" TEXT,
    "localName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priceCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "turnaroundHours" INTEGER NOT NULL,
    "specimenType" TEXT NOT NULL,
    "containerType" TEXT,
    "requiresColdChain" BOOLEAN NOT NULL DEFAULT false,
    "requiredTempMinC" DOUBLE PRECISION,
    "requiredTempMaxC" DOUBLE PRECISION,
    "maxTransitMins" INTEGER,
    "prepNotes" TEXT,
    "availabilityMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedReachLabOfferedTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedReachLabPanel" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priceCents" INTEGER,
    "currency" VARCHAR(3),
    "turnaroundHours" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedReachLabPanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedReachLabPanelItem" (
    "id" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "offeredTestId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MedReachLabPanelItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedReachSpecimenBundle" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "encounterId" TEXT,
    "patientId" TEXT,
    "clinicianId" TEXT,
    "drawId" TEXT,
    "labPartnerId" TEXT,
    "status" "MedReachSpecimenStatus" NOT NULL DEFAULT 'PLANNED',
    "labelPrintedAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),
    "sealedAt" TIMESTAMP(3),
    "inTransitAt" TIMESTAMP(3),
    "receivedAtLabAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "notes" TEXT,
    "meta" JSONB,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedReachSpecimenBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedReachSpecimen" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "specimenType" TEXT NOT NULL,
    "containerType" TEXT,
    "containerCount" INTEGER NOT NULL DEFAULT 1,
    "barcodeValue" VARCHAR(128),
    "barcodeChecksum" VARCHAR(64),
    "labelVersion" INTEGER NOT NULL DEFAULT 1,
    "requiresColdChain" BOOLEAN NOT NULL DEFAULT false,
    "requiredTempMinC" DOUBLE PRECISION,
    "requiredTempMaxC" DOUBLE PRECISION,
    "maxTransitMins" INTEGER,
    "storageMode" "MedReachStorageMode" NOT NULL DEFAULT 'AMBIENT',
    "tamperSealId" VARCHAR(64),
    "sealStatus" "MedReachSealStatus" NOT NULL DEFAULT 'NOT_SET',
    "sealVerifiedAt" TIMESTAMP(3),
    "sealVerifiedBy" TEXT,
    "conditionOnReceipt" "MedReachReceiptCondition",
    "rejectionReason" TEXT,
    "status" "MedReachSpecimenStatus" NOT NULL DEFAULT 'PLANNED',
    "collectionTime" TIMESTAMP(3),
    "deliveredAtLabAt" TIMESTAMP(3),
    "labOrderId" TEXT,
    "labResultId" TEXT,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedReachSpecimen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedReachCustodyEvent" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT,
    "specimenId" TEXT,
    "action" "MedReachCustodyAction" NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "meta" JSONB,
    "correlationId" VARCHAR(64),
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedReachCustodyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedReachSpecimenTemperatureLog" (
    "id" TEXT NOT NULL,
    "specimenId" TEXT NOT NULL,
    "valueC" DOUBLE PRECISION NOT NULL,
    "source" "MedReachTempSource" NOT NULL DEFAULT 'MANUAL',
    "note" TEXT,
    "correlationId" VARCHAR(64),
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedReachSpecimenTemperatureLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedReachSpecimenEvidence" (
    "id" TEXT NOT NULL,
    "specimenId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileMime" TEXT,
    "fileName" TEXT,
    "capturedBy" TEXT,
    "actorRole" TEXT,
    "correlationId" VARCHAR(64),
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedReachSpecimenEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePortOrder" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "erxOrderId" TEXT NOT NULL,
    "refillNo" INTEGER NOT NULL DEFAULT 0,
    "encounterId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "status" "CarePortOrderStatus" NOT NULL DEFAULT 'CREATED',
    "fulfillment" "CarePortFulfillmentMode" NOT NULL,
    "destinationAddr" TEXT,
    "destinationLat" DOUBLE PRECISION,
    "destinationLng" DOUBLE PRECISION,
    "broadcastStartedAt" TIMESTAMP(3),
    "maxBroadcastKm" INTEGER NOT NULL DEFAULT 50,
    "chosenPharmacyId" TEXT,
    "chosenOfferId" TEXT,
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarePortOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePortOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "erxMedKey" TEXT NOT NULL,
    "drugCode" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "directions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarePortOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePortPharmacySku" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "pharmacyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "drugCode" TEXT,
    "skuCode" TEXT,
    "isGeneric" BOOLEAN NOT NULL DEFAULT false,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarePortPharmacySku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePortGenericLink" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "pharmacyId" TEXT NOT NULL,
    "originalSkuId" TEXT NOT NULL,
    "genericSkuId" TEXT NOT NULL,

    CONSTRAINT "CarePortGenericLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePortOffer" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "orderId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "status" "CarePortOfferStatus" NOT NULL DEFAULT 'INVITED',
    "acceptedAt" TIMESTAMP(3),
    "prepEtaMin" INTEGER,
    "isPartial" BOOLEAN NOT NULL DEFAULT false,
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarePortOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePortOfferLine" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "stockFlag" "CarePortStockFlag" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarePortOfferLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePortOfferLineOption" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "isGeneric" BOOLEAN NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarePortOfferLineOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePortSelection" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "chosenSkuId" TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarePortSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePortPaymentIntent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "orderId" TEXT NOT NULL,
    "method" "CarePortPaymentMethod" NOT NULL,
    "status" "CarePortPaymentStatus" NOT NULL DEFAULT 'CREATED',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarePortPaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePortRiderProfile" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "userId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "country" VARCHAR(2) NOT NULL DEFAULT 'ZA',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOnJob" BOOLEAN NOT NULL DEFAULT false,
    "kyiStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "kyiSchemaKey" VARCHAR(64),
    "kyiPayload" JSONB,
    "kyiSubmittedAt" TIMESTAMP(3),
    "kyiVerifiedAt" TIMESTAMP(3),
    "kyiRejectedReason" TEXT,
    "bankAccountMasked" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarePortRiderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePortRiderAssignment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "orderId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "riderUserId" TEXT,
    "status" "CarePortAssignmentStatus" NOT NULL DEFAULT 'SEARCHING',
    "dispatchStartedAt" TIMESTAMP(3),
    "maxDispatchKm" INTEGER NOT NULL DEFAULT 25,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "carePortRiderProfileId" TEXT,

    CONSTRAINT "CarePortRiderAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePortDeliveryPricingRule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "country" VARCHAR(2) NOT NULL DEFAULT 'ZA',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "baseFeeCents" INTEGER NOT NULL,
    "includedKm" INTEGER NOT NULL DEFAULT 5,
    "extraPerKmCents" INTEGER NOT NULL,
    "codEnabled" BOOLEAN NOT NULL DEFAULT false,
    "codLimitCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarePortDeliveryPricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePortPharmacyStaff" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "userId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "staffRole" TEXT NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarePortPharmacyStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "actorUserId" TEXT,
    "requestHash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClinicianRating_appointmentId_key" ON "ClinicianRating"("appointmentId");

-- CreateIndex
CREATE INDEX "ClinicianRating_clinicianUserId_createdAt_idx" ON "ClinicianRating"("clinicianUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicianRating_patientId_createdAt_idx" ON "ClinicianRating"("patientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MedReachPhlebProfile_userId_key" ON "MedReachPhlebProfile"("userId");

-- CreateIndex
CREATE INDEX "MedReachPhlebProfile_approvalStatus_idx" ON "MedReachPhlebProfile"("approvalStatus");

-- CreateIndex
CREATE INDEX "MedReachPhlebProfile_defaultLabId_idx" ON "MedReachPhlebProfile"("defaultLabId");

-- CreateIndex
CREATE INDEX "MedReachPhlebProfile_country_currency_idx" ON "MedReachPhlebProfile"("country", "currency");

-- CreateIndex
CREATE INDEX "MedReachLabStaff_labId_role_idx" ON "MedReachLabStaff"("labId", "role");

-- CreateIndex
CREATE INDEX "MedReachLabStaff_status_active_idx" ON "MedReachLabStaff"("status", "active");

-- CreateIndex
CREATE INDEX "MedReachLabStaff_userId_idx" ON "MedReachLabStaff"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MedReachLabStaff_userId_labId_key" ON "MedReachLabStaff"("userId", "labId");

-- CreateIndex
CREATE INDEX "MedReachPricingRule_orgId_isActive_idx" ON "MedReachPricingRule"("orgId", "isActive");

-- CreateIndex
CREATE INDEX "MedReachPricingRule_country_currency_isActive_idx" ON "MedReachPricingRule"("country", "currency", "isActive");

-- CreateIndex
CREATE INDEX "MedReachLabPlan_labId_isActive_idx" ON "MedReachLabPlan"("labId", "isActive");

-- CreateIndex
CREATE INDEX "MedReachLabPlan_activeFrom_activeTo_idx" ON "MedReachLabPlan"("activeFrom", "activeTo");

-- CreateIndex
CREATE UNIQUE INDEX "MedReachOrderFinancial_orderId_key" ON "MedReachOrderFinancial"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "MedReachOrderFinancial_drawId_key" ON "MedReachOrderFinancial"("drawId");

-- CreateIndex
CREATE INDEX "MedReachOrderFinancial_labId_createdAt_idx" ON "MedReachOrderFinancial"("labId", "createdAt");

-- CreateIndex
CREATE INDEX "MedReachOrderFinancial_phlebId_createdAt_idx" ON "MedReachOrderFinancial"("phlebId", "createdAt");

-- CreateIndex
CREATE INDEX "MedReachPayout_actorType_actorId_status_idx" ON "MedReachPayout"("actorType", "actorId", "status");

-- CreateIndex
CREATE INDEX "MedReachPayout_periodStart_periodEnd_idx" ON "MedReachPayout"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "MedReachInvoice_labId_status_idx" ON "MedReachInvoice"("labId", "status");

-- CreateIndex
CREATE INDEX "MedReachInvoice_periodStart_periodEnd_idx" ON "MedReachInvoice"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "MedReachEarningEvent_actorType_actorId_createdAt_idx" ON "MedReachEarningEvent"("actorType", "actorId", "createdAt");

-- CreateIndex
CREATE INDEX "MedReachEarningEvent_orderId_createdAt_idx" ON "MedReachEarningEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "MedReachEarningEvent_drawId_idx" ON "MedReachEarningEvent"("drawId");

-- CreateIndex
CREATE INDEX "MedReachEarningEvent_eventType_idx" ON "MedReachEarningEvent"("eventType");

-- CreateIndex
CREATE INDEX "MedReachOrderEligibleLab_orderId_status_idx" ON "MedReachOrderEligibleLab"("orderId", "status");

-- CreateIndex
CREATE INDEX "MedReachOrderEligibleLab_labId_status_idx" ON "MedReachOrderEligibleLab"("labId", "status");

-- CreateIndex
CREATE INDEX "MedReachOrderEligibleLab_orderId_labId_status_idx" ON "MedReachOrderEligibleLab"("orderId", "labId", "status");

-- CreateIndex
CREATE INDEX "MedReachOrderEligibleLab_orderId_createdAt_idx" ON "MedReachOrderEligibleLab"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MedReachOrderEligibleLab_orderId_labId_key" ON "MedReachOrderEligibleLab"("orderId", "labId");

-- CreateIndex
CREATE UNIQUE INDEX "MedReachTestCatalog_code_key" ON "MedReachTestCatalog"("code");

-- CreateIndex
CREATE INDEX "MedReachTestCatalog_active_idx" ON "MedReachTestCatalog"("active");

-- CreateIndex
CREATE INDEX "MedReachTestCatalog_category_idx" ON "MedReachTestCatalog"("category");

-- CreateIndex
CREATE INDEX "MedReachTestCatalog_name_idx" ON "MedReachTestCatalog"("name");

-- CreateIndex
CREATE INDEX "MedReachTestCatalog_loincCode_idx" ON "MedReachTestCatalog"("loincCode");

-- CreateIndex
CREATE INDEX "MedReachLabOfferedTest_labId_active_idx" ON "MedReachLabOfferedTest"("labId", "active");

-- CreateIndex
CREATE INDEX "MedReachLabOfferedTest_labId_localCode_idx" ON "MedReachLabOfferedTest"("labId", "localCode");

-- CreateIndex
CREATE INDEX "MedReachLabOfferedTest_catalogTestId_idx" ON "MedReachLabOfferedTest"("catalogTestId");

-- CreateIndex
CREATE INDEX "MedReachLabOfferedTest_currency_idx" ON "MedReachLabOfferedTest"("currency");

-- CreateIndex
CREATE INDEX "MedReachLabOfferedTest_localName_idx" ON "MedReachLabOfferedTest"("localName");

-- CreateIndex
CREATE UNIQUE INDEX "medreach_lab_offered_test_labId_localCode_key" ON "MedReachLabOfferedTest"("labId", "localCode");

-- CreateIndex
CREATE INDEX "MedReachLabPanel_labId_active_idx" ON "MedReachLabPanel"("labId", "active");

-- CreateIndex
CREATE INDEX "MedReachLabPanel_labId_name_idx" ON "MedReachLabPanel"("labId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MedReachLabPanel_labId_code_key" ON "MedReachLabPanel"("labId", "code");

-- CreateIndex
CREATE INDEX "MedReachLabPanelItem_panelId_sortOrder_idx" ON "MedReachLabPanelItem"("panelId", "sortOrder");

-- CreateIndex
CREATE INDEX "MedReachLabPanelItem_offeredTestId_idx" ON "MedReachLabPanelItem"("offeredTestId");

-- CreateIndex
CREATE UNIQUE INDEX "MedReachLabPanelItem_panelId_offeredTestId_key" ON "MedReachLabPanelItem"("panelId", "offeredTestId");

-- CreateIndex
CREATE UNIQUE INDEX "MedReachSpecimenBundle_drawId_key" ON "MedReachSpecimenBundle"("drawId");

-- CreateIndex
CREATE INDEX "MedReachSpecimenBundle_orgId_createdAt_idx" ON "MedReachSpecimenBundle"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "MedReachSpecimenBundle_status_updatedAt_idx" ON "MedReachSpecimenBundle"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "MedReachSpecimenBundle_patientId_createdAt_idx" ON "MedReachSpecimenBundle"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "MedReachSpecimenBundle_encounterId_idx" ON "MedReachSpecimenBundle"("encounterId");

-- CreateIndex
CREATE INDEX "MedReachSpecimenBundle_orderId_idx" ON "MedReachSpecimenBundle"("orderId");

-- CreateIndex
CREATE INDEX "MedReachSpecimenBundle_labPartnerId_idx" ON "MedReachSpecimenBundle"("labPartnerId");

-- CreateIndex
CREATE INDEX "MedReachSpecimen_bundleId_createdAt_idx" ON "MedReachSpecimen"("bundleId", "createdAt");

-- CreateIndex
CREATE INDEX "MedReachSpecimen_status_updatedAt_idx" ON "MedReachSpecimen"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "MedReachSpecimen_barcodeValue_idx" ON "MedReachSpecimen"("barcodeValue");

-- CreateIndex
CREATE INDEX "MedReachSpecimen_tamperSealId_idx" ON "MedReachSpecimen"("tamperSealId");

-- CreateIndex
CREATE INDEX "MedReachSpecimen_labOrderId_idx" ON "MedReachSpecimen"("labOrderId");

-- CreateIndex
CREATE INDEX "MedReachSpecimen_labResultId_idx" ON "MedReachSpecimen"("labResultId");

-- CreateIndex
CREATE INDEX "MedReachSpecimen_orgId_idx" ON "MedReachSpecimen"("orgId");

-- CreateIndex
CREATE INDEX "MedReachCustodyEvent_bundleId_createdAt_idx" ON "MedReachCustodyEvent"("bundleId", "createdAt");

-- CreateIndex
CREATE INDEX "MedReachCustodyEvent_specimenId_createdAt_idx" ON "MedReachCustodyEvent"("specimenId", "createdAt");

-- CreateIndex
CREATE INDEX "MedReachCustodyEvent_action_createdAt_idx" ON "MedReachCustodyEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "MedReachCustodyEvent_actorId_createdAt_idx" ON "MedReachCustodyEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "MedReachCustodyEvent_orgId_createdAt_idx" ON "MedReachCustodyEvent"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "MedReachSpecimenTemperatureLog_specimenId_recordedAt_idx" ON "MedReachSpecimenTemperatureLog"("specimenId", "recordedAt");

-- CreateIndex
CREATE INDEX "MedReachSpecimenTemperatureLog_source_recordedAt_idx" ON "MedReachSpecimenTemperatureLog"("source", "recordedAt");

-- CreateIndex
CREATE INDEX "MedReachSpecimenTemperatureLog_orgId_recordedAt_idx" ON "MedReachSpecimenTemperatureLog"("orgId", "recordedAt");

-- CreateIndex
CREATE INDEX "MedReachSpecimenEvidence_specimenId_capturedAt_idx" ON "MedReachSpecimenEvidence"("specimenId", "capturedAt");

-- CreateIndex
CREATE INDEX "MedReachSpecimenEvidence_kind_capturedAt_idx" ON "MedReachSpecimenEvidence"("kind", "capturedAt");

-- CreateIndex
CREATE INDEX "MedReachSpecimenEvidence_capturedBy_capturedAt_idx" ON "MedReachSpecimenEvidence"("capturedBy", "capturedAt");

-- CreateIndex
CREATE INDEX "MedReachSpecimenEvidence_orgId_capturedAt_idx" ON "MedReachSpecimenEvidence"("orgId", "capturedAt");

-- CreateIndex
CREATE INDEX "CarePortOrder_orgId_createdAt_idx" ON "CarePortOrder"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "CarePortOrder_patientId_createdAt_idx" ON "CarePortOrder"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "CarePortOrder_status_updatedAt_idx" ON "CarePortOrder"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CarePortOrder_erxOrderId_refillNo_key" ON "CarePortOrder"("erxOrderId", "refillNo");

-- CreateIndex
CREATE INDEX "CarePortOrderItem_orderId_idx" ON "CarePortOrderItem"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "CarePortOrderItem_orderId_erxMedKey_key" ON "CarePortOrderItem"("orderId", "erxMedKey");

-- CreateIndex
CREATE INDEX "CarePortPharmacySku_pharmacyId_isActive_idx" ON "CarePortPharmacySku"("pharmacyId", "isActive");

-- CreateIndex
CREATE INDEX "CarePortPharmacySku_pharmacyId_drugCode_idx" ON "CarePortPharmacySku"("pharmacyId", "drugCode");

-- CreateIndex
CREATE INDEX "CarePortPharmacySku_orgId_idx" ON "CarePortPharmacySku"("orgId");

-- CreateIndex
CREATE INDEX "CarePortGenericLink_pharmacyId_idx" ON "CarePortGenericLink"("pharmacyId");

-- CreateIndex
CREATE INDEX "CarePortGenericLink_orgId_idx" ON "CarePortGenericLink"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "CarePortGenericLink_pharmacyId_originalSkuId_genericSkuId_key" ON "CarePortGenericLink"("pharmacyId", "originalSkuId", "genericSkuId");

-- CreateIndex
CREATE INDEX "CarePortOffer_orderId_status_idx" ON "CarePortOffer"("orderId", "status");

-- CreateIndex
CREATE INDEX "CarePortOffer_pharmacyId_status_idx" ON "CarePortOffer"("pharmacyId", "status");

-- CreateIndex
CREATE INDEX "CarePortOffer_orgId_idx" ON "CarePortOffer"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "CarePortOffer_orderId_pharmacyId_key" ON "CarePortOffer"("orderId", "pharmacyId");

-- CreateIndex
CREATE INDEX "CarePortOfferLine_offerId_idx" ON "CarePortOfferLine"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX "CarePortOfferLine_offerId_orderItemId_key" ON "CarePortOfferLine"("offerId", "orderItemId");

-- CreateIndex
CREATE INDEX "CarePortOfferLineOption_lineId_idx" ON "CarePortOfferLineOption"("lineId");

-- CreateIndex
CREATE INDEX "CarePortSelection_orderId_idx" ON "CarePortSelection"("orderId");

-- CreateIndex
CREATE INDEX "CarePortSelection_orgId_idx" ON "CarePortSelection"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "CarePortSelection_orderId_orderItemId_key" ON "CarePortSelection"("orderId", "orderItemId");

-- CreateIndex
CREATE INDEX "CarePortPaymentIntent_orderId_status_idx" ON "CarePortPaymentIntent"("orderId", "status");

-- CreateIndex
CREATE INDEX "CarePortPaymentIntent_orgId_idx" ON "CarePortPaymentIntent"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "CarePortRiderProfile_userId_key" ON "CarePortRiderProfile"("userId");

-- CreateIndex
CREATE INDEX "CarePortRiderProfile_orgId_idx" ON "CarePortRiderProfile"("orgId");

-- CreateIndex
CREATE INDEX "CarePortRiderProfile_isActive_isOnJob_idx" ON "CarePortRiderProfile"("isActive", "isOnJob");

-- CreateIndex
CREATE INDEX "CarePortRiderProfile_country_currency_idx" ON "CarePortRiderProfile"("country", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "CarePortRiderAssignment_orderId_key" ON "CarePortRiderAssignment"("orderId");

-- CreateIndex
CREATE INDEX "CarePortRiderAssignment_pharmacyId_status_idx" ON "CarePortRiderAssignment"("pharmacyId", "status");

-- CreateIndex
CREATE INDEX "CarePortRiderAssignment_riderUserId_status_idx" ON "CarePortRiderAssignment"("riderUserId", "status");

-- CreateIndex
CREATE INDEX "CarePortRiderAssignment_orgId_idx" ON "CarePortRiderAssignment"("orgId");

-- CreateIndex
CREATE INDEX "CarePortDeliveryPricingRule_orgId_country_currency_isActive_idx" ON "CarePortDeliveryPricingRule"("orgId", "country", "currency", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CarePortPharmacyStaff_userId_key" ON "CarePortPharmacyStaff"("userId");

-- CreateIndex
CREATE INDEX "CarePortPharmacyStaff_pharmacyId_idx" ON "CarePortPharmacyStaff"("pharmacyId");

-- CreateIndex
CREATE INDEX "CarePortPharmacyStaff_orgId_idx" ON "CarePortPharmacyStaff"("orgId");

-- CreateIndex
CREATE INDEX "IdempotencyKey_orgId_createdAt_idx" ON "IdempotencyKey"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_orgId_scope_key_actorUserId_key" ON "IdempotencyKey"("orgId", "scope", "key", "actorUserId");

-- CreateIndex
CREATE INDEX "ClinicianFee_clinicianUserId_kind_visitMode_currency_active_idx" ON "ClinicianFee"("clinicianUserId", "kind", "visitMode", "currency", "active");

-- CreateIndex
CREATE INDEX "ClinicianProfile_ratingAvg_idx" ON "ClinicianProfile"("ratingAvg");

-- CreateIndex
CREATE INDEX "ClinicianProfile_ratingCount_idx" ON "ClinicianProfile"("ratingCount");

-- CreateIndex
CREATE INDEX "LabPartner_status_idx" ON "LabPartner"("status");

-- CreateIndex
CREATE INDEX "LabPartner_country_currency_idx" ON "LabPartner"("country", "currency");

-- CreateIndex
CREATE INDEX "LabPartner_ownerUserId_idx" ON "LabPartner"("ownerUserId");

-- CreateIndex
CREATE INDEX "PharmacyPartner_city_idx" ON "PharmacyPartner"("city");

-- CreateIndex
CREATE INDEX "PharmacyPartner_country_currency_idx" ON "PharmacyPartner"("country", "currency");

-- AddForeignKey
ALTER TABLE "ClinicianRating" ADD CONSTRAINT "ClinicianRating_clinicianUserId_fkey" FOREIGN KEY ("clinicianUserId") REFERENCES "ClinicianProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedReachPhlebProfile" ADD CONSTRAINT "MedReachPhlebProfile_defaultLabId_fkey" FOREIGN KEY ("defaultLabId") REFERENCES "LabPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedReachLabStaff" ADD CONSTRAINT "MedReachLabStaff_labId_fkey" FOREIGN KEY ("labId") REFERENCES "LabPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedReachLabPlan" ADD CONSTRAINT "MedReachLabPlan_labId_fkey" FOREIGN KEY ("labId") REFERENCES "LabPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedReachOrderFinancial" ADD CONSTRAINT "MedReachOrderFinancial_labId_fkey" FOREIGN KEY ("labId") REFERENCES "LabPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedReachOrderFinancial" ADD CONSTRAINT "MedReachOrderFinancial_phlebId_fkey" FOREIGN KEY ("phlebId") REFERENCES "MedReachPhlebProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedReachInvoice" ADD CONSTRAINT "MedReachInvoice_labId_fkey" FOREIGN KEY ("labId") REFERENCES "LabPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedReachOrderEligibleLab" ADD CONSTRAINT "MedReachOrderEligibleLab_labId_fkey" FOREIGN KEY ("labId") REFERENCES "LabPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedReachLabOfferedTest" ADD CONSTRAINT "MedReachLabOfferedTest_labId_fkey" FOREIGN KEY ("labId") REFERENCES "LabPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedReachLabOfferedTest" ADD CONSTRAINT "MedReachLabOfferedTest_catalogTestId_fkey" FOREIGN KEY ("catalogTestId") REFERENCES "MedReachTestCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedReachLabPanel" ADD CONSTRAINT "MedReachLabPanel_labId_fkey" FOREIGN KEY ("labId") REFERENCES "LabPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedReachLabPanelItem" ADD CONSTRAINT "MedReachLabPanelItem_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "MedReachLabPanel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedReachLabPanelItem" ADD CONSTRAINT "MedReachLabPanelItem_offeredTestId_fkey" FOREIGN KEY ("offeredTestId") REFERENCES "MedReachLabOfferedTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedReachSpecimenBundle" ADD CONSTRAINT "MedReachSpecimenBundle_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "Draw"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedReachSpecimenBundle" ADD CONSTRAINT "MedReachSpecimenBundle_labPartnerId_fkey" FOREIGN KEY ("labPartnerId") REFERENCES "LabPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedReachSpecimen" ADD CONSTRAINT "MedReachSpecimen_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "MedReachSpecimenBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedReachCustodyEvent" ADD CONSTRAINT "MedReachCustodyEvent_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "MedReachSpecimenBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedReachCustodyEvent" ADD CONSTRAINT "MedReachCustodyEvent_specimenId_fkey" FOREIGN KEY ("specimenId") REFERENCES "MedReachSpecimen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedReachSpecimenTemperatureLog" ADD CONSTRAINT "MedReachSpecimenTemperatureLog_specimenId_fkey" FOREIGN KEY ("specimenId") REFERENCES "MedReachSpecimen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedReachSpecimenEvidence" ADD CONSTRAINT "MedReachSpecimenEvidence_specimenId_fkey" FOREIGN KEY ("specimenId") REFERENCES "MedReachSpecimen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePortOrder" ADD CONSTRAINT "CarePortOrder_chosenPharmacyId_fkey" FOREIGN KEY ("chosenPharmacyId") REFERENCES "PharmacyPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePortOrderItem" ADD CONSTRAINT "CarePortOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CarePortOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePortPharmacySku" ADD CONSTRAINT "CarePortPharmacySku_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePortGenericLink" ADD CONSTRAINT "CarePortGenericLink_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePortOffer" ADD CONSTRAINT "CarePortOffer_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CarePortOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePortOffer" ADD CONSTRAINT "CarePortOffer_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePortOfferLine" ADD CONSTRAINT "CarePortOfferLine_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "CarePortOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePortOfferLineOption" ADD CONSTRAINT "CarePortOfferLineOption_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "CarePortOfferLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePortSelection" ADD CONSTRAINT "CarePortSelection_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CarePortOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePortPaymentIntent" ADD CONSTRAINT "CarePortPaymentIntent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CarePortOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePortRiderAssignment" ADD CONSTRAINT "CarePortRiderAssignment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CarePortOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePortRiderAssignment" ADD CONSTRAINT "CarePortRiderAssignment_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePortRiderAssignment" ADD CONSTRAINT "CarePortRiderAssignment_carePortRiderProfileId_fkey" FOREIGN KEY ("carePortRiderProfileId") REFERENCES "CarePortRiderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePortPharmacyStaff" ADD CONSTRAINT "CarePortPharmacyStaff_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
