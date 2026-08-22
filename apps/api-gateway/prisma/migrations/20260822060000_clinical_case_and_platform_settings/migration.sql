-- Admin Green G2A: durable longitudinal ClinicalCase authority and platform settings.
-- Existing Encounter.caseId values remain unchanged. A compatibility trigger ensures
-- legacy encounter writers create/validate their ClinicalCase before the FK is enforced.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Encounter"
    WHERE btrim("caseId") = ''
       OR btrim("patientId") = ''
       OR btrim("orgId") = ''
  ) THEN
    RAISE EXCEPTION 'clinical_case_backfill_invalid_blank_identity';
  END IF;

  IF EXISTS (
    SELECT "caseId"
    FROM "Encounter"
    GROUP BY "caseId"
    HAVING COUNT(DISTINCT "patientId") > 1
  ) THEN
    RAISE EXCEPTION 'clinical_case_backfill_patient_conflict';
  END IF;

  IF EXISTS (
    SELECT "caseId"
    FROM "Encounter"
    GROUP BY "caseId"
    HAVING COUNT(DISTINCT "orgId") > 1
  ) THEN
    RAISE EXCEPTION 'clinical_case_backfill_org_conflict';
  END IF;
END $$;

CREATE TABLE "ClinicalCase" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "leadClinicianId" TEXT,
  "title" TEXT NOT NULL DEFAULT 'Clinical case',
  "summary" TEXT,
  "notes" TEXT,
  "status" VARCHAR(80) NOT NULL DEFAULT 'open',
  "priority" VARCHAR(80) NOT NULL DEFAULT 'routine',
  "orgId" TEXT NOT NULL DEFAULT 'org-default',
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "lastEncounterAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClinicalCase_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ClinicalCase" (
  "id",
  "patientId",
  "title",
  "status",
  "priority",
  "orgId",
  "openedAt",
  "lastEncounterAt",
  "createdAt",
  "updatedAt"
)
SELECT
  e."caseId",
  MIN(e."patientId"),
  'Clinical case',
  'open',
  'routine',
  MIN(e."orgId"),
  MIN(e."createdAt"),
  MAX(e."updatedAt"),
  MIN(e."createdAt"),
  MAX(e."updatedAt")
FROM "Encounter" e
GROUP BY e."caseId";

CREATE INDEX "ClinicalCase_patientId_status_updatedAt_idx"
  ON "ClinicalCase"("patientId", "status", "updatedAt");
CREATE INDEX "ClinicalCase_leadClinicianId_status_updatedAt_idx"
  ON "ClinicalCase"("leadClinicianId", "status", "updatedAt");
CREATE INDEX "ClinicalCase_orgId_status_updatedAt_idx"
  ON "ClinicalCase"("orgId", "status", "updatedAt");
CREATE INDEX "ClinicalCase_lastEncounterAt_idx"
  ON "ClinicalCase"("lastEncounterAt");
CREATE INDEX "Encounter_caseId_updatedAt_idx"
  ON "Encounter"("caseId", "updatedAt");

CREATE OR REPLACE FUNCTION ambulant_ensure_clinical_case_for_encounter()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  existing_patient TEXT;
  existing_org TEXT;
  encounter_time TIMESTAMP(3);
BEGIN
  IF NEW."caseId" IS NULL OR btrim(NEW."caseId") = '' THEN
    RAISE EXCEPTION 'clinical_case_case_id_required';
  END IF;
  IF NEW."patientId" IS NULL OR btrim(NEW."patientId") = '' THEN
    RAISE EXCEPTION 'clinical_case_patient_id_required';
  END IF;
  IF NEW."orgId" IS NULL OR btrim(NEW."orgId") = '' THEN
    RAISE EXCEPTION 'clinical_case_org_id_required';
  END IF;

  encounter_time := COALESCE(NEW."updatedAt", NEW."createdAt", CURRENT_TIMESTAMP);

  INSERT INTO "ClinicalCase" (
    "id", "patientId", "title", "status", "priority", "orgId",
    "openedAt", "lastEncounterAt", "createdAt", "updatedAt"
  )
  VALUES (
    NEW."caseId", NEW."patientId", 'Clinical case', 'open', 'routine', NEW."orgId",
    COALESCE(NEW."createdAt", CURRENT_TIMESTAMP), encounter_time,
    COALESCE(NEW."createdAt", CURRENT_TIMESTAMP), encounter_time
  )
  ON CONFLICT ("id") DO NOTHING;

  SELECT "patientId", "orgId"
  INTO existing_patient, existing_org
  FROM "ClinicalCase"
  WHERE "id" = NEW."caseId"
  FOR UPDATE;

  IF existing_patient IS DISTINCT FROM NEW."patientId" THEN
    RAISE EXCEPTION 'clinical_case_patient_mismatch';
  END IF;
  IF existing_org IS DISTINCT FROM NEW."orgId" THEN
    RAISE EXCEPTION 'clinical_case_org_mismatch';
  END IF;

  UPDATE "ClinicalCase"
  SET
    "lastEncounterAt" = CASE
      WHEN "lastEncounterAt" IS NULL OR "lastEncounterAt" < encounter_time THEN encounter_time
      ELSE "lastEncounterAt"
    END,
    "updatedAt" = CASE
      WHEN "updatedAt" < encounter_time THEN encounter_time
      ELSE "updatedAt"
    END
  WHERE "id" = NEW."caseId";

  RETURN NEW;
END $$;

CREATE TRIGGER "Encounter_ensure_clinical_case_trg"
BEFORE INSERT OR UPDATE OF "caseId", "patientId", "orgId", "updatedAt"
ON "Encounter"
FOR EACH ROW
EXECUTE FUNCTION ambulant_ensure_clinical_case_for_encounter();

ALTER TABLE "Encounter"
  ADD CONSTRAINT "Encounter_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "ClinicalCase"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PlatformSetting" (
  "key" VARCHAR(160) NOT NULL,
  "category" VARCHAR(80),
  "value" JSONB NOT NULL,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "PlatformSetting_category_updatedAt_idx"
  ON "PlatformSetting"("category", "updatedAt");
