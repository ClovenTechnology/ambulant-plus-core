-- Opportunity Publishing Studio V2.
-- Unifies Featured, Gallery and inline Content images on OpportunityGalleryImage,
-- adds governed structured content, draft revisions and immutable publish snapshots.

CREATE TYPE "OpportunityMediaRole" AS ENUM ('FEATURED', 'GALLERY', 'CONTENT');
CREATE TYPE "OpportunityRevisionKind" AS ENUM ('AUTOSAVE', 'MANUAL', 'PUBLISHED', 'RESTORED');

ALTER TABLE "OpportunityGalleryImage"
  ADD COLUMN "role" "OpportunityMediaRole" NOT NULL DEFAULT 'GALLERY';

ALTER TABLE "Opportunity"
  ADD COLUMN "contentDocument" JSONB,
  ADD COLUMN "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "contentRevision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "publishedContentDocument" JSONB,
  ADD COLUMN "publishedContentRevision" INTEGER,
  ADD COLUMN "showFaq" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "OpportunityRevision" (
  "id" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "kind" "OpportunityRevisionKind" NOT NULL DEFAULT 'AUTOSAVE',
  "contentDocument" JSONB,
  "showFaq" BOOLEAN NOT NULL DEFAULT true,
  "createdByProfileId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OpportunityRevision_pkey" PRIMARY KEY ("id")
);

DROP INDEX IF EXISTS "OpportunityGalleryImage_opportunityId_sortOrder_createdAt_idx";
CREATE INDEX "OpportunityGalleryImage_opportunityId_role_sortOrder_createdAt_idx"
  ON "OpportunityGalleryImage"("opportunityId", "role", "sortOrder", "createdAt");
CREATE UNIQUE INDEX "OpportunityGalleryImage_one_featured_per_opportunity_idx"
  ON "OpportunityGalleryImage"("opportunityId")
  WHERE "role" = 'FEATURED';

CREATE UNIQUE INDEX "OpportunityRevision_opportunityId_revisionNumber_key"
  ON "OpportunityRevision"("opportunityId", "revisionNumber");
CREATE INDEX "OpportunityRevision_opportunityId_createdAt_idx"
  ON "OpportunityRevision"("opportunityId", "createdAt");
CREATE INDEX "OpportunityRevision_createdByProfileId_createdAt_idx"
  ON "OpportunityRevision"("createdByProfileId", "createdAt");

ALTER TABLE "OpportunityRevision"
  ADD CONSTRAINT "OpportunityRevision_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OpportunityRevision"
  ADD CONSTRAINT "OpportunityRevision_createdByProfileId_fkey"
  FOREIGN KEY ("createdByProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
