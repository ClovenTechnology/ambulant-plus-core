/*
  Warnings:

  - A unique constraint covering the columns `[rxNumber]` on the table `ErxOrder` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[providerRef]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `ErxOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `LabOrder` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ErxOrder" ADD COLUMN     "authorizationSnapshot" JSONB,
ADD COLUMN     "claimsSnapshot" JSONB,
ADD COLUMN     "icd10Codes" JSONB,
ADD COLUMN     "nappiItems" JSONB,
ADD COLUMN     "patientSnapshot" JSONB,
ADD COLUMN     "pharmacySnapshot" JSONB,
ADD COLUMN     "prescriberSnapshot" JSONB,
ADD COLUMN     "procedureCodes" JSONB,
ADD COLUMN     "rxNumber" TEXT,
ADD COLUMN     "signatureHash" VARCHAR(128),
ADD COLUMN     "signedAt" TIMESTAMP(3),
ADD COLUMN     "tariffCodes" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ALTER COLUMN "kind" SET DEFAULT 'medication',
ALTER COLUMN "sessionId" DROP NOT NULL,
ALTER COLUMN "caseId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "LabOrder" ADD COLUMN     "authorizationSnapshot" JSONB,
ADD COLUMN     "claimsSnapshot" JSONB,
ADD COLUMN     "icd10Codes" JSONB,
ADD COLUMN     "labSnapshot" JSONB,
ADD COLUMN     "patientSnapshot" JSONB,
ADD COLUMN     "prescriberSnapshot" JSONB,
ADD COLUMN     "tariffCodes" JSONB,
ADD COLUMN     "tests" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "kind" SET DEFAULT 'lab',
ALTER COLUMN "sessionId" DROP NOT NULL,
ALTER COLUMN "caseId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "providerRef" VARCHAR(160);

-- CreateIndex
CREATE UNIQUE INDEX "ErxOrder_rxNumber_key" ON "ErxOrder"("rxNumber");

-- CreateIndex
CREATE INDEX "ErxOrder_rxNumber_idx" ON "ErxOrder"("rxNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerRef_key" ON "Payment"("providerRef");

-- CreateIndex
CREATE INDEX "Payment_providerRef_idx" ON "Payment"("providerRef");
