/*
  Warnings:

  - You are about to alter the column `meta` on the `Appointment` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - Added the required column `updatedAt` to the `Appointment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "encounterId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "roomId" TEXT,
    "reason" TEXT,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "platformFeeCents" INTEGER NOT NULL,
    "clinicianTakeCents" INTEGER NOT NULL,
    "paymentProvider" TEXT NOT NULL,
    "paymentRef" TEXT,
    "meta" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Appointment_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Appointment" ("caseId", "clinicianId", "clinicianTakeCents", "currency", "encounterId", "endsAt", "id", "meta", "patientId", "paymentProvider", "paymentRef", "platformFeeCents", "priceCents", "sessionId", "startsAt", "status") SELECT "caseId", "clinicianId", "clinicianTakeCents", "currency", "encounterId", "endsAt", "id", "meta", "patientId", "paymentProvider", "paymentRef", "platformFeeCents", "priceCents", "sessionId", "startsAt", "status" FROM "Appointment";
DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");
CREATE INDEX "Appointment_clinicianId_idx" ON "Appointment"("clinicianId");
CREATE INDEX "Appointment_startsAt_idx" ON "Appointment"("startsAt");
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");
CREATE TABLE "new_Encounter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "Encounter_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Encounter" ("caseId", "clinicianId", "createdAt", "id", "patientId", "status", "updatedAt") SELECT "caseId", "clinicianId", "createdAt", "id", "patientId", "status", "updatedAt" FROM "Encounter";
DROP TABLE "Encounter";
ALTER TABLE "new_Encounter" RENAME TO "Encounter";
CREATE INDEX "Encounter_caseId_idx" ON "Encounter"("caseId");
CREATE INDEX "Encounter_patientId_idx" ON "Encounter"("patientId");
CREATE INDEX "Encounter_clinicianId_idx" ON "Encounter"("clinicianId");
CREATE INDEX "Encounter_status_idx" ON "Encounter"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Case_patientId_status_idx" ON "Case"("patientId", "status");
