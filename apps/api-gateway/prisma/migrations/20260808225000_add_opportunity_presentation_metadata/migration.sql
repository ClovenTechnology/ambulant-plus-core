ALTER TABLE "Opportunity"
  ADD COLUMN "imageUrl" VARCHAR(2048),
  ADD COLUMN "imageAlt" VARCHAR(240),
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "referenceCode" VARCHAR(80),
  ADD COLUMN "audienceLabel" VARCHAR(160),
  ADD COLUMN "commitmentLabel" VARCHAR(160),
  ADD COLUMN "commercialLabel" VARCHAR(200),
  ADD COLUMN "ctaLabel" VARCHAR(80),
  ADD COLUMN "seoTitle" VARCHAR(240),
  ADD COLUMN "seoDescription" VARCHAR(500);

ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_image_url_https_check"
  CHECK ("imageUrl" IS NULL OR "imageUrl" ~ '^https://[^[:space:]]+$');

ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_image_accessibility_check"
  CHECK (
    ("imageUrl" IS NULL AND "imageAlt" IS NULL)
    OR
    (
      "imageUrl" IS NOT NULL
      AND "imageAlt" IS NOT NULL
      AND char_length(btrim("imageAlt")) > 0
    )
  );

ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_tags_count_check"
  CHECK (cardinality("tags") <= 12);
