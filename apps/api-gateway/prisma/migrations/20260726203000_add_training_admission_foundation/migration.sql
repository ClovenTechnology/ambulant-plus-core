CREATE TABLE "ClinicianTrainingParticipantAssignment" (
    "id" TEXT NOT NULL,
    "trainingSlotId" TEXT NOT NULL,
    "sessionKey" VARCHAR(160) NOT NULL DEFAULT 'slot',
    "principalType" VARCHAR(40) NOT NULL,
    "principalKey" VARCHAR(400) NOT NULL,
    "principalId" VARCHAR(240),
    "email" VARCHAR(320),
    "name" VARCHAR(240) NOT NULL,
    "organisation" VARCHAR(240),
    "department" VARCHAR(240),
    "designation" VARCHAR(240),
    "role" VARCHAR(40) NOT NULL,
    "permissions" JSONB,
    "scopeSnapshot" JSONB,
    "status" VARCHAR(40) NOT NULL DEFAULT 'assigned',
    "assignedByUserId" VARCHAR(240),
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "invitationTokenHash" VARCHAR(128),
    "lastNotifiedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ctpa_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ctpa_principal_key_not_blank"
      CHECK (length(btrim("principalKey")) > 0),
    CONSTRAINT "ctpa_principal_type_check"
      CHECK ("principalType" IN ('clinician', 'org_user', 'external_guest')),
    CONSTRAINT "ctpa_role_check"
      CHECK ("role" IN ('clinician', 'trainer', 'observer', 'admin')),
    CONSTRAINT "ctpa_status_check"
      CHECK ("status" IN ('assigned', 'invited', 'accepted', 'revoked', 'expired'))
);

CREATE TABLE "ClinicianTrainingAdmission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT,
    "trainingSlotId" TEXT NOT NULL,
    "sessionKey" VARCHAR(160) NOT NULL DEFAULT 'slot',
    "subjectId" VARCHAR(240) NOT NULL,
    "role" VARCHAR(40) NOT NULL,
    "uid" VARCHAR(240) NOT NULL,
    "displayName" VARCHAR(240) NOT NULL,
    "orgId" VARCHAR(240),
    "permissions" JSONB,
    "jti" VARCHAR(128) NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notBeforeAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "issuedByUserId" VARCHAR(240),
    "userAgent" TEXT,
    "ipHash" VARCHAR(128),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cta_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cta_role_check"
      CHECK ("role" IN ('clinician', 'trainer', 'observer', 'admin')),
    CONSTRAINT "cta_window_check"
      CHECK ("expiresAt" > "notBeforeAt")
);

CREATE TABLE "ClinicianTrainingAttendanceSession" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT,
    "admissionId" TEXT,
    "trainingSlotId" TEXT NOT NULL,
    "sessionKey" VARCHAR(160) NOT NULL DEFAULT 'slot',
    "subjectId" VARCHAR(240) NOT NULL,
    "participantRole" VARCHAR(40) NOT NULL,
    "clientSessionId" VARCHAR(128) NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "disconnectReason" VARCHAR(240),
    "userAgent" TEXT,
    "ipHash" VARCHAR(128),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ctas_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ctas_role_check"
      CHECK ("participantRole" IN ('clinician', 'trainer', 'observer', 'admin')),
    CONSTRAINT "ctas_duration_check"
      CHECK ("durationSeconds" >= 0)
);

CREATE UNIQUE INDEX "ctpa_invite_hash_key"
ON "ClinicianTrainingParticipantAssignment"("invitationTokenHash");

CREATE UNIQUE INDEX "ctpa_slot_session_principal_key"
ON "ClinicianTrainingParticipantAssignment"(
    "trainingSlotId",
    "sessionKey",
    "principalKey"
);

CREATE INDEX "ctpa_slot_session_role_status_idx"
ON "ClinicianTrainingParticipantAssignment"(
    "trainingSlotId",
    "sessionKey",
    "role",
    "status"
);

CREATE INDEX "ctpa_principal_idx"
ON "ClinicianTrainingParticipantAssignment"(
    "principalType",
    "principalId"
);

CREATE INDEX "ctpa_email_idx"
ON "ClinicianTrainingParticipantAssignment"("email");

CREATE INDEX "ctpa_status_expiry_idx"
ON "ClinicianTrainingParticipantAssignment"(
    "status",
    "expiresAt"
);

CREATE UNIQUE INDEX "cta_jti_key"
ON "ClinicianTrainingAdmission"("jti");

CREATE UNIQUE INDEX "cta_token_hash_key"
ON "ClinicianTrainingAdmission"("tokenHash");

CREATE INDEX "cta_slot_session_role_expiry_idx"
ON "ClinicianTrainingAdmission"(
    "trainingSlotId",
    "sessionKey",
    "role",
    "expiresAt"
);

CREATE INDEX "cta_assignment_expiry_idx"
ON "ClinicianTrainingAdmission"(
    "assignmentId",
    "expiresAt"
);

CREATE INDEX "cta_subject_expiry_idx"
ON "ClinicianTrainingAdmission"(
    "subjectId",
    "expiresAt"
);

CREATE INDEX "cta_revoked_expiry_idx"
ON "ClinicianTrainingAdmission"(
    "revokedAt",
    "expiresAt"
);

CREATE UNIQUE INDEX "ctas_client_session_key"
ON "ClinicianTrainingAttendanceSession"("clientSessionId");

CREATE INDEX "ctas_slot_session_joined_idx"
ON "ClinicianTrainingAttendanceSession"(
    "trainingSlotId",
    "sessionKey",
    "joinedAt"
);

CREATE INDEX "ctas_assignment_joined_idx"
ON "ClinicianTrainingAttendanceSession"(
    "assignmentId",
    "joinedAt"
);

CREATE INDEX "ctas_admission_idx"
ON "ClinicianTrainingAttendanceSession"("admissionId");

CREATE INDEX "ctas_subject_joined_idx"
ON "ClinicianTrainingAttendanceSession"(
    "subjectId",
    "joinedAt"
);

CREATE INDEX "ctas_role_joined_idx"
ON "ClinicianTrainingAttendanceSession"(
    "participantRole",
    "joinedAt"
);

ALTER TABLE "ClinicianTrainingParticipantAssignment"
ADD CONSTRAINT "ctpa_slot_fk"
FOREIGN KEY ("trainingSlotId")
REFERENCES "ClinicianTrainingSlot"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "ClinicianTrainingAdmission"
ADD CONSTRAINT "cta_assignment_fk"
FOREIGN KEY ("assignmentId")
REFERENCES "ClinicianTrainingParticipantAssignment"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "ClinicianTrainingAdmission"
ADD CONSTRAINT "cta_slot_fk"
FOREIGN KEY ("trainingSlotId")
REFERENCES "ClinicianTrainingSlot"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "ClinicianTrainingAttendanceSession"
ADD CONSTRAINT "ctas_assignment_fk"
FOREIGN KEY ("assignmentId")
REFERENCES "ClinicianTrainingParticipantAssignment"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "ClinicianTrainingAttendanceSession"
ADD CONSTRAINT "ctas_admission_fk"
FOREIGN KEY ("admissionId")
REFERENCES "ClinicianTrainingAdmission"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "ClinicianTrainingAttendanceSession"
ADD CONSTRAINT "ctas_slot_fk"
FOREIGN KEY ("trainingSlotId")
REFERENCES "ClinicianTrainingSlot"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
