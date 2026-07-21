-- A6-R6-A2: production clinician training control plane.

ALTER TABLE "ClinicianOnboarding"
  ADD COLUMN IF NOT EXISTS "trainingMode" TEXT;

ALTER TABLE "ClinicianOnboardingSetting"
  ADD COLUMN IF NOT EXISTS "starterKitDepositItems" JSONB,
  ADD COLUMN IF NOT EXISTS "trainingPolicy" JSONB;

ALTER TABLE "ClinicianTrainingSlot"
  ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT 'Mandatory Clinician Training',
  ADD COLUMN IF NOT EXISTS "summary" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
  ADD COLUMN IF NOT EXISTS "durationDays" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "totalDurationMinutes" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS "allowedModes" JSONB,
  ADD COLUMN IF NOT EXISTS "sessions" JSONB,
  ADD COLUMN IF NOT EXISTS "venueName" TEXT,
  ADD COLUMN IF NOT EXISTS "venueAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "virtualInstructions" TEXT,
  ADD COLUMN IF NOT EXISTS "inPersonInstructions" TEXT,
  ADD COLUMN IF NOT EXISTS "bookingOpensAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "bookingClosesAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "publishedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledByUserId" TEXT;

-- Slots predating publication controls were previously public by definition.
UPDATE "ClinicianTrainingSlot"
SET
  "status" = 'published',
  "publishedAt" = COALESCE("publishedAt", "createdAt"),
  "allowedModes" = COALESCE(
    "allowedModes",
    jsonb_build_array(
      CASE
        WHEN lower(COALESCE("mode", 'virtual')) = 'in_person'
          THEN 'in_person'
        ELSE 'virtual'
      END
    )
  ),
  "sessions" = COALESCE(
    "sessions",
    jsonb_build_array(
      jsonb_build_object(
        'id', 'legacy-session-1',
        'dayNumber', 1,
        'startAt', to_char("startsAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'endAt', to_char("endsAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'mode',
          CASE
            WHEN lower(COALESCE("mode", 'virtual')) = 'in_person'
              THEN 'in_person'
            ELSE 'virtual'
          END
      )
    )
  ),
  "totalDurationMinutes" = GREATEST(
    1,
    ROUND(EXTRACT(EPOCH FROM ("endsAt" - "startsAt")) / 60)::INTEGER
  );

CREATE INDEX IF NOT EXISTS "ClinicianTrainingSlot_status_startsAt_idx"
  ON "ClinicianTrainingSlot"("status", "startsAt");

CREATE INDEX IF NOT EXISTS "ClinicianTrainingSlot_publishedAt_idx"
  ON "ClinicianTrainingSlot"("publishedAt");
