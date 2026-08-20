-- Allow the canonical managed-media reference emitted for Opportunity Featured Images.
-- Preserve the existing NULL and HTTPS contract. Historical migrations remain immutable.

ALTER TABLE "Opportunity"
  DROP CONSTRAINT "Opportunity_image_url_https_check";

ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_image_url_https_check"
  CHECK (
    "imageUrl" IS NULL
    OR "imageUrl" ~ '^https://[^[:space:]]+$'
    OR "imageUrl" ~ '^managed://ambulant-enterprise-media/enterprise-media/opportunity-image/[A-Za-z0-9_-]{1,160}/[A-Za-z0-9_-]{1,160}$'
  );
