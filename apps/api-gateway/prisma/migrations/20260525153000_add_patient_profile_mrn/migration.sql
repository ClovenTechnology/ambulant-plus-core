-- Add a human-facing medical record number to patient profiles.
ALTER TABLE "PatientProfile" ADD COLUMN "mrn" TEXT;

-- PostgreSQL unique indexes allow multiple NULL values, so this is safe for existing rows.
CREATE UNIQUE INDEX "PatientProfile_mrn_key" ON "PatientProfile"("mrn");
