DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MedReachLabReviewStatus') THEN
    CREATE TYPE "MedReachLabReviewStatus" AS ENUM (
      'PENDING',
      'PUBLISHED',
      'HIDDEN',
      'FLAGGED',
      'REJECTED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "MedReachLabReview" (
  "id" TEXT NOT NULL,
  "labId" TEXT NOT NULL,
  "networkId" TEXT,
  "orderId" TEXT,
  "patientId" TEXT,
  "reviewerUserId" TEXT,
  "stars" INTEGER NOT NULL,
  "comment" TEXT,
  "status" "MedReachLabReviewStatus" NOT NULL DEFAULT 'PENDING',
  "source" TEXT NOT NULL DEFAULT 'patient',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "moderatedBy" TEXT,
  "moderatedAt" TIMESTAMP(3),

  CONSTRAINT "MedReachLabReview_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MedReachLabReview_labId_fkey'
  ) THEN
    ALTER TABLE "MedReachLabReview"
      ADD CONSTRAINT "MedReachLabReview_labId_fkey"
      FOREIGN KEY ("labId")
      REFERENCES "LabPartner"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MedReachLabReview_orderId_reviewerUserId_key'
  ) THEN
    ALTER TABLE "MedReachLabReview"
      ADD CONSTRAINT "MedReachLabReview_orderId_reviewerUserId_key"
      UNIQUE ("orderId", "reviewerUserId");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "MedReachLabReview_labId_status_idx"
  ON "MedReachLabReview"("labId", "status");

CREATE INDEX IF NOT EXISTS "MedReachLabReview_networkId_status_idx"
  ON "MedReachLabReview"("networkId", "status");

CREATE INDEX IF NOT EXISTS "MedReachLabReview_stars_idx"
  ON "MedReachLabReview"("stars");

CREATE INDEX IF NOT EXISTS "MedReachLabReview_createdAt_idx"
  ON "MedReachLabReview"("createdAt");

CREATE INDEX IF NOT EXISTS "MedReachLabReview_reviewerUserId_idx"
  ON "MedReachLabReview"("reviewerUserId");