BEGIN;

ALTER TABLE "ClinicianTrainingParticipantAssignment"
  DROP CONSTRAINT IF EXISTS "ctpa_principal_type_check";

ALTER TABLE "ClinicianTrainingParticipantAssignment"
  ADD CONSTRAINT "ctpa_principal_type_check"
  CHECK (
    "principalType" IN (
      'clinician',
      'patient',
      'org_user',
      'external_guest'
    )
  );

ALTER TABLE "ClinicianTrainingParticipantAssignment"
  DROP CONSTRAINT IF EXISTS "ctpa_role_check";

ALTER TABLE "ClinicianTrainingParticipantAssignment"
  ADD CONSTRAINT "ctpa_role_check"
  CHECK (
    "role" IN (
      'clinician',
      'patient',
      'trainer',
      'observer',
      'admin'
    )
  );

ALTER TABLE "ClinicianTrainingAdmission"
  DROP CONSTRAINT IF EXISTS "cta_role_check";

ALTER TABLE "ClinicianTrainingAdmission"
  ADD CONSTRAINT "cta_role_check"
  CHECK (
    "role" IN (
      'clinician',
      'patient',
      'trainer',
      'observer',
      'admin'
    )
  );

ALTER TABLE "ClinicianTrainingAttendanceSession"
  DROP CONSTRAINT IF EXISTS "ctas_role_check";

ALTER TABLE "ClinicianTrainingAttendanceSession"
  ADD CONSTRAINT "ctas_role_check"
  CHECK (
    "participantRole" IN (
      'clinician',
      'patient',
      'trainer',
      'observer',
      'admin'
    )
  );

COMMIT;