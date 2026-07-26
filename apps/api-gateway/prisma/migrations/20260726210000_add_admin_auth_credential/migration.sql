CREATE TABLE "AdminAuthCredential" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "mustResetPassword" BOOLEAN NOT NULL DEFAULT false,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminAuthCredential_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
  "AdminAuthCredential_email_key"
ON "AdminAuthCredential"("email");

CREATE INDEX
  "AdminAuthCredential_email_idx"
ON "AdminAuthCredential"("email");