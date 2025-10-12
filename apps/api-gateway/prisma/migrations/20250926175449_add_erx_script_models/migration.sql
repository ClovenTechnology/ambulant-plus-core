-- CreateTable
CREATE TABLE "ErxScript" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "encounterId" TEXT NOT NULL,
    "sessionId" TEXT,
    "caseId" TEXT,
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "allergiesJson" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL,
    "channel" TEXT,
    "dispenseCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ErxScript_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ErxItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scriptId" TEXT NOT NULL,
    "drugName" TEXT NOT NULL,
    "dose" TEXT,
    "route" TEXT,
    "frequency" TEXT,
    "duration" TEXT,
    "quantity" TEXT,
    "refills" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    CONSTRAINT "ErxItem_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "ErxScript" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ErxEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scriptId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" TEXT,
    CONSTRAINT "ErxEvent_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "ErxScript" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ErxScript_patientId_idx" ON "ErxScript"("patientId");

-- CreateIndex
CREATE INDEX "ErxScript_clinicianId_idx" ON "ErxScript"("clinicianId");

-- CreateIndex
CREATE INDEX "ErxScript_status_idx" ON "ErxScript"("status");

-- CreateIndex
CREATE INDEX "ErxScript_createdAt_idx" ON "ErxScript"("createdAt");

-- CreateIndex
CREATE INDEX "ErxItem_scriptId_idx" ON "ErxItem"("scriptId");

-- CreateIndex
CREATE INDEX "ErxEvent_scriptId_at_idx" ON "ErxEvent"("scriptId", "at");
