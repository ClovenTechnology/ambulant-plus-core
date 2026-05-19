-- CreateTable
CREATE TABLE "PatientDataSharingPreference" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "allowClinicianAccess" BOOLEAN NOT NULL DEFAULT true,
    "allowMedicalAidAdherenceAccess" BOOLEAN NOT NULL DEFAULT false,
    "allowCorporateSponsorAdherenceAccess" BOOLEAN NOT NULL DEFAULT false,
    "allowRewardProgramAccess" BOOLEAN NOT NULL DEFAULT false,
    "allowEvidenceImages" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientDataSharingPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatientDataSharingPreference_patientId_key" ON "PatientDataSharingPreference"("patientId");

-- CreateIndex
CREATE INDEX "PatientDataSharingPreference_patientId_idx" ON "PatientDataSharingPreference"("patientId");
