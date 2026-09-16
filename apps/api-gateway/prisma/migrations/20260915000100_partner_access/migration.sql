-- AlterTable
ALTER TABLE "PharmacyPartner" ADD COLUMN     "orgId" TEXT NOT NULL DEFAULT 'org-default';

-- CreateTable
CREATE TABLE "PartnerAccessAccount" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "actorType" "PresenceActorType" NOT NULL,
    "actorRefId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org-default',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "passwordHash" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "inviteHash" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerAccessAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerAccessSession" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerAccessSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerAccessAccount_inviteHash_key" ON "PartnerAccessAccount"("inviteHash");

-- CreateIndex
CREATE INDEX "PartnerAccessAccount_status_updatedAt_idx" ON "PartnerAccessAccount"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerAccessAccount_email_actorType_key" ON "PartnerAccessAccount"("email", "actorType");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerAccessAccount_actorType_actorRefId_key" ON "PartnerAccessAccount"("actorType", "actorRefId");

-- CreateIndex
CREATE INDEX "PartnerAccessSession_accountId_revokedAt_idx" ON "PartnerAccessSession"("accountId", "revokedAt");

-- CreateIndex
CREATE INDEX "PartnerAccessSession_expiresAt_idx" ON "PartnerAccessSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "PartnerAccessSession" ADD CONSTRAINT "PartnerAccessSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PartnerAccessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PartnerAccessAccount" ADD CONSTRAINT "PartnerAccessAccount_status_check" CHECK ("status" IN ('PENDING','APPROVED','SUSPENDED','REJECTED'));
ALTER TABLE "PartnerAccessAccount" ADD CONSTRAINT "PartnerAccessAccount_actor_check" CHECK ("actorType"::text IN ('PHARMACY','RIDER','LAB','PHLEB'));
