-- A6-R4-A2A: configurable clinician onboarding commercial pathways
ALTER TABLE "ClinicianOnboardingSetting"
ADD COLUMN "commercialPathways" JSONB;
