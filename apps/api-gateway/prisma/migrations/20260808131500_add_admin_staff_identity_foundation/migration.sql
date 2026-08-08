CREATE TYPE "AdminStaffLifecycleState" AS ENUM ('ACTIVE', 'LEAVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "AdminStaffPresenceState" AS ENUM ('AVAILABLE', 'BUSY', 'IN_MEETING', 'DO_NOT_DISTURB', 'OFFLINE');
CREATE TYPE "AdminStaffPreferredContactMethod" AS ENUM ('IN_APP', 'EMAIL', 'MOBILE');

ALTER TABLE "AdminUserProfile"
ADD COLUMN "phone" VARCHAR(40),
ADD COLUMN "staffIdentifier" VARCHAR(120),
ADD COLUMN "photoUrl" TEXT,
ADD COLUMN "managerId" TEXT,
ADD COLUMN "lifecycleState" "AdminStaffLifecycleState" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "lifecycleChangedAt" TIMESTAMP(3),
ADD COLUMN "lifecycleChangedBy" TEXT,
ADD COLUMN "lifecycleReason" TEXT,
ADD COLUMN "timezone" VARCHAR(120),
ADD COLUMN "workingHours" JSONB,
ADD COLUMN "preferredContactMethod" "AdminStaffPreferredContactMethod",
ADD COLUMN "lastActivityAt" TIMESTAMP(3);

CREATE TABLE "AdminStaffPresence" (
  "id" TEXT NOT NULL,
  "staffProfileId" TEXT NOT NULL,
  "state" "AdminStaffPresenceState" NOT NULL DEFAULT 'OFFLINE',
  "note" VARCHAR(240),
  "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminStaffPresence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminUserProfile_staffIdentifier_key" ON "AdminUserProfile"("staffIdentifier");
CREATE INDEX "AdminUserProfile_managerId_idx" ON "AdminUserProfile"("managerId");
CREATE INDEX "AdminUserProfile_lifecycleState_idx" ON "AdminUserProfile"("lifecycleState");
CREATE INDEX "AdminUserProfile_lastActivityAt_idx" ON "AdminUserProfile"("lastActivityAt");
CREATE UNIQUE INDEX "AdminStaffPresence_staffProfileId_key" ON "AdminStaffPresence"("staffProfileId");
CREATE INDEX "AdminStaffPresence_state_expiresAt_idx" ON "AdminStaffPresence"("state", "expiresAt");
CREATE INDEX "AdminStaffPresence_expiresAt_idx" ON "AdminStaffPresence"("expiresAt");

ALTER TABLE "AdminUserProfile"
ADD CONSTRAINT "AdminUserProfile_managerId_fkey"
FOREIGN KEY ("managerId") REFERENCES "AdminUserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdminStaffPresence"
ADD CONSTRAINT "AdminStaffPresence_staffProfileId_fkey"
FOREIGN KEY ("staffProfileId") REFERENCES "AdminUserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
