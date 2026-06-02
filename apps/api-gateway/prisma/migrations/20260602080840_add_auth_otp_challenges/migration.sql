CREATE TABLE IF NOT EXISTS "AuthOtpChallenge" (
  "id" TEXT NOT NULL,
  "identifier" VARCHAR(320) NOT NULL,
  "channel" VARCHAR(24) NOT NULL DEFAULT 'email',
  "codeHash" VARCHAR(128) NOT NULL,
  "purpose" VARCHAR(40) NOT NULL DEFAULT 'login',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "consumedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requestedByIp" TEXT,
  "requestedByUa" TEXT,
  "meta" JSONB,

  CONSTRAINT "AuthOtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuthOtpChallenge_identifier_purpose_expiresAt_idx"
  ON "AuthOtpChallenge" ("identifier", "purpose", "expiresAt");

CREATE INDEX IF NOT EXISTS "AuthOtpChallenge_expiresAt_idx"
  ON "AuthOtpChallenge" ("expiresAt");

CREATE INDEX IF NOT EXISTS "AuthOtpChallenge_createdAt_idx"
  ON "AuthOtpChallenge" ("createdAt");