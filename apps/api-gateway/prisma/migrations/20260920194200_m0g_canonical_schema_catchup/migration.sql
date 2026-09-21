-- AlterTable
ALTER TABLE "CarePortGlobalProduct" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CarePortGlobalProductCode" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CarePortOrder" ADD COLUMN     "paymentProviderFeeMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pharmacyGrossMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pharmacyNetMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "platformFeeMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refundMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "riderFeeMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "riderNetMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "settlementSnapshot" JSONB,
ADD COLUMN     "settlementStatus" TEXT NOT NULL DEFAULT 'UNSETTLED';

-- AlterTable
ALTER TABLE "CarePortPaymentIntent" ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerPayload" JSONB,
ADD COLUMN     "providerRef" TEXT,
ADD COLUMN     "providerStatus" TEXT;

-- AlterTable
ALTER TABLE "CarePortPharmacySkuGlobalProductMap" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ClinicianTrainingAdmission" RENAME CONSTRAINT "cta_pkey" TO "ClinicianTrainingAdmission_pkey";

-- AlterTable
ALTER TABLE "ClinicianTrainingAttendanceSession" RENAME CONSTRAINT "ctas_pkey" TO "ClinicianTrainingAttendanceSession_pkey";

-- AlterTable
ALTER TABLE "ClinicianTrainingParticipantAssignment" RENAME CONSTRAINT "ctpa_pkey" TO "ClinicianTrainingParticipantAssignment_pkey";

-- AlterTable
ALTER TABLE "MedReachLabNetwork" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MedReachLabNetworkStaff" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MedReachLabReview" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PatientProfile" ADD COLUMN     "emergencyContact" JSONB,
ADD COLUMN     "profileMetadata" JSONB,
ALTER COLUMN "weightKg" TYPE DOUBLE PRECISION USING "weightKg"::DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "CarePortSettlementBatch" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "kind" TEXT NOT NULL DEFAULT 'CAREPORT',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalGrossMinor" INTEGER NOT NULL DEFAULT 0,
    "pharmacyGrossMinor" INTEGER NOT NULL DEFAULT 0,
    "riderGrossMinor" INTEGER NOT NULL DEFAULT 0,
    "platformFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "paymentProviderFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "subscriptionFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "inventoryHostingFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "pharmacyNetPayableMinor" INTEGER NOT NULL DEFAULT 0,
    "riderNetPayableMinor" INTEGER NOT NULL DEFAULT 0,
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "generatedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "paidByUserId" TEXT,
    "failedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "remittanceRef" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarePortSettlementBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePortSettlementLine" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "batchId" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientName" TEXT,
    "orderIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tripCount" INTEGER NOT NULL DEFAULT 0,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "grossMinor" INTEGER NOT NULL DEFAULT 0,
    "platformFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "paymentProviderFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "subscriptionFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "inventoryHostingFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "riderFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "refundMinor" INTEGER NOT NULL DEFAULT 0,
    "netPayableMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remittanceRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarePortSettlementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePortSubscriptionInvoice" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "pharmacyId" TEXT NOT NULL,
    "invoiceType" TEXT NOT NULL DEFAULT 'MONTHLY_PLATFORM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    "onboardingFeeCents" INTEGER NOT NULL DEFAULT 0,
    "monthlyPlatformFeeCents" INTEGER NOT NULL DEFAULT 0,
    "inventoryHostingFeeCents" INTEGER NOT NULL DEFAULT 0,
    "otherFeeCents" INTEGER NOT NULL DEFAULT 0,
    "totalDueCents" INTEGER NOT NULL DEFAULT 0,
    "paidCents" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "externalRef" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarePortSubscriptionInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePortOperationalSetting" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarePortOperationalSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicianOnboardingPayment" (
    "id" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerReference" TEXT,
    "paymentReference" TEXT,
    "payerName" TEXT,
    "originBank" TEXT,
    "paymentDate" TIMESTAMP(3),
    "proofOfPaymentUrl" TEXT,
    "authorisationCodeHash" TEXT,
    "authorisationCodeHint" TEXT,
    "authorisationExpiresAt" TIMESTAMP(3),
    "authorisationUsedAt" TIMESTAMP(3),
    "confirmedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicianOnboardingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberReimbursementClaim" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "clientId" TEXT,
    "clientMemberId" TEXT,
    "patientSponsorLinkId" TEXT,
    "patientId" TEXT NOT NULL,
    "userId" TEXT,
    "appointmentId" TEXT,
    "encounterId" TEXT,
    "paymentRef" TEXT,
    "claimNumber" TEXT NOT NULL,
    "claimType" TEXT NOT NULL DEFAULT 'MEMBER_REIMBURSEMENT',
    "payeeType" TEXT NOT NULL DEFAULT 'PATIENT',
    "originalPaymentMethod" TEXT NOT NULL DEFAULT 'CARD',
    "providerAlreadyPaid" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "reason" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "requestedAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "approvedAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "paidAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "memberResponsibilityMinor" INTEGER NOT NULL DEFAULT 0,
    "policySnapshot" JSONB,
    "appointmentSnapshot" JSONB,
    "evidenceJson" JSONB,
    "reviewPayload" JSONB,
    "metadata" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidByUserId" TEXT,
    "remittanceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberReimbursementClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderNetworkRecord" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT,
    "providerLane" TEXT NOT NULL,
    "providerType" TEXT NOT NULL DEFAULT 'ORGANISATION',
    "providerId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradingName" TEXT,
    "displayName" TEXT NOT NULL,
    "practiceNumber" TEXT,
    "providerCode" TEXT,
    "registrationNumber" TEXT,
    "taxNumber" TEXT,
    "country" TEXT NOT NULL DEFAULT 'ZA',
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "networkStatus" TEXT NOT NULL DEFAULT 'NETWORK_REVIEW',
    "dspStatus" TEXT NOT NULL DEFAULT 'NOT_DSP',
    "contractStatus" TEXT NOT NULL DEFAULT 'REVIEW',
    "credentialingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "bankVerificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "riskStatus" TEXT NOT NULL DEFAULT 'NORMAL',
    "claimsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "settlementEnabled" BOOLEAN NOT NULL DEFAULT false,
    "directSettlementEnabled" BOOLEAN NOT NULL DEFAULT false,
    "payoutRoute" TEXT NOT NULL DEFAULT 'AMBULANT_PLUS',
    "payeeEntityType" TEXT NOT NULL DEFAULT 'AMBULANT_PLUS',
    "payeeEntityId" TEXT,
    "settlementCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "acceptedSchemes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "schemeRuleCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderNetworkRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CarePortSettlementBatch_orgId_status_periodStart_periodEnd_idx" ON "CarePortSettlementBatch"("orgId", "status", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "CarePortSettlementBatch_periodStart_periodEnd_idx" ON "CarePortSettlementBatch"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "CarePortSettlementBatch_createdAt_idx" ON "CarePortSettlementBatch"("createdAt");

-- CreateIndex
CREATE INDEX "CarePortSettlementLine_orgId_recipientType_recipientId_stat_idx" ON "CarePortSettlementLine"("orgId", "recipientType", "recipientId", "status");

-- CreateIndex
CREATE INDEX "CarePortSettlementLine_batchId_idx" ON "CarePortSettlementLine"("batchId");

-- CreateIndex
CREATE INDEX "CarePortSettlementLine_status_createdAt_idx" ON "CarePortSettlementLine"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CarePortSettlementLine_batchId_recipientType_recipientId_key" ON "CarePortSettlementLine"("batchId", "recipientType", "recipientId");

-- CreateIndex
CREATE INDEX "CarePortSubscriptionInvoice_orgId_pharmacyId_status_idx" ON "CarePortSubscriptionInvoice"("orgId", "pharmacyId", "status");

-- CreateIndex
CREATE INDEX "CarePortSubscriptionInvoice_periodStart_periodEnd_idx" ON "CarePortSubscriptionInvoice"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "CarePortSubscriptionInvoice_dueAt_idx" ON "CarePortSubscriptionInvoice"("dueAt");

-- CreateIndex
CREATE INDEX "CarePortOperationalSetting_orgId_idx" ON "CarePortOperationalSetting"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "CarePortOperationalSetting_orgId_key_key" ON "CarePortOperationalSetting"("orgId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicianOnboardingPayment_providerReference_key" ON "ClinicianOnboardingPayment"("providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicianOnboardingPayment_authorisationCodeHash_key" ON "ClinicianOnboardingPayment"("authorisationCodeHash");

-- CreateIndex
CREATE INDEX "ClinicianOnboardingPayment_clinicianId_idx" ON "ClinicianOnboardingPayment"("clinicianId");

-- CreateIndex
CREATE INDEX "ClinicianOnboardingPayment_onboardingId_idx" ON "ClinicianOnboardingPayment"("onboardingId");

-- CreateIndex
CREATE INDEX "ClinicianOnboardingPayment_status_idx" ON "ClinicianOnboardingPayment"("status");

-- CreateIndex
CREATE INDEX "ClinicianOnboardingPayment_provider_idx" ON "ClinicianOnboardingPayment"("provider");

-- CreateIndex
CREATE INDEX "ClinicianOnboardingPayment_paymentReference_idx" ON "ClinicianOnboardingPayment"("paymentReference");

-- CreateIndex
CREATE INDEX "ClinicianOnboardingPayment_confirmedAt_idx" ON "ClinicianOnboardingPayment"("confirmedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MemberReimbursementClaim_claimNumber_key" ON "MemberReimbursementClaim"("claimNumber");

-- CreateIndex
CREATE INDEX "MemberReimbursementClaim_orgId_clientId_status_idx" ON "MemberReimbursementClaim"("orgId", "clientId", "status");

-- CreateIndex
CREATE INDEX "MemberReimbursementClaim_orgId_patientId_status_idx" ON "MemberReimbursementClaim"("orgId", "patientId", "status");

-- CreateIndex
CREATE INDEX "MemberReimbursementClaim_appointmentId_idx" ON "MemberReimbursementClaim"("appointmentId");

-- CreateIndex
CREATE INDEX "MemberReimbursementClaim_encounterId_idx" ON "MemberReimbursementClaim"("encounterId");

-- CreateIndex
CREATE INDEX "ProviderNetworkRecord_orgId_idx" ON "ProviderNetworkRecord"("orgId");

-- CreateIndex
CREATE INDEX "ProviderNetworkRecord_clientId_idx" ON "ProviderNetworkRecord"("clientId");

-- CreateIndex
CREATE INDEX "ProviderNetworkRecord_orgId_clientId_idx" ON "ProviderNetworkRecord"("orgId", "clientId");

-- CreateIndex
CREATE INDEX "ProviderNetworkRecord_providerLane_idx" ON "ProviderNetworkRecord"("providerLane");

-- CreateIndex
CREATE INDEX "ProviderNetworkRecord_providerId_idx" ON "ProviderNetworkRecord"("providerId");

-- CreateIndex
CREATE INDEX "ProviderNetworkRecord_practiceNumber_idx" ON "ProviderNetworkRecord"("practiceNumber");

-- CreateIndex
CREATE INDEX "ProviderNetworkRecord_contractStatus_idx" ON "ProviderNetworkRecord"("contractStatus");

-- CreateIndex
CREATE INDEX "ProviderNetworkRecord_dspStatus_idx" ON "ProviderNetworkRecord"("dspStatus");

-- CreateIndex
CREATE INDEX "CarePortOrder_settlementStatus_updatedAt_idx" ON "CarePortOrder"("settlementStatus", "updatedAt");

-- CreateIndex
CREATE INDEX "CarePortOrder_chosenPharmacyId_settlementStatus_idx" ON "CarePortOrder"("chosenPharmacyId", "settlementStatus");

-- CreateIndex
CREATE INDEX "CarePortPaymentIntent_provider_providerRef_idx" ON "CarePortPaymentIntent"("provider", "providerRef");

-- CreateIndex
CREATE INDEX "CarePortPaymentIntent_providerStatus_updatedAt_idx" ON "CarePortPaymentIntent"("providerStatus", "updatedAt");

-- RenameForeignKey
ALTER TABLE "ClinicianTrainingAdmission" RENAME CONSTRAINT "cta_assignment_fk" TO "ClinicianTrainingAdmission_assignmentId_fkey";

-- RenameForeignKey
ALTER TABLE "ClinicianTrainingAdmission" RENAME CONSTRAINT "cta_slot_fk" TO "ClinicianTrainingAdmission_trainingSlotId_fkey";

-- RenameForeignKey
ALTER TABLE "ClinicianTrainingAttendanceSession" RENAME CONSTRAINT "ctas_admission_fk" TO "ClinicianTrainingAttendanceSession_admissionId_fkey";

-- RenameForeignKey
ALTER TABLE "ClinicianTrainingAttendanceSession" RENAME CONSTRAINT "ctas_assignment_fk" TO "ClinicianTrainingAttendanceSession_assignmentId_fkey";

-- RenameForeignKey
ALTER TABLE "ClinicianTrainingAttendanceSession" RENAME CONSTRAINT "ctas_slot_fk" TO "ClinicianTrainingAttendanceSession_trainingSlotId_fkey";

-- RenameForeignKey
ALTER TABLE "ClinicianTrainingParticipantAssignment" RENAME CONSTRAINT "ctpa_slot_fk" TO "ClinicianTrainingParticipantAssignment_trainingSlotId_fkey";

-- AddForeignKey
ALTER TABLE "CarePortSettlementLine" ADD CONSTRAINT "CarePortSettlementLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CarePortSettlementBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePortSubscriptionInvoice" ADD CONSTRAINT "CarePortSubscriptionInvoice_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicianOnboardingPayment" ADD CONSTRAINT "ClinicianOnboardingPayment_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "ClinicianOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Application_applicantEmailNormalized_opportunityId_createdAt_id" RENAME TO "Application_applicantEmailNormalized_opportunityId_createdA_idx";

-- RenameIndex
ALTER INDEX "ApplicationInterviewEvaluation_evaluatorProfileId_state_created" RENAME TO "ApplicationInterviewEvaluation_evaluatorProfileId_state_cre_idx";

-- RenameIndex
ALTER INDEX "ApplicationInterviewEvaluationCycle_applicationId_status_create" RENAME TO "ApplicationInterviewEvaluationCycle_applicationId_status_cr_idx";

-- RenameIndex
ALTER INDEX "ApplicationInterviewEvaluationCycle_formVersionId_status_create" RENAME TO "ApplicationInterviewEvaluationCycle_formVersionId_status_cr_idx";

-- RenameIndex
ALTER INDEX "ApplicationInterviewEvaluationCycle_openedByProfileId_createdAt" RENAME TO "ApplicationInterviewEvaluationCycle_openedByProfileId_creat_idx";

-- RenameIndex
ALTER INDEX "CarePortPharmacySku_pharmacyId_prescriptionRequired_isActive_id" RENAME TO "CarePortPharmacySku_pharmacyId_prescriptionRequired_isActiv_idx";

-- RenameIndex
ALTER INDEX "CarePortRxProcurementSession_encounterId_patientId_updatedAt_id" RENAME TO "CarePortRxProcurementSession_encounterId_patientId_updatedA_idx";

-- RenameIndex
ALTER INDEX "ClinicianOnboardingPayLaterRequest_clinicianId_status_requested" RENAME TO "ClinicianOnboardingPayLaterRequest_clinicianId_status_reque_idx";

-- RenameIndex
ALTER INDEX "compliance_reminder_dedupe" RENAME TO "ComplianceRenewalReminder_subjectKey_dueAt_reminderKind_thr_key";

-- RenameIndex
ALTER INDEX "EnterpriseFormTranslation_versionId_locale_targetType_targetKey" RENAME TO "EnterpriseFormTranslation_versionId_locale_targetType_targe_key";

-- RenameIndex
ALTER INDEX "LegalAcknowledgement_subject_acknowledgedAt_idx" RENAME TO "LegalAcknowledgement_subjectType_subjectId_acknowledgedAt_idx";

-- RenameIndex
ALTER INDEX "LegalAcknowledgement_user_acknowledgedAt_idx" RENAME TO "LegalAcknowledgement_subjectUserId_acknowledgedAt_idx";

-- RenameIndex
ALTER INDEX "LegalAcknowledgement_version_acknowledgedAt_idx" RENAME TO "LegalAcknowledgement_legalDocumentVersionId_acknowledgedAt_idx";

-- RenameIndex
ALTER INDEX "OpportunityGalleryImage_opportunityId_role_sortOrder_createdAt_" RENAME TO "OpportunityGalleryImage_opportunityId_role_sortOrder_create_idx";

-- RenameIndex
ALTER INDEX "RecruitmentTemplate_defaultDepartmentId_defaultDesignationId_id" RENAME TO "RecruitmentTemplate_defaultDepartmentId_defaultDesignationI_idx";

-- RenameIndex
ALTER INDEX "StaffEmploymentDocument_staffProfileId_documentType_createdAt_i" RENAME TO "StaffEmploymentDocument_staffProfileId_documentType_created_idx";

