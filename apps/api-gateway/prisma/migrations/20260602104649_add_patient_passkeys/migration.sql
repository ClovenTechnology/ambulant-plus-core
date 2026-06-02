CREATE TABLE IF NOT EXISTS "UserPasskeyCredential" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "publicKey" TEXT NOT NULL,
  "counter" BIGINT NOT NULL DEFAULT 0,
  "transports" JSONB,
  "deviceLabel" TEXT,
  "backedUp" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  "disabledAt" TIMESTAMP(3),

  CONSTRAINT "UserPasskeyCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserPasskeyCredential_credentialId_key"
  ON "UserPasskeyCredential" ("credentialId");

CREATE INDEX IF NOT EXISTS "UserPasskeyCredential_userId_idx"
  ON "UserPasskeyCredential" ("userId");

CREATE TABLE IF NOT EXISTS "WebAuthnChallenge" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "identifier" TEXT,
  "challenge" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WebAuthnChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WebAuthnChallenge_challenge_key"
  ON "WebAuthnChallenge" ("challenge");

CREATE INDEX IF NOT EXISTS "WebAuthnChallenge_userId_type_idx"
  ON "WebAuthnChallenge" ("userId", "type");

CREATE INDEX IF NOT EXISTS "WebAuthnChallenge_identifier_type_idx"
  ON "WebAuthnChallenge" ("identifier", "type");

CREATE INDEX IF NOT EXISTS "WebAuthnChallenge_expiresAt_idx"
  ON "WebAuthnChallenge" ("expiresAt");
