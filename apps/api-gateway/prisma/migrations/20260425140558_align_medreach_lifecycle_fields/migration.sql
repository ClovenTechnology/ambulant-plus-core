-- AlterTable
ALTER TABLE "Draw" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "receivedByLabAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MedReachOrderEligibleLab" ADD COLUMN     "responseActorRole" TEXT;

-- CreateTable
CREATE TABLE "Practice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "practiceNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "acceptsMedicalAid" BOOLEAN NOT NULL DEFAULT false,
    "acceptedSchemes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "smartIdDispatch" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Practice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeLocation" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "label" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "province" TEXT,
    "country" TEXT DEFAULT 'ZA',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeMember" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "userId" TEXT,
    "fullName" TEXT,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'clinician',
    "status" TEXT NOT NULL DEFAULT 'invited',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicianComplianceCheck" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "clinicianId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "regulator" TEXT,
    "status" TEXT NOT NULL DEFAULT 'missing',
    "evidenceUrl" TEXT,
    "evidenceRef" TEXT,
    "notes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicianComplianceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Practice_practiceNumber_idx" ON "Practice"("practiceNumber");

-- CreateIndex
CREATE INDEX "Practice_status_idx" ON "Practice"("status");

-- CreateIndex
CREATE INDEX "PracticeLocation_practiceId_idx" ON "PracticeLocation"("practiceId");

-- CreateIndex
CREATE INDEX "PracticeMember_practiceId_idx" ON "PracticeMember"("practiceId");

-- CreateIndex
CREATE INDEX "PracticeMember_userId_idx" ON "PracticeMember"("userId");

-- CreateIndex
CREATE INDEX "PracticeMember_email_idx" ON "PracticeMember"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeMember_practiceId_email_key" ON "PracticeMember"("practiceId", "email");

-- CreateIndex
CREATE INDEX "ClinicianComplianceCheck_orgId_clinicianId_idx" ON "ClinicianComplianceCheck"("orgId", "clinicianId");

-- CreateIndex
CREATE INDEX "ClinicianComplianceCheck_clinicianId_status_idx" ON "ClinicianComplianceCheck"("clinicianId", "status");

-- CreateIndex
CREATE INDEX "ClinicianComplianceCheck_kind_regulator_idx" ON "ClinicianComplianceCheck"("kind", "regulator");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicianComplianceCheck_orgId_clinicianId_kind_regulator_key" ON "ClinicianComplianceCheck"("orgId", "clinicianId", "kind", "regulator");

-- AddForeignKey
ALTER TABLE "PracticeLocation" ADD CONSTRAINT "PracticeLocation_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeMember" ADD CONSTRAINT "PracticeMember_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
