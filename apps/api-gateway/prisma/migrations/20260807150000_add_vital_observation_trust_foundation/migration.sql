-- Ambulant+ Vital Observation Trust foundation.
-- Source migration only. Apply through the controlled deployment path.

BEGIN;

CREATE TYPE "VitalSampleInterpretationStatus" AS ENUM (
    'ACTIVE',
    'SUSPECT',
    'EXCLUDED'
);

CREATE TYPE "VitalSampleTimeAuthority" AS ENUM (
    'UNSPECIFIED',
    'SOURCE_REPORTED',
    'SERVER_RECEIVED_FALLBACK'
);

ALTER TABLE "VitalSample"
    ADD COLUMN "observationId" TEXT,
    ADD COLUMN "receivedAt" TIMESTAMP(3),
    ADD COLUMN "timeAuthority" "VitalSampleTimeAuthority" NOT NULL DEFAULT 'UNSPECIFIED',
    ADD COLUMN "interpretationStatus" "VitalSampleInterpretationStatus" NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN "statusChangedAt" TIMESTAMP(3),
    ADD COLUMN "statusChangedByUserId" TEXT,
    ADD COLUMN "statusChangedByActorRefId" TEXT,
    ADD COLUMN "statusChangedByRole" TEXT,
    ADD COLUMN "statusReasonCode" TEXT,
    ADD COLUMN "statusReasonText" TEXT;

-- Every historical scalar receives a stable observation identity first.
-- Regrouping is deliberately conservative: rows are grouped only when they share
-- patient, device, room context and exact acquisition time, and when each conceptual
-- component occurs at most once. Ambiguous/duplicate historical acquisitions remain
-- separate observations rather than being merged speculatively.
UPDATE "VitalSample"
SET "observationId" = "id"
WHERE "observationId" IS NULL;

WITH "bp_candidates" AS (
    SELECT
        "patientId",
        "deviceId",
        "roomId",
        "t",
        MIN("id") AS "observationId",
        COUNT(*) AS "rowCount",
        COUNT(DISTINCT CASE
            WHEN "vType" IN ('blood_pressure_systolic', 'sbp', 'sys') THEN 'systolic'
            WHEN "vType" IN ('blood_pressure_diastolic', 'dbp', 'dia') THEN 'diastolic'
            WHEN "vType" IN ('blood_pressure_map', 'mean_arterial_pressure') THEN 'map'
            WHEN "vType" = 'blood_pressure_pulse' THEN 'pulse'
        END) AS "componentCount"
    FROM "VitalSample"
    WHERE "vType" IN (
        'blood_pressure_systolic',
        'blood_pressure_diastolic',
        'blood_pressure_map',
        'blood_pressure_pulse',
        'mean_arterial_pressure',
        'sbp',
        'sys',
        'dbp',
        'dia'
    )
    GROUP BY "patientId", "deviceId", "roomId", "t"
),
"bp_groups" AS (
    SELECT "patientId", "deviceId", "roomId", "t", "observationId"
    FROM "bp_candidates"
    WHERE "rowCount" >= 2
      AND "rowCount" = "componentCount"
)
UPDATE "VitalSample" AS "v"
SET "observationId" = "g"."observationId"
FROM "bp_groups" AS "g"
WHERE "v"."patientId" = "g"."patientId"
  AND "v"."deviceId" = "g"."deviceId"
  AND "v"."roomId" IS NOT DISTINCT FROM "g"."roomId"
  AND "v"."t" = "g"."t"
  AND "v"."vType" IN (
      'blood_pressure_systolic',
      'blood_pressure_diastolic',
      'blood_pressure_map',
      'blood_pressure_pulse',
      'mean_arterial_pressure',
      'sbp',
      'sys',
      'dbp',
      'dia'
  );

WITH "spo2_candidates" AS (
    SELECT
        "patientId",
        "deviceId",
        "roomId",
        "t",
        MIN("id") AS "observationId",
        COUNT(*) AS "rowCount",
        COUNT(DISTINCT CASE
            WHEN "vType" = 'spo2' THEN 'oxygen'
            WHEN "vType" = 'spo2_pulse' THEN 'pulse'
            WHEN "vType" = 'spo2_pi' THEN 'perfusion_index'
        END) AS "componentCount"
    FROM "VitalSample"
    WHERE "vType" IN ('spo2', 'spo2_pulse', 'spo2_pi')
    GROUP BY "patientId", "deviceId", "roomId", "t"
),
"spo2_groups" AS (
    SELECT "patientId", "deviceId", "roomId", "t", "observationId"
    FROM "spo2_candidates"
    WHERE "rowCount" >= 2
      AND "rowCount" = "componentCount"
)
UPDATE "VitalSample" AS "v"
SET "observationId" = "g"."observationId"
FROM "spo2_groups" AS "g"
WHERE "v"."patientId" = "g"."patientId"
  AND "v"."deviceId" = "g"."deviceId"
  AND "v"."roomId" IS NOT DISTINCT FROM "g"."roomId"
  AND "v"."t" = "g"."t"
  AND "v"."vType" IN ('spo2', 'spo2_pulse', 'spo2_pi');

WITH "temperature_candidates" AS (
    SELECT
        "patientId",
        "deviceId",
        "roomId",
        "t",
        MIN("id") AS "observationId",
        COUNT(*) AS "rowCount",
        COUNT(DISTINCT CASE
            WHEN "vType" IN ('temperature', 'temperature_celsius', 'temp', 'tempC') THEN 'celsius'
            WHEN "vType" = 'temperature_fahrenheit' THEN 'fahrenheit'
        END) AS "componentCount"
    FROM "VitalSample"
    WHERE "vType" IN ('temperature', 'temperature_celsius', 'temperature_fahrenheit', 'temp', 'tempC')
    GROUP BY "patientId", "deviceId", "roomId", "t"
),
"temperature_groups" AS (
    SELECT "patientId", "deviceId", "roomId", "t", "observationId"
    FROM "temperature_candidates"
    WHERE "rowCount" >= 2
      AND "rowCount" = "componentCount"
)
UPDATE "VitalSample" AS "v"
SET "observationId" = "g"."observationId"
FROM "temperature_groups" AS "g"
WHERE "v"."patientId" = "g"."patientId"
  AND "v"."deviceId" = "g"."deviceId"
  AND "v"."roomId" IS NOT DISTINCT FROM "g"."roomId"
  AND "v"."t" = "g"."t"
  AND "v"."vType" IN ('temperature', 'temperature_celsius', 'temperature_fahrenheit', 'temp', 'tempC');

-- Temporary backward-compatibility bridge for pre-trust VitalSample writers.
-- Old deployed writers do not send observationId. Before the NOT NULL constraint is enforced,
-- this trigger assigns the scalar row id as a safe one-row observation identity when absent.
-- New trust-aware writers supply observationId explicitly and pass through unchanged.
CREATE FUNCTION "ambulant_vital_sample_observation_id_compat"()
RETURNS trigger
LANGUAGE plpgsql
AS $ambulant_observation_compat$
BEGIN
    IF NEW."observationId" IS NULL OR btrim(NEW."observationId") = '' THEN
        NEW."observationId" := NEW."id";
    END IF;

    RETURN NEW;
END;
$ambulant_observation_compat$;

CREATE TRIGGER "VitalSample_observationId_compat_before_insert"
BEFORE INSERT ON "VitalSample"
FOR EACH ROW
EXECUTE FUNCTION "ambulant_vital_sample_observation_id_compat"();

ALTER TABLE "VitalSample"
    ALTER COLUMN "observationId" SET NOT NULL;

CREATE TABLE "VitalSampleTrustEvent" (
    "id" TEXT NOT NULL,
    "vitalSampleId" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "fromStatus" "VitalSampleInterpretationStatus",
    "toStatus" "VitalSampleInterpretationStatus" NOT NULL,
    "reasonCode" TEXT,
    "reasonText" TEXT,
    "actorUserId" TEXT,
    "actorRefId" TEXT,
    "actorRole" TEXT,
    "sessionId" TEXT,
    "app" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "VitalSampleTrustEvent_pkey"
        PRIMARY KEY ("id")
);

CREATE INDEX "VitalSample_observationId_idx"
    ON "VitalSample"("observationId");

CREATE INDEX "VitalSample_patientId_observationId_idx"
    ON "VitalSample"("patientId", "observationId");

CREATE INDEX "VitalSample_patientId_interpretationStatus_t_idx"
    ON "VitalSample"("patientId", "interpretationStatus", "t");

CREATE INDEX "VitalSampleTrustEvent_vitalSampleId_createdAt_idx"
    ON "VitalSampleTrustEvent"("vitalSampleId", "createdAt");

CREATE INDEX "VitalSampleTrustEvent_observationId_createdAt_idx"
    ON "VitalSampleTrustEvent"("observationId", "createdAt");

CREATE INDEX "VitalSampleTrustEvent_patientId_createdAt_idx"
    ON "VitalSampleTrustEvent"("patientId", "createdAt");

ALTER TABLE "VitalSampleTrustEvent"
    ADD CONSTRAINT "VitalSampleTrustEvent_vitalSampleId_fkey"
    FOREIGN KEY ("vitalSampleId")
    REFERENCES "VitalSample"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMIT;
