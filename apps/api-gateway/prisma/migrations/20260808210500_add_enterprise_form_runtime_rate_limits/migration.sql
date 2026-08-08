-- C2B2A: durable, privacy-preserving public form runtime rate limiting.
-- Stores only a keyed SHA-256 digest of the client key; no plaintext IP/email.
CREATE TABLE "EnterpriseFormRateLimitBucket" (
    "id" TEXT NOT NULL,
    "scope" VARCHAR(180) NOT NULL,
    "keyHash" VARCHAR(64) NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnterpriseFormRateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EnterpriseFormRateLimitBucket_scope_keyHash_windowStart_key"
ON "EnterpriseFormRateLimitBucket"("scope", "keyHash", "windowStart");

CREATE INDEX "EnterpriseFormRateLimitBucket_windowStart_idx"
ON "EnterpriseFormRateLimitBucket"("windowStart");

CREATE INDEX "EnterpriseFormRateLimitBucket_scope_windowStart_idx"
ON "EnterpriseFormRateLimitBucket"("scope", "windowStart");

ALTER TABLE "EnterpriseFormRateLimitBucket"
ADD CONSTRAINT "EnterpriseFormRateLimitBucket_count_check"
CHECK ("count" >= 1);
