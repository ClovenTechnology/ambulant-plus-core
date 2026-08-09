CREATE TYPE "ApplicationDocumentCycleStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ApplicationDocumentRequestStatus" AS ENUM ('REQUESTED', 'RECEIVED', 'ACCEPTED', 'REJECTED', 'CANCELLED');
CREATE TYPE "ApplicationDocumentFileState" AS ENUM ('PENDING', 'AVAILABLE', 'SUPERSEDED', 'REJECTED', 'REMOVED');
CREATE TYPE "ApplicationDocumentEventType" AS ENUM ('REQUESTED', 'UPLOADED', 'ACCEPTED', 'REJECTED', 'RE_REQUESTED', 'REMOVED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "ApplicationApplicantAccessToken" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApplicationApplicantAccessToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationAccessRateLimitBucket" (
  "id" TEXT NOT NULL,
  "scope" VARCHAR(180) NOT NULL,
  "keyHash" VARCHAR(64) NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApplicationAccessRateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationDocumentCycle" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "cycleNumber" INTEGER NOT NULL,
  "returnStatus" "ApplicationStatus" NOT NULL,
  "status" "ApplicationDocumentCycleStatus" NOT NULL DEFAULT 'OPEN',
  "requestedByProfileId" VARCHAR(240),
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedByProfileId" VARCHAR(240),
  "completedAt" TIMESTAMP(3),
  "cancelledByActorRefId" VARCHAR(240),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApplicationDocumentCycle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationDocumentRequest" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "requestKey" VARCHAR(120) NOT NULL,
  "title" VARCHAR(240) NOT NULL,
  "instructions" VARCHAR(2000),
  "required" BOOLEAN NOT NULL DEFAULT true,
  "dueAt" TIMESTAMP(3),
  "status" "ApplicationDocumentRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "allowedContentTypes" TEXT[] NOT NULL,
  "maxFileSizeBytes" INTEGER NOT NULL DEFAULT 15728640,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedByProfileId" VARCHAR(240),
  "reviewReason" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApplicationDocumentRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationDocumentFile" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "objectKey" VARCHAR(512) NOT NULL,
  "fileName" VARCHAR(255) NOT NULL,
  "contentType" VARCHAR(160) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "checksumSha256" VARCHAR(64) NOT NULL,
  "state" "ApplicationDocumentFileState" NOT NULL DEFAULT 'PENDING',
  "availableAt" TIMESTAMP(3),
  "removedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApplicationDocumentFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationDocumentEvent" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "requestId" TEXT,
  "fileId" TEXT,
  "action" "ApplicationDocumentEventType" NOT NULL,
  "actorType" "AuditActorType" NOT NULL,
  "actorRefId" VARCHAR(240),
  "note" VARCHAR(1000),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationDocumentEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApplicationApplicantAccessToken_tokenHash_key" ON "ApplicationApplicantAccessToken"("tokenHash");
CREATE INDEX "ApplicationApplicantAccessToken_applicationId_expiresAt_idx" ON "ApplicationApplicantAccessToken"("applicationId", "expiresAt");
CREATE INDEX "ApplicationApplicantAccessToken_expiresAt_revokedAt_idx" ON "ApplicationApplicantAccessToken"("expiresAt", "revokedAt");
ALTER TABLE "ApplicationApplicantAccessToken" ADD CONSTRAINT "ApplicationApplicantAccessToken_token_hash_check" CHECK ("tokenHash" ~ '^[a-f0-9]{64}$');

CREATE UNIQUE INDEX "ApplicationAccessRateLimitBucket_scope_keyHash_windowStart_key" ON "ApplicationAccessRateLimitBucket"("scope", "keyHash", "windowStart");
CREATE INDEX "ApplicationAccessRateLimitBucket_windowStart_idx" ON "ApplicationAccessRateLimitBucket"("windowStart");
CREATE INDEX "ApplicationAccessRateLimitBucket_scope_windowStart_idx" ON "ApplicationAccessRateLimitBucket"("scope", "windowStart");

CREATE UNIQUE INDEX "ApplicationDocumentCycle_applicationId_cycleNumber_key" ON "ApplicationDocumentCycle"("applicationId", "cycleNumber");
CREATE UNIQUE INDEX "ApplicationDocumentCycle_one_open_per_application" ON "ApplicationDocumentCycle"("applicationId") WHERE "status" = 'OPEN';
CREATE INDEX "ApplicationDocumentCycle_applicationId_status_createdAt_idx" ON "ApplicationDocumentCycle"("applicationId", "status", "createdAt");
ALTER TABLE "ApplicationDocumentCycle" ADD CONSTRAINT "ApplicationDocumentCycle_cycle_number_check" CHECK ("cycleNumber" >= 1);

CREATE UNIQUE INDEX "ApplicationDocumentRequest_cycleId_requestKey_key" ON "ApplicationDocumentRequest"("cycleId", "requestKey");
CREATE INDEX "ApplicationDocumentRequest_applicationId_status_createdAt_idx" ON "ApplicationDocumentRequest"("applicationId", "status", "createdAt");
CREATE INDEX "ApplicationDocumentRequest_cycleId_status_createdAt_idx" ON "ApplicationDocumentRequest"("cycleId", "status", "createdAt");
ALTER TABLE "ApplicationDocumentRequest" ADD CONSTRAINT "ApplicationDocumentRequest_max_file_size_check" CHECK ("maxFileSizeBytes" BETWEEN 1 AND 26214400);
ALTER TABLE "ApplicationDocumentRequest" ADD CONSTRAINT "ApplicationDocumentRequest_allowed_types_check" CHECK (cardinality("allowedContentTypes") BETWEEN 1 AND 8);
ALTER TABLE "ApplicationDocumentRequest" ADD CONSTRAINT "ApplicationDocumentRequest_allowed_types_allowlist_check" CHECK ("allowedContentTypes" <@ ARRAY['application/pdf', 'image/jpeg', 'image/png']::TEXT[]);

CREATE UNIQUE INDEX "ApplicationDocumentFile_objectKey_key" ON "ApplicationDocumentFile"("objectKey");
CREATE UNIQUE INDEX "ApplicationDocumentFile_one_pending_per_request" ON "ApplicationDocumentFile"("requestId") WHERE "state" = 'PENDING';
CREATE UNIQUE INDEX "ApplicationDocumentFile_one_available_per_request" ON "ApplicationDocumentFile"("requestId") WHERE "state" = 'AVAILABLE';
CREATE INDEX "ApplicationDocumentFile_requestId_state_createdAt_idx" ON "ApplicationDocumentFile"("requestId", "state", "createdAt");
CREATE INDEX "ApplicationDocumentFile_state_createdAt_idx" ON "ApplicationDocumentFile"("state", "createdAt");
ALTER TABLE "ApplicationDocumentFile" ADD CONSTRAINT "ApplicationDocumentFile_checksum_sha256_check" CHECK ("checksumSha256" ~ '^[a-f0-9]{64}$');
ALTER TABLE "ApplicationDocumentFile" ADD CONSTRAINT "ApplicationDocumentFile_size_check" CHECK ("sizeBytes" BETWEEN 1 AND 26214400);

CREATE INDEX "ApplicationDocumentEvent_applicationId_createdAt_idx" ON "ApplicationDocumentEvent"("applicationId", "createdAt");
CREATE INDEX "ApplicationDocumentEvent_cycleId_createdAt_idx" ON "ApplicationDocumentEvent"("cycleId", "createdAt");
CREATE INDEX "ApplicationDocumentEvent_requestId_createdAt_idx" ON "ApplicationDocumentEvent"("requestId", "createdAt");

ALTER TABLE "ApplicationApplicantAccessToken" ADD CONSTRAINT "ApplicationApplicantAccessToken_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationDocumentCycle" ADD CONSTRAINT "ApplicationDocumentCycle_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationDocumentRequest" ADD CONSTRAINT "ApplicationDocumentRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationDocumentRequest" ADD CONSTRAINT "ApplicationDocumentRequest_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ApplicationDocumentCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationDocumentFile" ADD CONSTRAINT "ApplicationDocumentFile_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ApplicationDocumentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationDocumentEvent" ADD CONSTRAINT "ApplicationDocumentEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationDocumentEvent" ADD CONSTRAINT "ApplicationDocumentEvent_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ApplicationDocumentCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationDocumentEvent" ADD CONSTRAINT "ApplicationDocumentEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ApplicationDocumentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApplicationDocumentEvent" ADD CONSTRAINT "ApplicationDocumentEvent_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "ApplicationDocumentFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
