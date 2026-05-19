-- CreateEnum
CREATE TYPE "ClientOrgType" AS ENUM ('MEDICAL_AID', 'HMO', 'CORPORATE_SPONSOR', 'GYM', 'WELLNESS_PARTNER');

-- CreateEnum
CREATE TYPE "ClientWorkspaceType" AS ENUM ('PAYER_OPS', 'CORPORATE_SPONSOR', 'WELLNESS_PARTNER');

-- CreateEnum
CREATE TYPE "ClientOrgStatus" AS ENUM ('PENDING_REVIEW', 'KYB_SUBMITTED', 'KYB_UNDER_REVIEW', 'KYB_APPROVED', 'CONFIGURING', 'UAT', 'ACTIVE', 'RESTRICTED', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ClientOrgUserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateTable
CREATE TABLE "ClientOrg" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "orgType" "ClientOrgType" NOT NULL,
    "status" "ClientOrgStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "registrationNo" TEXT,
    "taxNo" TEXT,
    "country" TEXT NOT NULL DEFAULT 'ZA',
    "region" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
    "complianceProfile" TEXT NOT NULL DEFAULT 'ZA_STANDARD',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientOrg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientOrgWorkspace" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "workspace" "ClientWorkspaceType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientOrgWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientOrgUser" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "status" "ClientOrgUserStatus" NOT NULL DEFAULT 'INVITED',
    "defaultWorkspace" "ClientWorkspaceType" NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'READ_ONLY_ANALYST',
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "invitedByUserId" TEXT,
    "invitedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientOrgUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientOrgInvitation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "token" TEXT NOT NULL,
    "status" "ClientOrgUserStatus" NOT NULL DEFAULT 'INVITED',
    "role" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultWorkspace" "ClientWorkspaceType" NOT NULL,
    "invitedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientOrgInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientOrgApiClient" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientOrgApiClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientOrgWorkspace_orgId_workspace_key" ON "ClientOrgWorkspace"("orgId", "workspace");

-- CreateIndex
CREATE INDEX "ClientOrgUser_userId_idx" ON "ClientOrgUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientOrgUser_orgId_email_key" ON "ClientOrgUser"("orgId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "ClientOrgInvitation_token_key" ON "ClientOrgInvitation"("token");

-- CreateIndex
CREATE INDEX "ClientOrgInvitation_orgId_idx" ON "ClientOrgInvitation"("orgId");

-- CreateIndex
CREATE INDEX "ClientOrgInvitation_email_idx" ON "ClientOrgInvitation"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ClientOrgApiClient_clientId_key" ON "ClientOrgApiClient"("clientId");

-- AddForeignKey
ALTER TABLE "ClientOrgWorkspace" ADD CONSTRAINT "ClientOrgWorkspace_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "ClientOrg"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientOrgUser" ADD CONSTRAINT "ClientOrgUser_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "ClientOrg"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientOrgInvitation" ADD CONSTRAINT "ClientOrgInvitation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "ClientOrg"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientOrgApiClient" ADD CONSTRAINT "ClientOrgApiClient_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "ClientOrg"("id") ON DELETE CASCADE ON UPDATE CASCADE;
